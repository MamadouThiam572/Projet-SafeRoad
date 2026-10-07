import { useState } from 'react'

export interface HeaderNotification {
  id: string
  icon: string
  tint: string
  soft: string
  title: string
  desc: string
  ago: string
}

interface AlertsToggle {
  active: boolean
  onToggle: () => void
  activeLabel: string
  inactiveLabel: string
}

interface HeaderProps {
  onOpenMobileMenu: () => void
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  alerts?: AlertsToggle
  notifications?: HeaderNotification[]
  userInitials: string
  userName: string
  userRole: string
  onProfileClick: () => void
  onLogoutClick: () => void
}

export function Header({
  onOpenMobileMenu,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Rechercher…',
  alerts,
  notifications = [],
  userInitials,
  userName,
  userRole,
  onProfileClick,
  onLogoutClick,
}: HeaderProps) {
  const [notifOpen, setNotifOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  const closeMenus = () => {
    setNotifOpen(false)
    setAccountOpen(false)
  }

  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-line bg-white px-4 py-3 md:px-6">
      <button
        type="button"
        onClick={onOpenMobileMenu}
        className="flex h-11 w-11 flex-none items-center justify-center rounded-[11px] border border-line bg-page text-ink md:hidden"
        aria-label="Ouvrir le menu"
      >
        <span className="ic text-2xl">menu</span>
      </button>

      <label className="flex min-w-0 flex-1 items-center gap-3 rounded-full border-[1.5px] border-line bg-white px-4 py-2.5 focus-within:border-brand-600 sm:max-w-[380px]">
        <span className="ic flex-none text-xl text-muted">search</span>
        <input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="min-w-0 flex-1 border-0 bg-transparent text-[13.5px] font-medium text-ink outline-none"
        />
      </label>

      <div className="flex-1" />

      {alerts && (
        <button
          type="button"
          onClick={alerts.onToggle}
          className={`hidden items-center gap-2.5 whitespace-nowrap rounded-full border-[1.5px] px-4 py-2.5 transition-colors sm:flex ${
            alerts.active ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-danger-200 bg-danger-50 text-danger-700'
          }`}
        >
          <span className={`h-2.5 w-2.5 flex-none rounded-full ${alerts.active ? 'bg-success-600 animate-pulse' : 'bg-danger-600'}`} />
          <span className="text-xs font-bold">{alerts.active ? alerts.activeLabel : alerts.inactiveLabel}</span>
        </button>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setNotifOpen((v) => !v)
            setAccountOpen(false)
          }}
          className="relative flex h-11 w-11 flex-none items-center justify-center rounded-[11px] text-body hover:bg-page"
          aria-label="Notifications"
        >
          <span className="ic text-[23px]">notifications</span>
          {notifications.length > 0 && (
            <span className="absolute right-1 top-1 flex h-[19px] min-w-[19px] items-center justify-center rounded-full border-2 border-white bg-danger-600 px-1 text-[10px] font-extrabold text-white">
              {notifications.length}
            </span>
          )}
        </button>

        {notifOpen && (
          <>
            <button type="button" aria-label="Fermer" onClick={closeMenus} className="fixed inset-0 z-40" />
            <div className="absolute right-0 top-[54px] z-50 w-[300px] overflow-hidden rounded-2xl border border-line bg-white shadow-xl">
              <div className="border-b border-line-soft px-4 py-3.5">
                <p className="m-0 text-sm font-extrabold text-ink">Notifications</p>
              </div>
              {notifications.length === 0 ? (
                <p className="m-0 px-4 py-6 text-center text-sm text-body">Aucune notification pour le moment.</p>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className="flex items-center gap-3 border-b border-page px-4 py-3.5 last:border-b-0">
                    <span
                      className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px]"
                      style={{ background: n.soft, color: n.tint }}
                    >
                      <span className="ic text-[19px]">{n.icon}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 text-[13px] font-bold leading-tight" style={{ color: n.tint }}>
                        {n.title}
                      </p>
                      <p className="m-0 mt-1 text-xs leading-snug text-body">{n.desc}</p>
                    </div>
                    <span className="flex-none text-[11px] font-medium text-muted">{n.ago}</span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <div className="relative flex-none">
        <button
          type="button"
          onClick={() => {
            setAccountOpen((v) => !v)
            setNotifOpen(false)
          }}
          className="flex items-center gap-2.5 p-1"
        >
          <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full bg-navy-900 text-sm font-extrabold text-brand-400">
            {userInitials}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-[13.5px] font-bold leading-tight text-ink">{userName}</span>
            <span className="mt-1 block text-[11.5px] font-medium leading-none text-muted">{userRole}</span>
          </span>
          <span className="ic hidden text-xl text-muted sm:block">expand_more</span>
        </button>

        {accountOpen && (
          <>
            <button type="button" aria-label="Fermer" onClick={closeMenus} className="fixed inset-0 z-40" />
            <div className="absolute right-0 top-[54px] z-50 w-56 rounded-[13px] border border-line bg-white p-1.5 shadow-xl">
              <button
                type="button"
                onClick={() => {
                  closeMenus()
                  onProfileClick()
                }}
                className="flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-3 text-left text-[13px] font-semibold text-ink hover:bg-page"
              >
                <span className="ic text-lg text-body">manage_accounts</span>
                Mon profil
              </button>
              <button
                type="button"
                onClick={() => {
                  closeMenus()
                  onLogoutClick()
                }}
                className="flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-3 text-left text-[13px] font-semibold text-danger-600 hover:bg-danger-50 hover:text-danger-700"
              >
                <span className="ic text-lg">logout</span>
                Se déconnecter
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
