import { useEffect, useState } from 'react'
import { Loader } from '../../components/communs/Loader'
import { statistiquesPubliques } from '../../services/statistiquesService'

export function StatistiquesPubliquesPage() {
  const [statistiques, setStatistiques] = useState([])
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    statistiquesPubliques().then(setStatistiques).finally(() => setChargement(false))
  }, [])

  if (chargement) return <Loader />

  const totalIncidents = statistiques.reduce((acc, s) => acc + s.nombre_incidents, 0)
  const totalCritiques = statistiques.reduce((acc, s) => acc + s.nombre_incidents_critiques, 0)
  const dernieresZonesActives = statistiques.length ? statistiques[statistiques.length - 1].nombre_zones_actives : 0

  return (
    <div className="container py-4">
      <h1 className="h4 mb-1">Statistiques publiques</h1>
      <p style={{ color: 'var(--ink-soft)' }}>30 derniers jours, données agrégées et anonymisées</p>

      {statistiques.length === 0 ? (
        <p style={{ color: 'var(--ink-soft)' }}>Aucune statistique disponible pour le moment.</p>
      ) : (
        <>
          <div className="row g-3 mb-4">
            <div className="col-md-4">
              <div className="stat-tile" style={{ '--stripe': 'var(--ink)' }}>
                <div className="label">Incidents sur la période</div>
                <div className="value">{totalIncidents}</div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="stat-tile" style={{ '--stripe': 'var(--danger-critique)' }}>
                <div className="label">Dont critiques</div>
                <div className="value">{totalCritiques}</div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="stat-tile" style={{ '--stripe': 'var(--danger-moyen)' }}>
                <div className="label">Zones actives (dernier jour)</div>
                <div className="value">{dernieresZonesActives}</div>
              </div>
            </div>
          </div>

          <div className="surface-card p-3" style={{ overflowX: 'auto' }}>
            <table className="table table-striped mb-0">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Incidents</th>
                  <th>Incidents critiques</th>
                  <th>Zones actives</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {statistiques.map((stat) => (
                  <tr key={stat.id}>
                    <td>{stat.date}</td>
                    <td>{stat.nombre_incidents}</td>
                    <td>{stat.nombre_incidents_critiques}</td>
                    <td>{stat.nombre_zones_actives}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
