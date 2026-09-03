import { useTheme } from '../../hooks/useTheme'
import { Icone } from './Icone'

// Bascule clair/sombre, réutilisée dans la navbar publique et les barres du haut
// admin/ANASER. `sur` ajuste le contraste du bouton selon le fond (chrome sombre
// vs. topbar claire) — les deux restent lisibles en clair comme en sombre.
export function ThemeToggle({ sur = 'clair' }) {
  const { sombre, basculerTheme } = useTheme()
  const libelle = sombre ? 'Passer en thème clair' : 'Passer en thème sombre'

  const classesBase =
    'inline-flex items-center justify-center w-9 h-9 rounded-sm transition-colors duration-150'
  const classesTon =
    sur === 'sombre'
      ? 'text-white/75 hover:text-white hover:bg-white/10'
      : 'text-ink-soft hover:text-ink hover:bg-paper'

  return (
    <button type="button" onClick={basculerTheme} className={`${classesBase} ${classesTon}`} aria-label={libelle} title={libelle}>
      <Icone nom={sombre ? 'soleil' : 'lune'} taille={18} />
    </button>
  )
}
