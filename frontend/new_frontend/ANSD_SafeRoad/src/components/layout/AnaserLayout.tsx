import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ANASER_RETOURS } from '@/data/anaserRetours'
import { PATHS } from '@/routes/paths'
import { DashboardLayout } from './DashboardLayout'
import type { SidebarNavItem } from './Sidebar'

function buildNavItems(pendingRetours: number): SidebarNavItem[] {
  return [
    { key: 'dashboard', icon: 'dashboard', label: 'Accueil', to: PATHS.anaser.root, end: true },
    { key: 'incidents', icon: 'report', label: 'Incidents', to: PATHS.anaser.incidents },
    { key: 'zones', icon: 'crisis_alert', label: 'Zones à risque', to: PATHS.anaser.zones },
    { key: 'statistiques', icon: 'bar_chart', label: 'Statistiques', to: PATHS.anaser.statistiques },
    {
      key: 'retours',
      icon: 'campaign',
      label: 'Alertes ANASER',
      to: PATHS.anaser.retours,
      badge: pendingRetours || undefined,
    },
    { key: 'profil', icon: 'account_circle', label: 'Mon profil', to: PATHS.anaser.profil },
  ]
}

export function AnaserLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const initials = user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : ''
  const pendingRetours = ANASER_RETOURS.filter((r) => r.statut === 'nouveau' || r.statut === 'en_cours').length

  return (
    <DashboardLayout
      navItems={buildNavItems(pendingRetours)}
      homeTo={PATHS.anaser.root}
      roleLabel="ANASER"
      roleMeta="Vue nationale"
      userInitials={initials}
      userName={user ? `${user.firstName} ${user.lastName}` : ''}
      userRole="ANASER"
      onProfileClick={() => navigate(PATHS.anaser.profil)}
      onLogoutClick={() => {
        logout()
        navigate(PATHS.connexion)
      }}
      searchPlaceholder="Rechercher un incident, une zone, une localité…"
    />
  )
}
