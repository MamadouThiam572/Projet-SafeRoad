import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Header, type HeaderNotification } from './Header'
import { Sidebar, type SidebarCta, type SidebarNavItem } from './Sidebar'

interface DashboardAlerts {
  active: boolean
  onToggle: () => void
  activeLabel: string
  inactiveLabel: string
}

interface DashboardLayoutProps {
  navItems: SidebarNavItem[]
  homeTo: string
  roleLabel: string
  roleMeta?: string
  cta?: SidebarCta
  userInitials: string
  userName: string
  userRole: string
  onProfileClick: () => void
  onLogoutClick: () => void
  alerts?: DashboardAlerts
  notifications?: HeaderNotification[]
  searchPlaceholder?: string
}

export function DashboardLayout({
  navItems,
  homeTo,
  roleLabel,
  roleMeta,
  cta,
  userInitials,
  userName,
  userRole,
  onProfileClick,
  onLogoutClick,
  alerts,
  notifications,
  searchPlaceholder,
}: DashboardLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState('')

  return (
    <div className="min-h-screen bg-page md:flex">
      <Sidebar
        navItems={navItems}
        homeTo={homeTo}
        roleLabel={roleLabel}
        roleMeta={roleMeta}
        cta={cta}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          onOpenMobileMenu={() => setMobileOpen(true)}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={searchPlaceholder}
          alerts={alerts}
          notifications={notifications}
          userInitials={userInitials}
          userName={userName}
          userRole={userRole}
          onProfileClick={onProfileClick}
          onLogoutClick={onLogoutClick}
        />

        <main className="min-w-0 flex-1 pb-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
