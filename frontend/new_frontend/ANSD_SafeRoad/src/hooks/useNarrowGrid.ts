import { useEffect, useRef, useState } from 'react'

/**
 * Bascule une grille en une colonne quand son propre conteneur passe sous
 * `breakpoint`, via ResizeObserver plutôt qu'une requête média — fiche
 * technique §1.3 : la grille réagit à l'espace qui lui est réellement
 * alloué, pas à la largeur de la fenêtre.
 */
export function useNarrowGrid<T extends HTMLElement>(breakpoint: number) {
  const ref = useRef<T | null>(null)
  const [isNarrow, setIsNarrow] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const observer = new ResizeObserver(([entry]) => {
      setIsNarrow(entry.contentRect.width < breakpoint)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [breakpoint])

  return [ref, isNarrow] as const
}
