import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { decodeJwt, isJwtExpired } from '@/lib/jwt'
import type { AuthUser, UserRole } from '@/types/auth'

const TOKEN_KEY = 'saferoad_token'

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (token: string) => void
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY)
    if (stored) {
      const nextUser = userFromToken(stored)
      if (nextUser) {
        setToken(stored)
        setUser(nextUser)
      } else {
        localStorage.removeItem(TOKEN_KEY)
      }
    }
    setIsLoading(false)
  }, [])

  const login = useCallback((newToken: string) => {
    const nextUser = userFromToken(newToken)
    if (!nextUser) return
    localStorage.setItem(TOKEN_KEY, newToken)
    setToken(newToken)
    setUser(nextUser)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
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
