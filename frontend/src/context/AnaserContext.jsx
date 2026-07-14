import { createContext } from 'react'
import { useRequete } from '../hooks/useRequete'
import { listerFeedbacksAnaser } from '../services/anaserService'
import { listerZones } from '../services/zonesService'

export const AnaserContext = createContext(null)

const COMPTEURS_VIDES = { zonesCritiques: 0, feedbacksEnAttente: 0 }

function chargerCompteurs() {
  return Promise.all([listerZones(), listerFeedbacksAnaser()]).then(([zones, feedbacks]) => ({
    zonesCritiques: zones.filter((z) => z.actif && z.niveau_danger === 'critique').length,
    feedbacksEnAttente: feedbacks.filter((f) => f.statut !== 'realisee').length,
  }))
}

// Fournit à l'espace ANASER les compteurs « à traiter » (zones critiques, feedbacks en attente),
// alimentant les badges de la sidebar. `rafraichirCompteurs` est appelé après chaque action
// (création/mise à jour d'un feedback) pour garder les badges à jour.
export function AnaserProvider({ children }) {
  const { donnees, rafraichir } = useRequete(chargerCompteurs)
  const compteurs = donnees ?? COMPTEURS_VIDES
  return (
    <AnaserContext.Provider value={{ compteurs, rafraichirCompteurs: rafraichir }}>
      {children}
    </AnaserContext.Provider>
  )
}
