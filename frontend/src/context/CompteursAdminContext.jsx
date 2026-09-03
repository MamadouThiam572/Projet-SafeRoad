import { createContext, useEffect, useState } from 'react'
import { useRequete } from '../hooks/useRequete'
import { listerAlertes } from '../services/alertesService'
import { listerZones } from '../services/zonesService'

export const CompteursAdminContext = createContext(null)

const COMPTEURS_VIDES = { zonesEnAttente: 0, alertesNouvelles: 0 }

function chargerCompteurs() {
  return Promise.all([listerZones(), listerAlertes()]).then(([zones, alertes]) => ({
    zonesEnAttente: zones.filter((z) => z.statut_validation === 'en_attente').length,
    alertesNouvelles: alertes.filter((a) => a.statut === 'nouvelle').length,
  }))
}

// Fournit à l'espace admin les compteurs « à traiter » (zones en attente, alertes nouvelles),
// alimentant les badges de la sidebar. `rafraichirCompteurs` est appelé après chaque action
// (validation d'une zone, traitement d'une alerte) pour garder les badges à jour.
// `derniereMaj` alimente l'indicateur de fraîcheur de la topbar (seule donnée chargée sur
// TOUTES les pages admin, donc seul repère de fraîcheur valable à cet endroit partagé).
export function CompteursAdminProvider({ children }) {
  const { donnees, chargement, rafraichir } = useRequete(chargerCompteurs)
  const compteurs = donnees ?? COMPTEURS_VIDES
  const [derniereMaj, setDerniereMaj] = useState(null)

  useEffect(() => {
    if (donnees) setDerniereMaj(new Date())
  }, [donnees])

  return (
    <CompteursAdminContext.Provider
      value={{ compteurs, rafraichirCompteurs: rafraichir, chargementCompteurs: chargement, derniereMaj }}
    >
      {children}
    </CompteursAdminContext.Provider>
  )
}
