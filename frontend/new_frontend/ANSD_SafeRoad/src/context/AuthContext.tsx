import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  clearSession,
  getAccessToken,
  hasRefreshToken,
  logoutSession,
  onSessionChange,
  refreshSession,
  saveSession,
} from '@/lib/api'
import { decodeJwt, isJwtExpired } from '@/lib/jwt'
import type { AuthUser, UserRole } from '@/types/auth'

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (access: string, refresh?: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/**
 * Le backend nomme le rôle Admin Régional "admin" (Administrateur.Role.ADMIN),
 * mais tout le routage frontend (ProtectedRoute, roleHome, AppRoutes) est
 * bâti sur le littéral "sous_admin" du type UserRole. Sans cette
 * normalisation, ProtectedRoute rejette un token réel avec role="admin"
 * (il ne matche aucun allowedRoles) et roleHome('admin') tombe dans son
 * cas par défaut, qui renvoie vers /connexion.
 *
 * Exportée pour que ConnexionPage.tsx (qui décode aussi le token pour
 * calculer la destination post-connexion) applique la même règle — sinon
 * on se retrouve avec deux décodages du même token qui divergent.
 */
export function normalizeRole(rawRole: unknown): UserRole {
  if (rawRole === 'admin') return 'sous_admin'
  return rawRole as UserRole
}

function userFromToken(token: string): AuthUser | null {
  const payload = decodeJwt(token)
  if (!payload || isJwtExpired(payload)) return null
  return {
    // Le token réel du backend n'a pas de champ "sub" (il utilise "user_id").
    // "sub" reste géré pour compatibilité avec le faux token de dev.
    id: String((payload as Record<string, unknown>).sub ?? (payload as Record<string, unknown>).user_id ?? ''),
    email: payload.email,
    // Le backend réel envoie nom/prénom en français (nom = Thiam, prenom = Mamadou).
    // first_name/last_name ne restent utilisés que par le faux token de dev.
    firstName: String((payload as Record<string, unknown>).prenom ?? (payload as Record<string, unknown>).first_name ?? ''),
    lastName: String((payload as Record<string, unknown>).nom ?? (payload as Record<string, unknown>).last_name ?? ''),
    role: normalizeRole(payload.role),
    region: payload.region,
  }
}

// Renouvellement un peu avant l'expiration, pour qu'aucune requête ne parte avec un token mort.
const REFRESH_MARGIN_MS = 60_000

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Le stockage des tokens vit dans lib/api.ts (qui les renouvelle aussi sur 401) :
  // ce contexte se contente de refléter chaque changement de session.
  useEffect(() => {
    const unsubscribe = onSessionChange((access) => {
      const nextUser = access ? userFromToken(access) : null
      setToken(nextUser ? access : null)
      setUser(nextUser)
    })

    const stored = getAccessToken()
    const storedUser = stored ? userFromToken(stored) : null
    if (stored && storedUser) {
      setToken(stored)
      setUser(storedUser)
      setIsLoading(false)
    } else if (hasRefreshToken()) {
      // Access expiré (ex. onglet rouvert le lendemain) : on tente de prolonger la session.
      refreshSession().finally(() => setIsLoading(false))
    } else {
      if (stored) clearSession()
      setIsLoading(false)
    }

    return unsubscribe
  }, [])

  useEffect(() => {
    const exp = token ? decodeJwt(token)?.exp : undefined
    if (!exp) return
    const delay = Math.max(exp * 1000 - Date.now() - REFRESH_MARGIN_MS, 0)
    const id = setTimeout(() => {
      // Sans refresh token (ex. faux token de dev), la session se termine à l'expiration.
      if (hasRefreshToken()) refreshSession()
      else clearSession()
    }, delay)
    return () => clearTimeout(id)
  }, [token])

  const login = useCallback((access: string, refresh?: string) => {
    if (!userFromToken(access)) return
    saveSession(access, refresh)
  }, [])

  const logout = useCallback(() => {
    logoutSession()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, isAuthenticated: !!user, isLoading, login, logout }),
    [user, token, isLoading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans un <AuthProvider>')
  return ctx
}
