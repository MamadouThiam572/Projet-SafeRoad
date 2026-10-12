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

/**
 * Zones de la carte publique : uniquement celles reconnues par l'ANASER (règle du backend pour
 * un visiteur). Appel volontairement SANS jeton, même connecté : un compte de gestion verrait
 * sinon aussi les zones encore en validation.
 */
export async function getZonesPubliques(): Promise<ZoneApi[]> {
  const res = await fetch(`${API_BASE}/zones/`)
  if (!res.ok) throw new ApiError('Carte indisponible pour le moment.', res.status)
  return res.json()
}

export type SujetContact = 'question' | 'signalement' | 'suggestion' | 'partenariat' | 'support' | 'autre'

/** Formulaire public Contact (sans compte, limité par IP) : lu par le super admin. */
export function envoyerMessageContact(donnees: { nom: string; email: string; telephone?: string; sujet: SujetContact; message: string }): Promise<{ id: number }> {
  return envoyerPublic('/messages-contact/', donnees, 'Envoi impossible pour le moment.')
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
      // Un FormData (photo jointe) porte son propre Content-Type multipart, avec sa frontière.
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
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

/** Enregistrement : le backend génère l'UUID et la clé API, renvoyée UNE SEULE fois (`api_key`). */
export function creerBoitier(donnees: { region: string; numero_immatriculation?: string }): Promise<BoitierApi & { api_key: string }> {
  return authorizedFetch('/boitiers/', { method: 'POST', body: JSON.stringify(donnees) })
}

export function modifierBoitier(
  id: string,
  donnees: Partial<{ region: string; numero_immatriculation: string; statut: BoitierApi['statut'] }>,
): Promise<BoitierApi> {
  return authorizedFetch(`/boitiers/${id}/`, { method: 'PATCH', body: JSON.stringify(donnees) })
}

export function affecterBoitier(id: string, conducteur: string): Promise<BoitierApi> {
  return authorizedFetch(`/boitiers/${id}/affecter/`, { method: 'POST', body: JSON.stringify({ conducteur }) })
}

export function desaffecterBoitier(id: string): Promise<BoitierApi> {
  return authorizedFetch(`/boitiers/${id}/desaffecter/`, { method: 'POST', body: '{}' })
}

/** Nouvelle clé API (l'ancienne reste valable 24 h, le temps de reconfigurer le boîtier). */
export function regenererCleBoitier(id: string): Promise<{ id: string; api_key: string; ancienne_cle_valide_jusqu_a: string }> {
  return authorizedFetch(`/boitiers/${id}/regenerer-cle/`, { method: 'POST', body: '{}' })
}

export interface HistoriqueBoitierApi {
  id: number
  evenement: 'enregistre' | 'affecte' | 'desaffecte'
  evenement_libelle: string
  conducteur_nom: string | null
  acteur_nom: string | null
  role_acteur: string
  commentaire: string
  date: string
}

export function getHistoriqueBoitier(id: string): Promise<HistoriqueBoitierApi[]> {
  return authorizedFetch(`/boitiers/${id}/historique/`)
}

export interface ConducteurApi {
  id: string
  email: string
  nom: string
  prenom: string
  telephone: string
  boitier: string | null
  numero_immatriculation: string | null
  /** Région du boîtier porté ; null pour un conducteur sans boîtier. */
  region: string | null
  is_active: boolean
}

/** Comptes conducteurs (admins) : super admin tous, admin régional sa région + les non équipés. */
export function getConducteurs(): Promise<ConducteurApi[]> {
  return authorizedFetch('/conducteurs/')
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
  hdop?: number | null
  nombre_satellites?: number | null
  position_fiable: boolean
  zone: number | null
}

export type StatutIncidentApi = 'nouveau' | 'en_cours' | 'valide' | 'cloture' | 'rejete'

export interface HistoriqueIncidentApi {
  id: number
  statut_precedent_libelle: string
  statut_nouveau: string
  statut_nouveau_libelle: string
  texte: string
  acteur_nom: string | null
  role_acteur: string
  date: string
}

/**
 * Incidents les plus récents (périmètre du compte), en suivant la pagination par curseur du
 * backend (25 par page) jusqu'à `max` incidents.
 */
export async function getIncidents(max = 300): Promise<IncidentApi[]> {
  const resultats: IncidentApi[] = []
  let chemin: string | null = '/incidents/'
  while (chemin && resultats.length < max) {
    const page: { results: IncidentApi[]; next: string | null } = await authorizedFetch(chemin)
    resultats.push(...page.results)
    chemin = page.next ? `/incidents/${new URL(page.next).search}` : null
  }
  return resultats.slice(0, max)
}

export function changerStatutIncident(id: number, statut: StatutIncidentApi, commentaire = ''): Promise<IncidentApi> {
  return authorizedFetch(`/incidents/${id}/statut/`, { method: 'PATCH', body: JSON.stringify({ statut, commentaire }) })
}

export function ajouterObservationIncident(id: number, texte: string): Promise<unknown> {
  return authorizedFetch(`/incidents/${id}/observations/`, { method: 'POST', body: JSON.stringify({ texte }) })
}

export function getHistoriqueIncident(id: number): Promise<HistoriqueIncidentApi[]> {
  return authorizedFetch(`/incidents/${id}/historique/`)
}

/** Les 25 incidents les plus récents (pagination par curseur côté backend). */
export async function getIncidentsRecents(): Promise<IncidentApi[]> {
  const page = await authorizedFetch<{ results: IncidentApi[] }>('/incidents/')
  return page.results
}

// ---------------------------------------------------------------------------
// Zones à risque et circuit de validation : proposée -> (vérification) -> validée techniquement
// (admin) -> soumise à l'ANASER -> reconnue (seule une zone reconnue est publique et déclenche
// les alertes conducteurs). Le backend refuse toute transition non permise au rôle.
// ---------------------------------------------------------------------------

export type StatutZone =
  | 'proposee'
  | 'en_verification'
  | 'validee_technique'
  | 'soumise_anaser'
  | 'reconnue'
  | 'rejetee'
  | 'archivee'

export interface ZoneApi {
  id: number
  nom: string
  region: string | null
  region_libelle: string | null
  latitude_centre: number
  longitude_centre: number
  rayon_metres: number
  nombre_incidents: number
  nombre_signalements: number
  score_danger: number
  niveau_danger: 'normale' | 'vigilance' | 'critique'
  niveau_danger_libelle: string
  statut_validation: StatutZone
  statut_validation_libelle: string
  actif: boolean
  date_creation: string
  date_maj: string
}

export interface HistoriqueZoneApi {
  id: number
  statut_precedent: StatutZone
  statut_precedent_libelle: string
  statut_nouveau: StatutZone
  statut_nouveau_libelle: string
  acteur_nom: string | null
  role_acteur: string
  commentaire: string
  date: string
}

/** Zones visibles du compte : sa région pour l'admin régional, tout le pays sinon. */
export function getZones(): Promise<ZoneApi[]> {
  return authorizedFetch('/zones/')
}

export function changerStatutZone(id: number, statut: StatutZone, commentaire = ''): Promise<ZoneApi> {
  return authorizedFetch(`/zones/${id}/statut/`, {
    method: 'PATCH',
    body: JSON.stringify({ statut_validation: statut, commentaire }),
  })
}

/** Recalcule les zones depuis les incidents des boîtiers (super admin) ; ne touche pas aux statuts. */
export function genererZones(): Promise<{ zones_creees: number; zones_mises_a_jour: number; incidents_traites: number }> {
  return authorizedFetch('/zones/generer/', { method: 'POST' })
}

export function getHistoriqueZone(id: number): Promise<HistoriqueZoneApi[]> {
  return authorizedFetch(`/zones/${id}/historique/`)
}

// ---------------------------------------------------------------------------
// Alertes. Admin : fil à traiter (incidents moyens/critiques, incidents en zone reconnue,
// boîtiers hors ligne), limité à sa région par le backend. Conducteur : alertes « zone à
// risque » reçues pendant qu'il portait le boîtier (zones reconnues par l'ANASER seulement).
// ---------------------------------------------------------------------------

export type StatutAlerte = 'nouvelle' | 'en_cours' | 'traitee'

export interface AlerteApi {
  id: number
  source: 'zone' | 'vehicule' | 'boitier'
  niveau: 'vigilance' | 'critique'
  motif: 'incident' | 'hors_ligne'
  statut: StatutAlerte
  titre: string
  description: string
  lieu: string | null
  vehicule: { boitier: string; immatriculation: string | null; conducteur: string | null } | null
  date_creation: string
}

export function getAlertes(): Promise<AlerteApi[]> {
  return authorizedFetch('/alertes/')
}

export function changerStatutAlerte(id: number, statut: StatutAlerte): Promise<AlerteApi> {
  return authorizedFetch(`/alertes/${id}/statut/`, { method: 'PATCH', body: JSON.stringify({ statut }) })
}

export interface AlerteConducteurApi {
  id: number
  zone: number
  zone_nom: string
  niveau_danger: 'normale' | 'vigilance' | 'critique'
  region_libelle: string | null
  distance_metres: number
  canal_led: 'vert' | 'jaune' | 'rouge'
  canal_buzzer_declenche: boolean
  canal_audio_declenche: boolean
  date_creation: string
}

export function getAlertesConducteur(): Promise<AlerteConducteurApi[]> {
  return authorizedFetch('/conducteur/alertes/')
}

// ---------------------------------------------------------------------------
// Signalements : dangers déclarés par les conducteurs (position du téléphone, photo
// facultative). La région est déduite du GPS par le backend. Un signalement validé ne fait
// que renforcer une zone : les données des boîtiers restent prioritaires.
// ---------------------------------------------------------------------------

export type TypeDanger = 'nid_de_poule' | 'chaussee_degradee' | 'signalisation_absente' | 'chaussee_inondee' | 'obstacle' | 'autre'
export type StatutSignalementApi = 'a_verifier' | 'en_verification' | 'valide' | 'rejete'

export interface SignalementApi {
  id: number
  conducteur?: string | null
  conducteur_nom?: string | null
  boitier: string | null
  type_danger: TypeDanger
  type_danger_libelle: string
  description: string
  latitude: number
  longitude: number
  precision_metres: number | null
  region: string
  region_libelle: string
  localite: string
  photo_url: string | null
  statut: StatutSignalementApi
  statut_libelle: string
  date_creation: string
  date_maj: string
}

export interface HistoriqueSignalementApi {
  id: number
  statut_precedent_libelle: string
  statut_nouveau: StatutSignalementApi
  statut_nouveau_libelle: string
  acteur_nom: string | null
  role_acteur: string
  commentaire: string
  date: string
}

export interface IncidentsProchesApi {
  rayon_metres: number
  nombre: number
  incidents: { id: number; type_incident_libelle: string; niveau_gravite_libelle: string; horodatage: string; distance_metres: number }[]
}

/** Conducteur : les siens ; admin régional : sa région ; super admin et ANASER : tous. */
export function getSignalements(): Promise<SignalementApi[]> {
  return authorizedFetch('/signalements/')
}

/** `donnees` : type_danger, description, latitude, longitude, precision_metres, localite, photo. */
export function creerSignalement(donnees: FormData): Promise<SignalementApi> {
  return authorizedFetch('/signalements/', { method: 'POST', body: donnees })
}

export function supprimerSignalement(id: number): Promise<null> {
  return authorizedFetch(`/signalements/${id}/`, { method: 'DELETE' })
}

export function changerStatutSignalement(id: number, statut: StatutSignalementApi, commentaire = ''): Promise<SignalementApi> {
  return authorizedFetch(`/signalements/${id}/statut/`, { method: 'PATCH', body: JSON.stringify({ statut, commentaire }) })
}

export function getHistoriqueSignalement(id: number): Promise<HistoriqueSignalementApi[]> {
  return authorizedFetch(`/signalements/${id}/historique/`)
}

export function getIncidentsProches(id: number): Promise<IncidentsProchesApi> {
  return authorizedFetch(`/signalements/${id}/incidents-proches/`)
}

/**
 * La photo n'est servie qu'avec le jeton (jamais en accès public) : une balise <img> ne peut
 * pas l'envoyer, on la télécharge donc ici et on renvoie une adresse locale (blob:).
 */
export async function chargerPhotoSignalement(url: string): Promise<string> {
  const appel = (jeton: string | null) => fetch(url, { headers: jeton ? { Authorization: `Bearer ${jeton}` } : {} })
  let res = await appel(getAccessToken())
  if (res.status === 401 && (await refreshSession())) res = await appel(getAccessToken())
  if (!res.ok) throw new ApiError('Photo indisponible.', res.status)
  return URL.createObjectURL(await res.blob())
}

// ---------------------------------------------------------------------------
// Comptes du personnel (super admin uniquement). Pas de mot de passe à la création : la
// personne reçoit une invitation par e-mail. Pas de suppression : on désactive le compte.
// ---------------------------------------------------------------------------

export interface AdministrateurApi {
  id: string | number
  email: string
  nom: string
  prenom: string
  telephone: string
  role: 'admin' | 'super_admin' | 'anaser'
  region: string | null
  is_active: boolean
  derniere_connexion: string | null
  date_creation: string
}

export type AdministrateurSaisie = Pick<AdministrateurApi, 'email' | 'nom' | 'prenom' | 'telephone' | 'role' | 'region'>

export function getAdministrateurs(): Promise<AdministrateurApi[]> {
  return authorizedFetch('/administrateurs/')
}

export function creerAdministrateur(donnees: AdministrateurSaisie): Promise<AdministrateurApi> {
  return authorizedFetch('/administrateurs/', { method: 'POST', body: JSON.stringify(donnees) })
}

export function modifierAdministrateur(id: string, donnees: Partial<AdministrateurSaisie & { is_active: boolean }>): Promise<AdministrateurApi> {
  return authorizedFetch(`/administrateurs/${id}/`, { method: 'PATCH', body: JSON.stringify(donnees) })
}

export function envoyerLienAdministrateur(id: string): Promise<{ detail: string }> {
  return authorizedFetch(`/administrateurs/${id}/reinitialiser-mot-de-passe/`, { method: 'POST' })
}

// ---------------------------------------------------------------------------
// Demandes d'installation (admin de la région demandée + super admin) et messages de contact
// (super admin). L'installation crée le compte conducteur (invitation par e-mail) et le boîtier,
// et renvoie UNE SEULE FOIS sa clé API.
// ---------------------------------------------------------------------------

export type StatutDemande = 'nouvelle' | 'contactee' | 'rdv_planifie' | 'installee' | 'annulee'

export interface DemandeInstallationApi {
  id: number
  nom: string
  prenom: string
  telephone: string
  email: string
  region: string
  region_libelle: string
  commune: string
  adresse: string
  type_vehicule: TypeVehicule
  type_vehicule_libelle: string
  immatriculation: string
  nombre_vehicules: number
  disponibilites: string
  message: string
  contact_urgence_nom: string
  contact_urgence_telephone: string
  statut: StatutDemande
  statut_libelle: string
  rdv_date: string | null
  rdv_lieu: string
  numero_cni: string
  conducteur: string | number | null
  boitier: string | null
  date_creation: string
  date_maj: string
}

export interface HistoriqueDemandeApi {
  id: number
  statut_nouveau_libelle: string
  acteur_nom: string | null
  role_acteur: string
  commentaire: string
  date: string
}

export function getDemandesInstallation(): Promise<DemandeInstallationApi[]> {
  return authorizedFetch('/demandes-installation/')
}

export function changerStatutDemande(id: number, statut: 'contactee' | 'annulee', commentaire = ''): Promise<DemandeInstallationApi> {
  return authorizedFetch(`/demandes-installation/${id}/statut/`, { method: 'PATCH', body: JSON.stringify({ statut, commentaire }) })
}

export function planifierRendezVous(id: number, donnees: { rdv_date: string; rdv_lieu: string; commentaire?: string }): Promise<DemandeInstallationApi> {
  return authorizedFetch(`/demandes-installation/${id}/rendez-vous/`, { method: 'POST', body: JSON.stringify(donnees) })
}

export function enregistrerInstallation(
  id: number,
  donnees: { numero_cni: string; email?: string; immatriculation?: string; commentaire?: string },
): Promise<DemandeInstallationApi & { boitier_api_key: string }> {
  return authorizedFetch(`/demandes-installation/${id}/installer/`, { method: 'POST', body: JSON.stringify(donnees) })
}

export function getHistoriqueDemande(id: number): Promise<HistoriqueDemandeApi[]> {
  return authorizedFetch(`/demandes-installation/${id}/historique/`)
}

export interface MessageContactApi {
  id: number
  nom: string
  email: string
  telephone: string
  sujet: SujetContact
  sujet_libelle: string
  message: string
  traite: boolean
  traite_le: string | null
  date_creation: string
}

export function getMessagesContact(): Promise<MessageContactApi[]> {
  return authorizedFetch('/messages-contact/')
}

export function traiterMessageContact(id: number): Promise<MessageContactApi> {
  return authorizedFetch(`/messages-contact/${id}/traiter/`, { method: 'POST' })
}

// ---------------------------------------------------------------------------
// Tableaux de bord (GET /tableau-de-bord/) : chiffres calculés en direct par le backend, selon
// le rôle (admin régional = sa région ; super admin et ANASER = national + détail par région).
// ---------------------------------------------------------------------------

export interface SerieJourApi {
  date: string
  incidents: number
  alertes: number
  signalements: number
}

export interface RegionTableauApi {
  region: string
  libelle: string
  boitiers: number
  affectes: number
  boitiers_hors_ligne: number
  incidents: number
  alertes: number
  signalements: number
  signalements_en_attente: number
  zones_reconnues: number
  zones_en_attente: number
  admin_actif: boolean
  admins_actifs: number
}

export interface ActiviteApi {
  type: 'incident' | 'signalement' | 'boitier' | 'zone'
  titre: string
  niveau: string | null
  region: string | null
  date: string
}

export interface TableauDeBordApi {
  perimetre: { national: boolean; region: string | null; jours: number }
  indicateurs: {
    boitiers: { total: number; actifs: number; en_ligne: number; affectes: number }
    incidents: { aujourd_hui: number; hier: number; periode: number; critiques: number }
    alertes: { actives: number; nouvelles: number; periode: number }
    signalements: { periode: number; en_attente: number }
    zones: { reconnues: number; en_validation_technique: number; soumises_anaser: number }
  }
  series: SerieJourApi[]
  repartition_incidents: { type: string; libelle: string; nombre: number; pourcentage: number }[]
  zones_a_valider: { id: number; nom: string; niveau_danger: string; statut_validation: string; region: string | null; nombre_incidents: number; date_creation: string; latitude: number; longitude: number }[]
  zones_plus_dangereuses: { id: number; nom: string; niveau_danger: string; region: string | null; nombre_incidents: number; nombre_signalements: number; score_danger: number; latitude: number; longitude: number; date_maj: string }[]
  activite_recente: ActiviteApi[]
  par_region?: RegionTableauApi[]
  series_par_region?: Record<string, { incidents: number[]; alertes: number[]; signalements: number[] }>
}

export function getTableauDeBord(jours = 30, region?: string): Promise<TableauDeBordApi> {
  const params = new URLSearchParams({ jours: String(jours) })
  if (region) params.set('region', region)
  return authorizedFetch(`/tableau-de-bord/?${params}`)
}

/** Résumé du conducteur connecté (GET /conducteur/tableau-de-bord/). */
export interface TableauDeBordConducteurApi {
  jours: number
  boitier: { id: string; immatriculation: string | null; statut: string; derniere_activite: string | null; en_ligne: boolean } | null
  alertes: { total: number; critiques: number }
  signalements: { total: number; en_attente: number; valides: number }
}

export function getTableauDeBordConducteur(jours = 30): Promise<TableauDeBordConducteurApi> {
  return authorizedFetch(`/conducteur/tableau-de-bord/?jours=${jours}`)
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
