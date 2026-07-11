import { useEffect, useState } from 'react'
import { Loader } from '../../components/communs/Loader'
import { statistiquesDashboard } from '../../services/statistiquesService'

export function AnaserDashboardPage() {
  const [statistiques, setStatistiques] = useState([])
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    statistiquesDashboard().then(setStatistiques).finally(() => setChargement(false))
  }, [])

  if (chargement) return <Loader />

  return (
    <div className="container py-4">
      <h1 className="h4 mb-4">Tableau de bord ANASER</h1>
      <div className="surface-card p-3" style={{ overflowX: 'auto' }}>
        <table className="table table-striped mb-0">
          <thead>
            <tr>
              <th>Date</th>
              <th>Zone</th>
              <th>Type</th>
              <th>Incidents</th>
              <th>Incidents critiques</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {statistiques.map((s) => (
              <tr key={s.id}>
                <td>{s.date}</td>
                <td>{s.zone ?? 'Global'}</td>
                <td>{s.type_incident ?? 'Tous'}</td>
                <td>{s.nombre_incidents}</td>
                <td>{s.nombre_incidents_critiques}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
