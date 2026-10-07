import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { PATHS } from '@/routes/paths'
import { DashboardLayout } from './DashboardLayout'
import type { SidebarNavItem } from './Sidebar'

/**
 * Menu du Super Admin. Chaque entrée répond à UNE question :
 * Boîtiers → qui est affecté à quoi ? · Monitoring IoT → le système fonctionne-t-il techniquement ?
 * Incidents → qu'a détecté SafeRoad ? · Signalements → qu'ont déclaré les conducteurs ?
 * Zones → quelles zones sont identifiées/validées ? · Statistiques → quelles tendances ?
 * Dashboard national → quelle est la situation globale maintenant ?
 */
const NAV_ITEMS: SidebarNavItem[] = [
  { key: 'dashboard', icon: 'dashboard', label: 'Dashboard national', to: PATHS.superAdmin.root, end: true },
  { key: 'utilisateurs', icon: 'group', label: 'Utilisateurs', to: PATHS.superAdmin.utilisateurs },
  { key: 'boitiers', icon: 'memory', label: 'Boîtiers', to: PATHS.superAdmin.boitiers },
  { key: 'monitoring', icon: 'sensors', label: 'Monitoring IoT', to: PATHS.superAdmin.monitoring },
  { key: 'incidents', icon: 'report', label: 'Incidents', to: PATHS.superAdmin.incidents },
  { key: 'signalements', icon: 'campaign', label: 'Signalements', to: PATHS.superAdmin.signalements },
  { key: 'zones', icon: 'map', label: 'Zones', to: PATHS.superAdmin.zones },
  { key: 'statistiques', icon: 'bar_chart', label: 'Statistiques', to: PATHS.superAdmin.statistiques },
  { key: 'notifications', icon: 'notifications', label: 'Notifications', to: PATHS.superAdmin.notifications },
  { key: 'rapports', icon: 'summarize', label: 'Rapports', to: PATHS.superAdmin.rapports },
  { key: 'configuration', icon: 'settings', label: 'Configuration', to: PATHS.superAdmin.configuration },
  { key: 'historique', icon: 'history', label: 'Historique', to: PATHS.superAdmin.historique },
]

export function SuperAdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const initials = user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : ''

  return (
    <DashboardLayout
      navItems={NAV_ITEMS}
      homeTo={PATHS.superAdmin.root}
      roleLabel="Super Admin"
      userInitials={initials}
      userName={user ? `${user.firstName} ${user.lastName}` : ''}
      userRole="Super Admin"
      onProfileClick={() => {}}
      onLogoutClick={() => {
        logout()
        navigate(PATHS.connexion)
      }}
      searchPlaceholder="Rechercher…"
    />
  )
}
