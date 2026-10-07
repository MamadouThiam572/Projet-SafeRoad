import type { ReactNode } from 'react'
import { useInView } from '@/hooks/useInView'

interface RevealProps {
  children: ReactNode
  delay?: number
  className?: string
  /** Optionnel — pour ancrer un lien #... vers ce bloc (ex. le CTA boîtiers de la page Contact). */
  id?: string
}

/**
 * Apparition en cascade au défilement, une seule fois — fiche technique §4 :
 * « hiérarchise l'arrivée du contenu sans se répéter au défilement inverse. »
 */
export function Reveal({ children, delay = 0, className = '', id }: RevealProps) {
  const [ref, inView] = useInView<HTMLDivElement>()

  return (
    <div
      ref={ref}
      id={id}
      className={`transition-all duration-700 ease-out ${
        inView ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      } ${className}`}
      style={{ transitionDelay: inView ? `${delay}ms` : '0ms' }}
    >
      {children}
    </div>
  )
}
