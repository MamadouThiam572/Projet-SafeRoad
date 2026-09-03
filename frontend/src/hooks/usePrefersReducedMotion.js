import { useEffect, useState } from 'react'

// Renvoie `true` si l'utilisateur a demandé à réduire les animations au niveau de
// son système. Utilisé pour désactiver les animations SVG (SMIL), que le CSS
// `prefers-reduced-motion` ne peut pas atteindre.
export function usePrefersReducedMotion() {
  const [reduit, setReduit] = useState(
    () => typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduit(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return reduit
}
