import { NavLink } from 'react-router-dom'
import logoUrl from '@/assets/images/saferoad-logo.png'

export interface SidebarNavItem {
  key: string
  icon: string
  label: string
  to: string
  end?: boolean
  badge?: number
}

export interface SidebarCta {
  label: string
  icon: string
  onClick: () => void
}

interface SidebarProps {
  navItems: SidebarNavItem[]
  homeTo: string
  roleLabel: string
  roleMeta?: string
  cta?: SidebarCta
  mobileOpen: boolean
  onCloseMobile: () => void
}

export function Sidebar({ navItems, homeTo, roleLabel, roleMeta, cta, mobileOpen, onCloseMobile }: SidebarProps) {
  // Le tiroir mobile s'ouvre en pleine largeur : les libellés doivent y être
  // visibles, contrairement au mode "rail" du desktop entre 768 et 1280px.
  const label = mobileOpen ? 'inline' : 'hidden xl:inline'
  const labelFlex = mobileOpen ? 'flex' : 'hidden xl:flex'
  const labelBadge = mobileOpen ? 'flex' : 'hidden xl:flex'

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-navy-950/55 backdrop-blur-sm md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col overflow-hidden bg-sidebar p-4 transition-transform duration-200 md:sticky md:top-0 md:z-0 md:h-screen md:w-20 md:translate-x-0 xl:w-60 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-transparent" />

        <div className="relative flex h-full flex-col">
          <NavLink to={homeTo} className="flex items-center gap-3 px-1.5">
            <span className="flex h-[42px] w-[42px] flex-none items-center justify-center overflow-hidden rounded-xl bg-navy-900">
              <img src={logoUrl} alt="SafeRoad" className="h-full w-full object-contain" />
            </span>
            <span className={`${label} text-xl font-extrabold tracking-tight text-ink`}>SafeRoad</span>
          </NavLink>

          <div className={`mt-6 items-center gap-3 rounded-xl px-2 py-3 ${labelFlex}`}>
            <span className="ic flex-none text-xl text-brand-600">account_circle</span>
            <div className="min-w-0">
              <p className="m-0 text-[13.5px] font-bold leading-tight text-ink">{roleLabel}</p>
              {roleMeta && <p className="m-0 mt-1 text-[11.5px] font-medium leading-none text-ink/60">{roleMeta}</p>}
            </div>
          </div>

          <nav className="mt-6 flex min-h-0 flex-col gap-1 overflow-y-auto [scrollbar-width:thin] xl:mt-5">
            {navItems.map((item) => (
              <NavLink
                key={item.key}
                to={item.to}
                end={item.end}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  `flex min-h-[46px] items-center gap-3 rounded-[11px] px-3 py-3 [@media(max-height:760px)]:min-h-[40px] [@media(max-height:760px)]:py-2 text-[13.5px] font-semibold transition-colors ${
                    isActive ? 'bg-brand-600 text-white' : 'text-ink/75 hover:bg-white/55 hover:text-ink'
                  }`
                }
              >
                <span className="ic flex-none text-[21px]">{item.icon}</span>
                <span className={`${label} min-w-0 flex-1`}>{item.label}</span>
                {!!item.badge && (
                  <span
                    className={`${labelBadge} h-5 min-w-5 flex-none items-center justify-center rounded-full bg-danger-600 px-1.5 text-[10.5px] font-extrabold text-white`}
                  >
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex-1" />

          {cta && (
            <button
              type="button"
              onClick={cta.onClick}
              className={`flex min-h-[46px] items-center gap-3 rounded-2xl bg-danger-600 p-3.5 transition-colors hover:bg-danger-700 ${
                mobileOpen ? 'justify-start' : 'justify-center xl:justify-start'
              }`}
            >
              <span className="ic flex-none text-[21px] text-white">{cta.icon}</span>
              <span className={`${label} text-[13px] font-bold leading-tight text-white`}>{cta.label}</span>
            </button>
          )}
        </div>
      </aside>
    </>
  )
}
