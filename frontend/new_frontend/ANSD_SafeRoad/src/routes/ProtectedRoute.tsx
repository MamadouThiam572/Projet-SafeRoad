import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import type { UserRole } from '@/types/auth'
import { PATHS } from '@/routes/paths'

interface ProtectedRouteProps {
  allowedRoles?: UserRole[]
}

/**
 * Garde-fou d'AFFICHAGE uniquement : redirige vers /connexion si
 * personne n'est authentifié, ou vers l'espace du rôle si l'utilisateur
 * n'a pas accès à cette section. Le backend reste seul juge des droits
 * réels sur chaque appel API.
 */
export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return null

  if (!isAuthenticated || !user) {
    return <Navigate to={PATHS.connexion} state={{ from: location }} replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={roleHome(user.role)} replace />
  }

  return <Outlet />
}

export function roleHome(role: UserRole): string {
  switch (role) {
    case 'conducteur':
      return PATHS.client.root
    case 'sous_admin':
      return PATHS.admin.root
    case 'anaser':
      return PATHS.anaser.root
    case 'super_admin':
      return PATHS.superAdmin.root
    default:
      return PATHS.connexion
  }
}
