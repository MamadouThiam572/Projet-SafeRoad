import { Navigate } from 'react-router-dom'
import { Loader } from '../components/communs/Loader'
import { useAuth } from '../hooks/useAuth'

export function RouteProtegee({ rolesAutorises, children }) {
  const { estAuthentifie, utilisateur, chargementInitial } = useAuth()

  if (chargementInitial) {
    return <Loader />
  }
  if (!estAuthentifie) {
    return <Navigate to="/login" replace />
  }
  if (rolesAutorises && !rolesAutorises.includes(utilisateur.role)) {
    return <Navigate to="/" replace />
  }
  return children
}
