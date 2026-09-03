import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { CompteursAdminProvider } from '../../context/CompteursAdminContext'
import { useAuth } from '../../hooks/useAuth'
import { useCompteursAdmin } from '../../hooks/useCompteursAdmin'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { listerBoitiers } from '../../services/boitiersService'
import { listerZones } from '../../services/zonesService'
import { AvatarMenu } from '../communs/AvatarMenu'
import { Icone } from '../communs/Icone'
import { ThemeToggle } from '../communs/ThemeToggle'
import { AdminFooter } from './AdminFooter'

const GROUPES_NAV = [
  { titre: null, liens: [{ to: '/admin/dashboard', libelle: 'Tableau de bord', icone: 'tableau' }] },
  {
    titre: 'Gestion',
    liens: [
      { to: '/admin/zones', libelle: 'Zones', icone: 'zone', compteur: 'zonesEnAttente', ton: 'attention' },
      { to: '/admin/alertes', libelle: 'Alertes', icone: 'alerte', compteur: 'alertesNouvelles', ton: 'critique' },
      { to: '/admin/boitiers', libelle: 'Boîtiers', icone: 'boitier' },
      { to: '/admin/evenements', libelle: 'Événements', icone: 'incidents' },
    ],
  },
  { titre: 'Système', liens: [{ to: '/admin/configuration', libelle: 'Configuration', icone: 'configuration' }] },
]

const TITRE_PAR_SEGMENT = {
  dashboard: 'Tableau de bord',
  zones: 'Zones',
  alertes: 'Alertes',
  boitiers: 'Boîtiers',
  evenements: 'Événements',
  configuration: 'Configuration',
  profil: 'Mon profil',
}

// Shell de l'espace administrateur : header 64px + sidebar 280px (tiroir sous 1024px,
// piège à focus + voile + verrouillage du scroll) + pied de page collapsible.
export function AdminLayout() {
  const [menuOuvert, setMenuOuvert] = useState(false)

  return (
    <CompteursAdminProvider>
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
    </CompteursAdminProvider>
  )
}

function BarreLaterale({ ouverte, onFermer }) {
  const { utilisateur } = useAuth()
  const { compteurs } = useCompteursAdmin()
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
        aria-label="Navigation de l'espace administrateur"
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
                <span className="admin-sidebar__role">Administrateur</span>
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
      <div className="admin-topbar__gauche">
        <button
          type="button"
          className="admin-menu-bouton"
          onClick={onBasculerMenu}
          aria-label={menuOuvert ? 'Fermer le menu de navigation' : 'Ouvrir le menu de navigation'}
          aria-expanded={menuOuvert}
        >
          <Icone nom={menuOuvert ? 'fermer' : 'menu'} taille={20} />
        </button>
        <div className="admin-topbar__bienvenue">
          <span className="admin-topbar__salutation">Bonjour{utilisateur?.prenom ? `, ${utilisateur.prenom}` : ''}</span>
          <span className="admin-topbar__contexte">{titrePage}</span>
        </div>
      </div>
      <RechercheAdmin />
      <div className="admin-topbar__actions">
        <FraicheurDonnees />
        <ThemeToggle />
        <ClocheAlertes />
        {utilisateur && (
          <AvatarMenu
            utilisateur={utilisateur}
            roleLibelle="Administrateur"
            lienProfil="/admin/profil"
            onDeconnexion={handleDeconnexion}
          />
        )}
      </div>
    </header>
  )
}

