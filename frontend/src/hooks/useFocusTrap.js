import { useEffect } from 'react'

const SELECTEUR_FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'

// Piège le focus clavier à l'intérieur de `conteneurRef` tant que `actif` est vrai (Tab/
// Maj+Tab ne sortent pas), ferme sur Échap, et verrouille le scroll du body — utilisé par
// le tiroir de navigation mobile (admin/ANASER). `onFermer` est appelé sur Échap.
export function useFocusTrap(conteneurRef, actif, onFermer) {
  useEffect(() => {
    if (!actif) return

    const conteneur = conteneurRef.current
    const premierFocusable = conteneur?.querySelector(SELECTEUR_FOCUSABLE)
    premierFocusable?.focus()

    const styleScrollPrecedent = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        onFermer()
        return
      }
      if (e.key !== 'Tab' || !conteneur) return

      const focusables = Array.from(conteneur.querySelectorAll(SELECTEUR_FOCUSABLE))
      if (focusables.length === 0) return
      const [premier, dernier] = [focusables[0], focusables[focusables.length - 1]]

      if (e.shiftKey && document.activeElement === premier) {
        e.preventDefault()
        dernier.focus()
      } else if (!e.shiftKey && document.activeElement === dernier) {
        e.preventDefault()
        premier.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = styleScrollPrecedent
    }
  }, [actif, conteneurRef, onFermer])
}
