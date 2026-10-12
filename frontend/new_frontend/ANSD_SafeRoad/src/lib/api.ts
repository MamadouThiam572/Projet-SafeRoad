import { decodeJwt } from '@/lib/jwt'

// Même valeur que .env.example : le backend monte toute l'API sous /api/v1/ (config/urls.py).
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/**
 * Premier message lisible d'une erreur DRF : { detail }, { champ: ["…"] },
 * { non_field_errors: ["…"] } ou une simple liste — sinon `defaut`.
 */
function messageErreur(body: unknown, defaut: string): string {
  if (typeof body === 'string') return body
  if (Array.isArray(body)) return body.length ? messageErreur(body[0], defaut) : defaut
  if (body && typeof body === 'object') {
    const valeurs = Object.values(body as Record<string, unknown>)
    for (const valeur of valeurs) {
      const message = messageErreur(valeur, '')
      if (message) return message
    }
  }
  return defaut
}

/** POST public (sans compte) : formulaires du site, mot de passe oublié. */
async function envoyerPublic<T>(path: string, corps: unknown, defaut: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status === 429 ? 'Trop de tentatives, réessayez plus tard.' : messageErreur(body, defaut), res.status)
  }
  return res.json()
}

export type TypeVehicule = 'voiture' | 'taxi' | 'bus' | 'camion' | 'moto' | 'autre'

export interface DemandeInstallation {
  prenom: string
  nom: string
  telephone: string
  email: string
  region: string
  commune: string
  adresse: string
  type_vehicule: TypeVehicule
  immatriculation: string
  nombre_vehicules: number
  disponibilites: string
  message: string
  contact_urgence_nom: string
  contact_urgence_telephone: string
  consentement_donnees: boolean
}

/**
 * Demande d'équipement envoyée depuis le site public. Il n'y a pas d'inscription libre :
 * le compte du conducteur est créé par l'administrateur le jour de l'installation, et
 * le conducteur reçoit alors un email pour choisir son mot de passe.
 */
export function envoyerDemandeInstallation(donnees: DemandeInstallation): Promise<{ id: number; statut: string }> {
  return envoyerPublic('/demandes-installation/', donnees, 'Envoi impossible pour le moment.')
}

// ---------------------------------------------------------------------------
// Mots de passe. Personnel (admin, ANASER, super admin) et conducteurs sont deux
// types de comptes distincts côté backend, avec chacun leurs routes.
// ---------------------------------------------------------------------------

export type TypeCompte = 'personnel' | 'conducteur'

const PREFIXE_MOT_DE_PASSE: Record<TypeCompte, string> = {
  personnel: '/auth/mot-de-passe',
  conducteur: '/auth/conducteur/mot-de-passe',
}

/** Envoie un lien de réinitialisation par email (réponse identique que le compte existe ou non). */
export function demanderReinitialisation(type: TypeCompte, email: string): Promise<{ detail: string }> {
  return envoyerPublic(`${PREFIXE_MOT_DE_PASSE[type]}/oubli/`, { email }, 'Demande impossible pour le moment.')
}

/** Choix du mot de passe depuis le lien reçu par email (invitation ou mot de passe oublié). */
export function reinitialiserMotDePasse(
  type: TypeCompte,
  uid: string,
  token: string,
  nouveauMotDePasse: string,
): Promise<{ detail: string }> {
  return envoyerPublic(
    `${PREFIXE_MOT_DE_PASSE[type]}/reinitialiser/`,
    { uid, token, nouveau_mot_de_passe: nouveauMotDePasse },
    'Ce lien est invalide ou a expiré.',
  )
}

/** Changement du mot de passe par l'utilisateur connecté. */
export function changerMotDePasse(
  type: TypeCompte,
  ancienMotDePasse: string,
  nouveauMotDePasse: string,
): Promise<{ detail: string }> {
  const chemin = type === 'conducteur' ? '/conducteur/moi/mot-de-passe/' : '/auth/mot-de-passe/changer/'
  return authorizedFetch(chemin, {
    method: 'POST',
    body: JSON.stringify({ ancien_mot_de_passe: ancienMotDePasse, nouveau_mot_de_passe: nouveauMotDePasse }),
  })
}

