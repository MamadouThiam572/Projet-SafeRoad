import { useEffect, useRef, useState } from 'react'

/**
 * Détecte l'entrée d'un élément dans le viewport et arrête ensuite d'observer —
 * pour les apparitions au défilement et le comptage des KPI, qui ne doivent
 * se déclencher qu'une fois, pas se répéter au défilement inverse.
 */
export function useInView<T extends HTMLElement>(threshold = 0.25) {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [threshold])

  return [ref, inView] as const
}