// Recherche rapide dans la topbar : zones et boîtiers chargés une seule fois (au premier
// caractère saisi) puis filtrés côté client — ni l'un ni l'autre endpoint n'a de recherche
// serveur, et les volumes de cet outil interne restent raisonnables pour ça.
function RechercheAdmin() {
  const [requete, setRequete] = useState('')
  const [ouvert, setOuvert] = useState(false)
  const [donnees, setDonnees] = useState(null)
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState(false)
  const conteneurRef = useRef(null)

  useEffect(() => {
    if (!ouvert) return
    function onClicExterieur(e) {
      if (!conteneurRef.current?.contains(e.target)) setOuvert(false)
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setOuvert(false)
    }
    document.addEventListener('mousedown', onClicExterieur)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClicExterieur)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [ouvert])

  function chargerDonnees() {
    if (donnees || chargement) return
    setChargement(true)
    Promise.all([listerZones(), listerBoitiers()])
      .then(([zones, boitiers]) => {
        setDonnees({ zones, boitiers })
        setErreur(false)
      })
      .catch(() => setErreur(true))
      .finally(() => setChargement(false))
  }

  const requeteNormalisee = requete.trim().toLowerCase()
  const resultats =
    donnees && requeteNormalisee.length >= 2
      ? [
          ...donnees.zones
            .filter((z) => (z.nom ?? '').toLowerCase().includes(requeteNormalisee))
            .slice(0, 5)
            .map((z) => ({
              cle: `zone-${z.id}`,
              type: 'Zone',
              titre: z.nom || `Zone #${z.id}`,
              sousTitre: z.niveau_danger_libelle,
              to: '/admin/zones',
            })),
          ...donnees.boitiers
            .filter(
              (b) =>
                (b.numero_immatriculation ?? '').toLowerCase().includes(requeteNormalisee) ||
                (b.proprietaire_nom ?? '').toLowerCase().includes(requeteNormalisee),
            )
            .slice(0, 5)
            .map((b) => ({
              cle: `boitier-${b.id}`,
              type: 'Boîtier',
              titre: b.numero_immatriculation || `Boîtier ${b.id.slice(0, 8)}`,
              sousTitre: b.proprietaire_nom,
              to: '/admin/boitiers',
            })),
        ]
      : []

  return (
    <div className="admin-topbar__recherche-conteneur relative" ref={conteneurRef}>
      <div className="admin-topbar__recherche" role="search">
        <Icone nom="recherche" taille={17} aria-hidden="true" />
        <input
          type="search"
          aria-label="Rechercher dans l'administration"
          placeholder="Rechercher un boîtier, une zone…"
          value={requete}
          onFocus={() => {
            setOuvert(true)
            chargerDonnees()
          }}
          onChange={(e) => {
            setRequete(e.target.value)
            setOuvert(true)
            chargerDonnees()
          }}
        />
      </div>

      {ouvert && requeteNormalisee.length >= 2 && (
        <div role="listbox" className="absolute left-0 right-0 z-20 mt-2 max-h-80 overflow-y-auto rounded-xl border border-line bg-surface py-1 shadow-lg">
          {chargement && <p className="px-3 py-2 text-sm text-ink-soft">Recherche…</p>}
          {erreur && !chargement && <p className="px-3 py-2 text-sm text-danger-critique">Recherche indisponible.</p>}
          {!chargement && !erreur && resultats.length === 0 && (
            <p className="px-3 py-2 text-sm text-ink-soft">Aucun résultat pour « {requete.trim()} ».</p>
          )}
          {!chargement &&
            !erreur &&
            resultats.map((resultat) => (
              <NavLink
                key={resultat.cle}
                to={resultat.to}
                role="option"
                onClick={() => setOuvert(false)}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-paper"
              >
                <span className="truncate">
                  <span className="font-medium text-ink">{resultat.titre}</span>
                  {resultat.sousTitre && <span className="ml-1.5 text-ink-soft">— {resultat.sousTitre}</span>}
                </span>
                <span className="flex-none text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                  {resultat.type}
                </span>
              </NavLink>
            ))}
        </div>
      )}
    </div>
  )
}

// Indicateur de fraîcheur : heure du dernier chargement des compteurs (zones/alertes,
// seule donnée commune à toutes les pages admin) + bouton pour forcer un nouveau chargement.
function FraicheurDonnees() {
  const { derniereMaj, rafraichirCompteurs, chargementCompteurs } = useCompteursAdmin()

  return (
    <div className="admin-topbar__fraicheur">
      <span className="admin-topbar__fraicheur-texte">
        {derniereMaj
          ? `Mis à jour à ${derniereMaj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
          : 'Mise à jour…'}
      </span>
      <button
        type="button"
        className="admin-topbar__actualiser"
        onClick={() => rafraichirCompteurs()}
        disabled={chargementCompteurs}
        aria-label="Actualiser les données"
        title="Actualiser les données"
      >
        <Icone
          nom="actualiser"
          taille={16}
          className={chargementCompteurs ? 'admin-topbar__actualiser-icone--rotation' : ''}
        />
      </button>
    </div>
  )
}

// Cloche de notification : compteur d'alertes nouvelles, cliquable vers la page Alertes.
function ClocheAlertes() {
  const { compteurs } = useCompteursAdmin()
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
