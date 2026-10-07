const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

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

const TOKEN_KEY = 'saferoad_token'

async function authorizedFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY)

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

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
