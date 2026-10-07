import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { PATHS } from '@/routes/paths'
import { DashboardLayout } from './DashboardLayout'
import type { SidebarNavItem } from './Sidebar'

const NAV_ITEMS: SidebarNavItem[] = [
  { key: 'dashboard', icon: 'dashboard', label: 'Tableau de bord', to: PATHS.client.root, end: true },
  { key: 'carte', icon: 'map', label: 'Carte des zones', to: PATHS.client.carte },
  { key: 'alertes', icon: 'notifications', label: 'Mes alertes', to: PATHS.client.alertes },
  { key: 'trajets', icon: 'route', label: 'Mes trajets', to: PATHS.client.trajets },
  { key: 'signalements', icon: 'flag', label: 'Mes signalements', to: PATHS.client.signalements },
  { key: 'profil', icon: 'manage_accounts', label: 'Mon profil', to: PATHS.client.profil },
]

export function ClientLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [alertsOn, setAlertsOn] = useState(true)

  const initials = user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : ''

  return (
    <DashboardLayout
      navItems={NAV_ITEMS}
      homeTo={PATHS.client.root}
      roleLabel="Conducteur"
      roleMeta={user?.region}
      cta={{
        label: 'Signaler un danger',
        icon: 'report',
        onClick: () => navigate(PATHS.client.signalements),
      }}
      userInitials={initials}
      userName={user ? `${user.firstName} ${user.lastName}` : ''}
      userRole="Conducteur"
      onProfileClick={() => navigate(PATHS.client.profil)}
      onLogoutClick={() => {
        logout()
        navigate(PATHS.connexion)
      }}
      alerts={{
        active: alertsOn,
        onToggle: () => setAlertsOn((v) => !v),
        activeLabel: 'Alertes actives',
        inactiveLabel: 'Alertes coupées',
      }}
      searchPlaceholder="Rechercher un trajet, une alerte…"
    />
  )
}
