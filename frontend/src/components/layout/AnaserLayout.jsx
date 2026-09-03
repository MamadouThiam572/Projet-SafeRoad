import { useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { CompteursAnaserProvider } from '../../context/CompteursAnaserContext'
import { useAuth } from '../../hooks/useAuth'
import { useCompteursAnaser } from '../../hooks/useCompteursAnaser'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { AvatarMenu } from '../communs/AvatarMenu'
import { Icone } from '../communs/Icone'
import { ThemeToggle } from '../communs/ThemeToggle'
import { AdminFooter } from './AdminFooter'

const GROUPES_NAV = [
  { titre: null, liens: [{ to: '/anaser/dashboard', libelle: 'Tableau de bord', icone: 'tableau' }] },
  {
    titre: 'Suivi',
    liens: [
      { to: '/anaser/zones', libelle: 'Zones', icone: 'zone', compteur: 'zonesCritiques', ton: 'critique' },
      { to: '/anaser/feedback', libelle: 'Feedback', icone: 'boite', compteur: 'feedbacksEnAttente', ton: 'attention' },
    ],
  },
]

const TITRE_PAR_SEGMENT = {
  dashboard: 'Tableau de bord',
  zones: 'Zones',
  feedback: 'Feedback',
  profil: 'Mon profil',
}

// Shell de l'espace ANASER : même structure que AdminLayout (header + sidebar 280px en
// tiroir sous 1024px + pied de page), réutilise les classes admin-* pour rester
// visuellement cohérent avec l'admin.
export function AnaserLayout() {
  const [menuOuvert, setMenuOuvert] = useState(false)

  return (
    <CompteursAnaserProvider>
      <a href="#contenu-principal" className="skip-link">Aller au contenu principal</a>
      <div className="admin-shell">
        <BarreLaterale ouverte={menuOuvert} onFermer={() => setMenuOuvert(false)} />
        <div className="admin-corps">
          <BarreHaut menuOuvert={menuOuvert} onBasculerMenu={() => setMenuOuvert((v) => !v)} />
          <main id="contenu-principal" className="admin-main">
            <div className="admin-main__contenu">
              <Outlet />
            </div>
          </main>
          <AdminFooter />
        </div>
      </div>
    </CompteursAnaserProvider>
  )
}

function BarreLaterale({ ouverte, onFermer }) {
  const { utilisateur } = useAuth()
  const { compteurs } = useCompteursAnaser()
  const sidebarRef = useRef(null)
  useFocusTrap(sidebarRef, ouverte, onFermer)

  return (
    <>
      <div
        className={`admin-drawer-voile${ouverte ? ' admin-drawer-voile--visible' : ''}`}
        onClick={onFermer}
        aria-hidden="true"
      />
      <aside
        ref={sidebarRef}
        className={`admin-sidebar ${ouverte ? 'admin-sidebar--ouverte' : 'admin-sidebar--fermee'}`}
        aria-label="Navigation de l'espace ANASER"
        aria-hidden={!ouverte && undefined}
      >
        <div className="admin-sidebar__entete">
          <span className="admin-sidebar__mark" aria-hidden="true"></span>
          <span className="admin-sidebar__titre">SafeRoad</span>
        </div>

        <nav className="admin-nav">
          {GROUPES_NAV.map((groupe) => (
            <div key={groupe.titre ?? 'principal'}>
              {groupe.titre && <div className="admin-nav__groupe-titre">{groupe.titre}</div>}
              {groupe.liens.map((lien) => {
                const valeur = lien.compteur ? compteurs[lien.compteur] : 0
                return (
                  <NavLink key={lien.to} to={lien.to} className="admin-nav__lien" onClick={onFermer}>
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
            </div>
          ))}
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
    </>
  )
}

function BarreHaut({ menuOuvert, onBasculerMenu }) {
  const { utilisateur, deconnecter } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const segment = location.pathname.split('/')[2]
  const titrePage = TITRE_PAR_SEGMENT[segment] ?? 'SafeRoad'

  function handleDeconnexion() {
    deconnecter()
    navigate('/login')
  }

  return (
    <header className="admin-topbar">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          className="admin-menu-bouton"
          onClick={onBasculerMenu}
          aria-label={menuOuvert ? 'Fermer le menu de navigation' : 'Ouvrir le menu de navigation'}
          aria-expanded={menuOuvert}
        >
          <Icone nom={menuOuvert ? 'fermer' : 'menu'} taille={20} />
        </button>
        <span className="admin-topbar__marque truncate lg:hidden">{titrePage}</span>
        <span className="admin-topbar__marque hidden lg:inline">Espace ANASER</span>
      </div>
      <div className="admin-topbar__actions">
        <ThemeToggle />
        {utilisateur && (
          <AvatarMenu
            utilisateur={utilisateur}
            roleLibelle="Agent ANASER"
            lienProfil="/anaser/profil"
            onDeconnexion={handleDeconnexion}
          />
        )}
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