interface LoginResponse {
  access: string
  refresh?: string
}

/**
 * Authentification — branche sur l'endpoint JWT du backend Django/DRF.
 * Adapter le chemin ('/auth/login/') et la forme de la réponse une fois
 * l'API réelle connue (ex. djangorestframework-simplejwt renvoie
 * { access, refresh } par défaut sur /api/token/).
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(body?.detail ?? 'Email ou mot de passe incorrect.', res.status)
  }

  return res.json()
}

interface ConducteurLoginResponse {
  access: string
  refresh: string
}

/**
 * Authentification conducteur — endpoint distinct de login() ci-dessus : les comptes
 * Conducteur vivent dans un modèle Django séparé d'Administrateur (autre table, autre
 * pk), avec son propre système de tokens (voir apps/conducteurs/views.py,
 * ConnexionConducteurView / _construire_refresh). Ne pas réutiliser login() pour ce rôle.
 */
export async function loginConducteur(email: string, password: string): Promise<ConducteurLoginResponse> {
  const res = await fetch(`${API_BASE}/auth/conducteur/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(body?.detail ?? 'Email ou mot de passe incorrect.', res.status)
  }

  return res.json()
}

// ---------------------------------------------------------------------------
// Session : access token (1 h) + refresh token (1 jour), voir SIMPLE_JWT côté Django.
// AuthContext s'abonne via onSessionChange() pour suivre les renouvellements
// faits ici (refresh automatique sur 401) et les expirations de session.
// ---------------------------------------------------------------------------

const ACCESS_KEY = 'saferoad_token'
const REFRESH_KEY = 'saferoad_refresh'

type SessionListener = (access: string | null) => void
const sessionListeners = new Set<SessionListener>()

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY)
}

export function hasRefreshToken(): boolean {
  return localStorage.getItem(REFRESH_KEY) !== null
}

export function onSessionChange(listener: SessionListener): () => void {
  sessionListeners.add(listener)
  return () => sessionListeners.delete(listener)
}

export function saveSession(access: string, refresh?: string) {
  localStorage.setItem(ACCESS_KEY, access)
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
  else localStorage.removeItem(REFRESH_KEY)
  sessionListeners.forEach((listener) => listener(access))
}

export function clearSession() {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
  sessionListeners.forEach((listener) => listener(null))
}

// Conducteur et Administrateur ont chacun leurs endpoints refresh/logout
// (claim `type_compte`, voir apps/conducteurs/views.py et apps/comptes/serializers.py).
function authPath(refreshToken: string, action: 'refresh' | 'logout'): string {
  const isConducteur = decodeJwt(refreshToken)?.type_compte === 'conducteur'
  return isConducteur ? `/auth/conducteur/${action}/` : `/auth/${action}/`
}

let pendingRefresh: Promise<string | null> | null = null

/**
 * Renouvelle l'access token. Les appels simultanés partagent la même requête :
 * côté admin le refresh est à usage unique (ROTATE_REFRESH_TOKENS + blacklist),
 * deux envois parallèles feraient échouer le second. Renvoie null si la session
 * est terminée (refresh absent, expiré ou révoqué) — elle est alors effacée.
 */
export function refreshSession(): Promise<string | null> {
  pendingRefresh ??= doRefresh().finally(() => {
    pendingRefresh = null
  })
  return pendingRefresh
}

async function doRefresh(): Promise<string | null> {
  const refresh = localStorage.getItem(REFRESH_KEY)
  if (!refresh) {
    clearSession()
    return null
  }

  let res: Response
  try {
    res = await fetch(`${API_BASE}${authPath(refresh, 'refresh')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    })
  } catch {
    // Réseau indisponible : on garde la session, le prochain appel réessaiera.
    return null
  }

  if (!res.ok) {
    clearSession()
    return null
  }

  // L'admin reçoit un nouveau refresh (rotation), le conducteur garde le sien.
  const data = (await res.json()) as { access: string; refresh?: string }
  saveSession(data.access, data.refresh ?? refresh)
  return data.access
}

