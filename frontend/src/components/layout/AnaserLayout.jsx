import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { AnaserProvider } from '../../context/AnaserContext'
import { useAnaser } from '../../hooks/useAnaser'
import { useAuth } from '../../hooks/useAuth'
import { Icone } from '../communs/Icone'

const LIENS = [
  { to: '/anaser/dashboard', libelle: 'Tableau de bord', icone: 'tableau' },
  { to: '/anaser/zones', libelle: 'Zones', icone: 'zone', compteur: 'zonesCritiques', ton: 'critique' },
  { to: '/anaser/feedback', libelle: 'Feedback', icone: 'boite', compteur: 'feedbacksEnAttente', ton: 'attention' },
]

// Shell de l'espace ANASER : même structure que AdminLayout (sidebar + barre du haut + <Outlet />),
// réutilise les classes admin-* de styles/admin.css pour rester visuellement cohérent avec l'admin.
export function AnaserLayout() {
  return (
    <AnaserProvider>
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
    </AnaserProvider>
  )
}

function BarreLaterale() {
  const { utilisateur } = useAuth()
  const { compteurs } = useAnaser()

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__entete">
        <span className="admin-sidebar__mark" aria-hidden="true"></span>
        <span className="admin-sidebar__titre">SafeRoad</span>
      </div>

      <nav className="admin-nav" aria-label="Navigation de l'espace ANASER">
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
              <span className="admin-sidebar__role">ANASER</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

function BarreHaut() {
  const { deconnecter } = useAuth()
  const navigate = useNavigate()

  function handleDeconnexion() {
    deconnecter()
    navigate('/login')
  }

  return (
    <header className="admin-topbar">
      <span className="admin-topbar__marque">Espace ANASER</span>
      <div className="admin-topbar__actions">
        <button type="button" className="admin-deconnexion" onClick={handleDeconnexion}>
          <Icone nom="deconnexion" taille={16} />
          <span className="admin-deconnexion__libelle">Déconnexion</span>
        </button>
      </div>
    </header>
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
