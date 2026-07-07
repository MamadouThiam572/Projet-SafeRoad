import { useEffect, useState } from 'react'
import { Badge } from '../../components/communs/Badge'
import { Loader } from '../../components/communs/Loader'
import { listerAlertes, traiterAlerte } from '../../services/alertesService'

export function AlertesPage() {
  const [alertes, setAlertes] = useState([])
  const [chargement, setChargement] = useState(true)

  function rafraichir() {
    return listerAlertes().then(setAlertes)
  }

  useEffect(() => {
    rafraichir().finally(() => setChargement(false))
  }, [])

  async function handleTraiter(id) {
    await traiterAlerte(id, 'traitee')
    await rafraichir()
  }

  if (chargement) return <Loader />

  return (
    <div className="container py-4">
      <h1 className="h4 mb-4">Alertes critiques</h1>
      <div className="surface-card p-3" style={{ overflowX: 'auto' }}>
        <table className="table table-striped mb-0">
          <thead>
            <tr>
              <th>Incident</th>
              <th>Statut</th>
              <th>Créée le</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {alertes.map((alerte) => (
              <tr key={alerte.id}>
                <td className="font-mono">#{alerte.incident}</td>
                <td><Badge valeur={alerte.statut} /></td>
                <td className="font-mono">{new Date(alerte.date_creation).toLocaleString('fr-FR')}</td>
                <td>
                  {alerte.statut !== 'traitee' && (
                    <button className="btn btn-sm btn-success" onClick={() => handleTraiter(alerte.id)}>
                      Marquer comme traitée
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
