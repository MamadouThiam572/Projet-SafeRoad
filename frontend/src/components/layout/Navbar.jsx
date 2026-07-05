import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export function Navbar() {
  const { estAuthentifie, utilisateur, deconnecter } = useAuth()
  const navigate = useNavigate()

  function handleDeconnexion() {
    deconnecter()
    navigate('/login')
  }

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark px-3">
      <Link className="navbar-brand" to="/">SafeRoad</Link>
      <div className="navbar-nav me-auto">
        <Link className="nav-link" to="/carte">Carte</Link>
        <Link className="nav-link" to="/statistiques">Statistiques</Link>
        {utilisateur?.role === 'admin' && (
          <Link className="nav-link" to="/admin/dashboard">Tableau de bord admin</Link>
        )}
        {utilisateur?.role === 'anaser' && (
          <Link className="nav-link" to="/anaser/dashboard">Espace ANASER</Link>
        )}
      </div>
      <div className="navbar-nav">
        {estAuthentifie ? (
          <button className="btn btn-outline-light btn-sm" onClick={handleDeconnexion}>
            Déconnexion ({utilisateur.email})
          </button>
        ) : (
          <Link className="btn btn-outline-light btn-sm" to="/login">Connexion</Link>
        )}
      </div>
    </nav>
  )
}
