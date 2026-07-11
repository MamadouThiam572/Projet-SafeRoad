import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader } from '../../components/communs/Loader'
import { listerAlertes } from '../../services/alertesService'
import { statistiquesDashboard } from '../../services/statistiquesService'
import { listerZones } from '../../services/zonesService'

export function DashboardPage() {
  const [statistiques, setStatistiques] = useState([])
  const [zonesEnAttente, setZonesEnAttente] = useState([])
  const [alertesNouvelles, setAlertesNouvelles] = useState([])
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    Promise.all([statistiquesDashboard(), listerZones(), listerAlertes()])
      .then(([stats, zones, alertes]) => {
        setStatistiques(stats)
        setZonesEnAttente(zones.filter((z) => z.statut_validation === 'en_attente'))
        setAlertesNouvelles(alertes.filter((a) => a.statut === 'nouvelle'))
      })
      .finally(() => setChargement(false))
  }, [])

  if (chargement) return <Loader />

  const totalIncidents = statistiques.filter((s) => !s.zone && !s.type_incident).reduce((acc, s) => acc + s.nombre_incidents, 0)

  return (
    <div className="container py-4">
      <h1 className="h4 mb-4">Tableau de bord administrateur</h1>
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="stat-tile" style={{ '--stripe': 'var(--ink)' }}>
            <div className="label">Incidents enregistrés</div>
            <div className="value">{totalIncidents}</div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="stat-tile" style={{ '--stripe': 'var(--danger-moyen)' }}>
            <div className="label">Zones en attente de validation</div>
            <div className="value">{zonesEnAttente.length}</div>
            <Link to="/admin/zones">Voir les zones →</Link>
          </div>
        </div>
        <div className="col-md-4">
          <div className="stat-tile" style={{ '--stripe': 'var(--danger-critique)' }}>
            <div className="label">Alertes nouvelles</div>
            <div className="value">{alertesNouvelles.length}</div>
            <Link to="/admin/alertes">Voir les alertes →</Link>
          </div>
        </div>
      </div>
      <div className="d-flex gap-2">
        <Link to="/admin/boitiers" className="btn btn-outline-primary">Gérer les boîtiers</Link>
        <Link to="/admin/configuration" className="btn btn-outline-secondary">Configuration système</Link>
      </div>
    </div>
  )
}
