import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icone } from './Icone'

function initiales(utilisateur) {
  const p = (utilisateur.prenom ?? '').trim()
  const n = (utilisateur.nom ?? '').trim()
  const deux = `${p.charAt(0)}${n.charAt(0)}`.trim()
  return (deux || (utilisateur.email ?? '?').charAt(0)).toUpperCase()
}

function nomComplet(utilisateur) {
  const complet = `${utilisateur.prenom ?? ''} ${utilisateur.nom ?? ''}`.trim()
  return complet || utilisateur.email
}

// Menu déroulant de l'avatar (en-tête) : fermeture au clic extérieur et à Échap, comme
// tout menu de l'espace de gestion (voir le guide de structure).
export function AvatarMenu({ utilisateur, roleLibelle, lienProfil, onDeconnexion }) {
  const [ouvert, setOuvert] = useState(false)
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

  return (
    <div className="relative" ref={conteneurRef}>
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-label={`Menu du compte, connecté en tant que ${nomComplet(utilisateur)}`}
        className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-paper"
      >
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-hivis font-display text-xs font-semibold text-hivis-ink shadow-sm">
          {initiales(utilisateur)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block max-w-[9rem] truncate text-sm font-semibold text-ink">{nomComplet(utilisateur)}</span>
          <span className="block text-[11px] uppercase tracking-wide text-ink-soft">{roleLibelle}</span>
        </span>
        <Icone nom="fleche" taille={13} className={`hidden flex-none text-ink-soft transition-transform sm:block ${ouvert ? '-rotate-90' : 'rotate-90'}`} />
      </button>

      {ouvert && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-lg"
        >
          <div className="border-b border-line px-3 py-2 sm:hidden">
            <p className="truncate text-sm font-semibold text-ink">{nomComplet(utilisateur)}</p>
            <p className="text-[11px] uppercase tracking-wide text-ink-soft">{roleLibelle}</p>
          </div>
          {lienProfil ? (
            <Link
              to={lienProfil}
              role="menuitem"
              onClick={() => setOuvert(false)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-paper"
            >
              <Icone nom="utilisateur" taille={16} />
              Mon profil
            </Link>
          ) : (
            <button
              type="button"
              role="menuitem"
              disabled
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-soft opacity-60"
              title="Bientôt disponible"
            >
              <Icone nom="utilisateur" taille={16} />
              Mon profil
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={onDeconnexion}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-danger-critique hover:bg-danger-critique-bg"
          >
            <Icone nom="deconnexion" taille={16} />
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  )
}
