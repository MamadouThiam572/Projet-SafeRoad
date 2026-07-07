import { useEffect, useState } from 'react'
import { Badge } from '../../components/communs/Badge'
import { Loader } from '../../components/communs/Loader'
import { genererZones, listerZones, validerZone } from '../../services/zonesService'

export function ZonesAValiderPage() {
  const [zones, setZones] = useState([])
  const [chargement, setChargement] = useState(true)
  const [generation, setGeneration] = useState(false)

  function rafraichir() {
    return listerZones().then(setZones)
  }

  useEffect(() => {
    rafraichir().finally(() => setChargement(false))
  }, [])

  async function handleValider(id, statut) {
    await validerZone(id, statut)
    await rafraichir()
  }

  async function handleGenerer() {
    setGeneration(true)
    try {
      await genererZones()
      await rafraichir()
    } finally {
      setGeneration(false)
    }
  }

  if (chargement) return <Loader />

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h4 mb-0">Zones accidentogènes</h1>
        <button className="btn btn-primary" onClick={handleGenerer} disabled={generation}>
          {generation ? 'Génération...' : 'Relancer la détection de zones'}
        </button>
      </div>

      <div className="surface-card p-3" style={{ overflowX: 'auto' }}>
        <table className="table table-striped mb-0">
          <thead>
            <tr>
              <th>Zone</th>
              <th>Niveau de danger</th>
              <th>Incidents</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {zones.map((zone) => (
              <tr key={zone.id}>
                <td>{zone.nom || `Zone #${zone.id}`}</td>
                <td><Badge valeur={zone.niveau_danger} /></td>
                <td className="font-mono">{zone.nombre_incidents}</td>
                <td><Badge valeur={zone.statut_validation} /></td>
                <td>
                  {zone.statut_validation === 'en_attente' && (
                    <>
                      <button className="btn btn-sm btn-success me-2" onClick={() => handleValider(zone.id, 'validee')}>
                        Valider
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleValider(zone.id, 'rejetee')}>
                        Rejeter
                      </button>
                    </>
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
