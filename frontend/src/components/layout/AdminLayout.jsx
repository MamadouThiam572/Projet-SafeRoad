import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { AdminProvider } from '../../context/AdminContext'
import { useAdmin } from '../../hooks/useAdmin'
import { useAuth } from '../../hooks/useAuth'
import { Icone } from '../communs/Icone'

const LIENS = [
  { to: '/admin/dashboard', libelle: 'Tableau de bord', icone: 'tableau' },
  { to: '/admin/zones', libelle: 'Zones', icone: 'zone', compteur: 'zonesEnAttente', ton: 'attention' },
  { to: '/admin/alertes', libelle: 'Alertes', icone: 'alerte', compteur: 'alertesNouvelles', ton: 'critique' },
  { to: '/admin/boitiers', libelle: 'Boîtiers', icone: 'boitier' },
  { to: '/admin/configuration', libelle: 'Configuration', icone: 'configuration' },
]

// Shell de l'espace administrateur : sidebar de navigation pleine hauteur + barre du haut
// (cloche d'alertes, déconnexion) + zone de contenu (<Outlet />).
export function AdminLayout() {
  return (
    <AdminProvider>
      <div className="admin-shell">
        <BarreLaterale />
        <div className="admin-corps">
          <BarreHaut />
          <main className="admin-main">
            <div className="admin-main__contenu">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </AdminProvider>
  )
}

function BarreLaterale() {
  const { utilisateur } = useAuth()
  const { compteurs } = useAdmin()

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__entete">
        <span className="admin-sidebar__mark" aria-hidden="true"></span>
        <span className="admin-sidebar__titre">SafeRoad</span>
      </div>

      <nav className="admin-nav" aria-label="Navigation de l'espace administrateur">
        {LIENS.map((lien) => {
          const valeur = lien.compteur ? compteurs[lien.compteur] : 0
          return (
            <NavLink key={lien.to} to={lien.to} className="admin-nav__lien">
              <Icone nom={lien.icone} taille={18} className="admin-nav__icone" />
              <span className="admin-nav__libelle">{lien.libelle}</span>
              {valeur > 0 && (
                <span
                  className={`admin-nav__badge admin-nav__badge--${lien.ton}`}
                  aria-label={`${valeur} à traiter`}
                >
                  {valeur}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>

      {utilisateur && (
        <div className="admin-sidebar__pied">
          <div className="admin-sidebar__utilisateur">
            <span className="admin-sidebar__avatar" aria-hidden="true">{initiales(utilisateur)}</span>
            <div className="admin-sidebar__identite">
              <span className="admin-sidebar__nom">{nomComplet(utilisateur)}</span>
              <span className="admin-sidebar__role">Administrateur</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

// Barre du haut : cloche d'alertes avec indicateur numérique + déconnexion.
function BarreHaut() {
  const { deconnecter } = useAuth()
  const navigate = useNavigate()

  function handleDeconnexion() {
    deconnecter()
    navigate('/login')
  }

  return (
    <header className="admin-topbar">
      <span className="admin-topbar__marque">Espace administrateur</span>
      <div className="admin-topbar__actions">
        <ClocheAlertes />
        <button type="button" className="admin-deconnexion" onClick={handleDeconnexion}>
          <Icone nom="deconnexion" taille={16} />
          <span className="admin-deconnexion__libelle">Déconnexion</span>
        </button>
      </div>
    </header>
  )
}

// Cloche de notification : compteur d'alertes nouvelles, cliquable vers la page Alertes.
function ClocheAlertes() {
  const { compteurs } = useAdmin()
  const nombre = compteurs.alertesNouvelles ?? 0
  const libelle =
    nombre > 0 ? `${nombre} alerte${nombre > 1 ? 's' : ''} nouvelle${nombre > 1 ? 's' : ''}` : 'Aucune alerte nouvelle'

  return (
    <NavLink
      to="/admin/alertes"
      className={`admin-cloche${nombre > 0 ? ' admin-cloche--active' : ''}`}
      aria-label={libelle}
      title={libelle}
    >
      <Icone nom="cloche" taille={20} />
      {nombre > 0 && <span className="admin-cloche__pastille">{nombre > 99 ? '99+' : nombre}</span>}
    </NavLink>
  )
}

function nomComplet(utilisateur) {
  const complet = `${utilisateur.prenom ?? ''} ${utilisateur.nom ?? ''}`.trim()
  return complet || utilisateur.email
}

function initiales(utilisateur) {
  const p = (utilisateur.prenom ?? '').trim()
  const n = (utilisateur.nom ?? '').trim()
  const deux = `${p.charAt(0)}${n.charAt(0)}`.trim()
  return (deux || (utilisateur.email ?? '?').charAt(0)).toUpperCase()
}
