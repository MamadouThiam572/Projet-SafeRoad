import { Link } from 'react-router-dom'
import logoUrl from '@/assets/images/saferoad-logo.png'
import { PATHS } from '@/routes/paths'

const NAV_LINKS = [
  { to: PATHS.home, label: 'Accueil' },
  { to: PATHS.carte, label: 'Carte' },
  { to: PATHS.aPropos, label: 'À propos' },
  { to: PATHS.actualites, label: 'Actualités' },
  { to: PATHS.contact, label: 'Contact' },
]

const SOCIALS = [
  { abbr: 'f', label: 'Facebook' },
  { abbr: 'X', label: 'X (Twitter)' },
  { abbr: 'in', label: 'LinkedIn' },
  { abbr: 'YT', label: 'YouTube' },
]

const LEGAL_LINKS = ['Mentions légales', 'Politique de confidentialité', "Conditions d'utilisation"]

export function SiteFooter() {
  return (
    <footer className="bg-navy-950 text-white/70">
      {/*
       * Étage principal — repeat(auto-fit,minmax(210px,1fr)) : seuil plus bas
       * que le hero (340px), donc dégradation en escalier 4 → 3 → 2 → 1
       * colonne sans écrire un seul point de rupture. Ordre = fréquence
       * d'usage : identité, navigation, réseaux, contact.
       */}
      <div className="container-site grid gap-[36px] pb-[30px] pt-[56px] [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
        <div className="min-w-0">
          <Link to={PATHS.home} className="flex flex-none items-center">
            <span className="inline-flex items-center rounded-[13px] bg-white px-[13px] py-[9px]">
              <img src={logoUrl} alt="SafeRoad Sénégal" className="block h-[34px] w-auto" />
            </span>
          </Link>
          <p className="mt-4 text-[14.5px] font-bold text-white">Des routes plus sûres, une vie plus précieuse.</p>
          <p className="mt-2 max-w-xs text-[13px] font-normal text-white/[.68]">
            Plateforme sénégalaise de sécurité routière : IA, IoT et cartographie des zones à risque.
          </p>
        </div>

        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-wide text-white">Liens rapides</p>
          <ul className="mt-4 flex flex-col gap-[11px]">
            {NAV_LINKS.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="text-[13.5px] font-medium text-white/[.68] transition-colors hover:text-brand-400"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-wide text-white">Suivez-nous</p>
          {/* Abréviation visible + aria-label : "f", "X", "in", "YT" ne parlent pas seuls aux lecteurs d'écran */}
          <div className="mt-4 flex gap-[10px]">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href="#"
                aria-label={s.label}
                className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white/10 text-sm font-bold text-white transition-colors hover:bg-brand-600"
              >
                {s.abbr}
              </a>
            ))}
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-wide text-white">Contact</p>
          <ul className="mt-4 flex flex-col gap-[13px] text-[13.5px] font-medium text-white/[.68]">
            <li className="flex items-center gap-2">
              <span className="ic text-brand-400" style={{ fontSize: 18 }}>
                mail
              </span>
              contact@saferoad.sn
            </li>
            <li className="flex items-center gap-2">
              <span className="ic text-brand-400" style={{ fontSize: 18 }}>
                call
              </span>
              +221 33 000 00 00
            </li>
            <li className="flex items-center gap-2">
              <span className="ic text-brand-400" style={{ fontSize: 18 }}>
                location_on
              </span>
              Dakar, Sénégal
            </li>
          </ul>
        </div>
      </div>

      {/*
       * Étage secondaire — bande de service, pas un bloc de contenu : retrait
       * réduit à 20px. flex-wrap fait passer les liens légaux sous le
       * copyright plutôt que de les comprimer quand la largeur manque.
       */}
      <div className="border-t border-white/10">
        <div className="container-site flex flex-wrap items-center justify-between gap-x-5 gap-y-2 py-[20px]">
          <p className="text-xs font-medium text-white/50">
            © {new Date().getFullYear()} SafeRoad Sénégal. Tous droits réservés.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {LEGAL_LINKS.map((label) => (
              <a
                key={label}
                href="#"
                className="text-xs font-medium text-white/50 transition-colors hover:text-brand-400"
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
