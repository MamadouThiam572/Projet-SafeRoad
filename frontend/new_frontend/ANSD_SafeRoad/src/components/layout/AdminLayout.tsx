import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { regionLabel } from '@/lib/regions'
import { PATHS } from '@/routes/paths'
import { DashboardLayout } from './DashboardLayout'
import type { SidebarNavItem } from './Sidebar'

const NAV_ITEMS: SidebarNavItem[] = [
  { key: 'dashboard', icon: 'dashboard', label: 'Dashboard', to: PATHS.admin.root, end: true },
  { key: 'monitoring', icon: 'sensors', label: 'Monitoring IoT', to: PATHS.admin.monitoring },
  { key: 'carte', icon: 'map', label: 'Carte', to: PATHS.admin.carte },
  { key: 'incidents', icon: 'report', label: 'Incidents', to: PATHS.admin.incidents },
  { key: 'signalements', icon: 'campaign', label: 'Signalements', to: PATHS.admin.signalements },
  { key: 'zones', icon: 'fact_check', label: 'Zones à valider', to: PATHS.admin.zones },
  { key: 'alertes', icon: 'notifications', label: 'Alertes', to: PATHS.admin.alertes },
  { key: 'boitiers', icon: 'memory', label: 'Boîtiers', to: PATHS.admin.boitiers },
  { key: 'demandes', icon: 'assignment', label: 'Demandes', to: PATHS.admin.demandes },
  { key: 'historique', icon: 'history', label: 'Historique', to: PATHS.admin.historique },
]

export function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const initials = user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : ''

  return (
    <DashboardLayout
      navItems={NAV_ITEMS}
      homeTo={PATHS.admin.root}
      roleLabel="Administrateur régional"
      roleMeta={user?.region ? regionLabel(user.region) : undefined}
      userInitials={initials}
      userName={user ? `${user.firstName} ${user.lastName}` : ''}
      userRole={user?.region ? `Admin Régional · ${regionLabel(user.region)}` : 'Admin Régional'}
      onProfileClick={() => navigate(PATHS.admin.profil)}
      onLogoutClick={() => {
        logout()
        navigate(PATHS.connexion)
      }}
      searchPlaceholder="Rechercher un boîtier, un incident…"
    />
  )
}
