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

  return (
    <div className="container py-4">
      <h1 className="h4 mb-3">Statistiques publiques (30 derniers jours)</h1>
      {statistiques.length === 0 ? (
        <p className="text-muted">Aucune statistique disponible pour le moment.</p>
      ) : (
        <table className="table table-striped">
          <thead>
            <tr>
              <th>Date</th>
              <th>Incidents</th>
              <th>Incidents critiques</th>
              <th>Zones actives</th>
            </tr>
          </thead>
          <tbody>
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
      )}
    </div>
  )
}