/** Déconnexion : efface la session locale puis révoque le refresh côté serveur (au mieux). */
export function logoutSession() {
  const access = getAccessToken()
  const refresh = localStorage.getItem(REFRESH_KEY)
  clearSession()
  if (!access || !refresh) return
  fetch(`${API_BASE}${authPath(refresh, 'logout')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access}` },
    body: JSON.stringify({ refresh }),
  }).catch(() => {})
}

async function authorizedFetch<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const token = getAccessToken()

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  // Access token expiré : un seul renouvellement puis on rejoue la requête.
  if (res.status === 401 && retry && (await refreshSession())) {
    return authorizedFetch<T>(path, options, false)
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(messageErreur(body, 'Une erreur est survenue.'), res.status)
  }

  if (res.status === 204) return null as T
  return res.json()
}

// ---------------------------------------------------------------------------
// Boîtiers et incidents (supervision en direct). Les boîtiers publient en MQTT ; le backend
// (python manage.py ecouter_mqtt) les enregistre, le frontend les lit ici.
// ---------------------------------------------------------------------------

export interface BoitierApi {
  id: string
  numero_immatriculation: string
  region: string | null
  region_libelle: string | null
  statut: 'actif' | 'inactif' | 'maintenance'
  statut_libelle: string
  derniere_latitude: number | null
  derniere_longitude: number | null
  derniere_localisation_maj: string | null
  derniere_vitesse_gps: number | null
  dernier_hdop: number | null
  dernier_nombre_satellites: number | null
  derniere_communication: string | null
  dernier_reseau: '' | 'wifi' | 'gsm'
  en_ligne: boolean
  latence_ms: number | null
  conducteur: { id: string; nom: string; email: string } | null
  date_affectation: string | null
  date_creation: string
}

/** Tous les boîtiers visibles par le compte connecté (le backend applique le filtre régional). */
export function getBoitiers(): Promise<BoitierApi[]> {
  return authorizedFetch<BoitierApi[]>('/boitiers/')
}

export interface IncidentApi {
  id: number
  boitier: string
  latitude: number
  longitude: number
  horodatage: string
  recu_le: string
  type_incident: string
  type_incident_libelle: string
  niveau_gravite: 'faible' | 'moyen' | 'critique'
  niveau_gravite_libelle: string
  statut: string
  statut_libelle: string
  vitesse_radar: number | null
  vitesse_gps: number | null
  distance_hcsr04: number | null
  position_fiable: boolean
  zone: number | null
}

/** Les 25 incidents les plus récents (pagination par curseur côté backend). */
export async function getIncidentsRecents(): Promise<IncidentApi[]> {
  const page = await authorizedFetch<{ results: IncidentApi[] }>('/incidents/')
  return page.results
}

// ---------------------------------------------------------------------------
// Retours officiels ANASER (modèle AlerteAnaser — apps/anaser côté Django).
// POST réservé au rôle `anaser` côté backend ; les autres méthodes suivent
// le même schéma REST que le reste de l'API (apps/incidents, apps/zones).
// ---------------------------------------------------------------------------

export type ActionPrevueApi = 'signalisation' | 'ralentisseur' | 'eclairage' | 'autre'
export type StatutRetourApi = 'nouveau' | 'en_cours' | 'traite'

export interface AlerteAnaserPayload {
  cibleType: 'zone' | 'incident'
  cibleLabel: string
  actionPrevue: ActionPrevueApi
  commentaire: string
}

export interface AlerteAnaser extends AlerteAnaserPayload {
  id: string
  statut: StatutRetourApi
  createdAt: string
}

export function getAlertesAnaser(): Promise<AlerteAnaser[]> {
  return authorizedFetch<AlerteAnaser[]>('/alertes-anaser/')
}

export function createAlerteAnaser(payload: AlerteAnaserPayload): Promise<AlerteAnaser> {
  return authorizedFetch<AlerteAnaser>('/alertes-anaser/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateAlerteAnaser(id: string, payload: Partial<AlerteAnaserPayload>): Promise<AlerteAnaser> {
  return authorizedFetch<AlerteAnaser>(`/alertes-anaser/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteAlerteAnaser(id: string): Promise<null> {
  return authorizedFetch<null>(`/alertes-anaser/${id}/`, { method: 'DELETE' })
}
