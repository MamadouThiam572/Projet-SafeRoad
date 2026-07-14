import { createContext } from 'react'
import { useRequete } from '../hooks/useRequete'
import { listerAlertes } from '../services/alertesService'
import { listerZones } from '../services/zonesService'

export const AdminContext = createContext(null)

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
export function AdminProvider({ children }) {
  const { donnees, rafraichir } = useRequete(chargerCompteurs)
  const compteurs = donnees ?? COMPTEURS_VIDES
  return (
    <AdminContext.Provider value={{ compteurs, rafraichirCompteurs: rafraichir }}>
      {children}
    </AdminContext.Provider>
  )
}
