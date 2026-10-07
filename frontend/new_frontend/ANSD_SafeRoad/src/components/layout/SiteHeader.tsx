import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import logoUrl from '@/assets/images/saferoad-logo.png'
import { PATHS } from '@/routes/paths'

const NAV_LINKS = [
  { to: PATHS.home, label: 'Accueil', end: true },
  { to: PATHS.carte, label: 'Carte' },
  { to: PATHS.aPropos, label: 'À propos' },
  { to: PATHS.actualites, label: 'Actualités' },
  { to: PATHS.contact, label: 'Contact' },
]

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white/90 backdrop-blur">
      <div className="container-site flex h-[74px] items-center justify-between">
        {/*
         * Logo posé directement sur fond blanc, sans habillage : le fichier
         * (235×83px, fond blanc opaque) se fond dans la page. Hauteur fixe,
         * largeur auto pour préserver le ratio — jamais de déformation.
         * flex-none empêche la nav de le compresser quand elle s'élargit.
         */}
        <Link to={PATHS.home} className="flex flex-none items-center">
          <img src={logoUrl} alt="SafeRoad Sénégal" className="block h-[42px] w-auto" />
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `text-sm font-semibold transition-colors ${isActive ? 'text-brand-600' : 'text-body hover:text-ink'}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link to={PATHS.connexion} className="text-sm font-bold text-body hover:text-ink">
            Connexion
          </Link>
          <Link
            to={PATHS.inscription}
            className="rounded-[11px] bg-brand-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-700"
          >
            Inscription
          </Link>
        </div>

        <button
          type="button"
          aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          onClick={() => setMobileOpen((v) => !v)}
          className="ic flex h-10 w-10 items-center justify-center rounded-lg text-2xl text-ink md:hidden"
        >
          {mobileOpen ? 'close' : 'menu'}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-line bg-white px-5 pb-5 pt-2 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `rounded-[10px] px-3 py-2.5 text-sm font-bold ${isActive ? 'bg-brand-50 text-brand-700' : 'text-body'}`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
            <Link
              to={PATHS.connexion}
              onClick={() => setMobileOpen(false)}
              className="rounded-[11px] border-[1.5px] border-line py-2.5 text-center text-sm font-bold text-ink"
            >
              Connexion
            </Link>
            <Link
              to={PATHS.inscription}
              onClick={() => setMobileOpen(false)}
              className="rounded-[11px] bg-brand-600 py-2.5 text-center text-sm font-bold text-white"
            >
              Inscription
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
