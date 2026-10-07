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
    throw new ApiError(body?.detail ?? 'Une erreur est survenue.', res.status)
  }

  if (res.status === 204) return null as T
  return res.json()
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
