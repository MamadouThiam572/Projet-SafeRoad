import { useEffect, useState } from 'react'
import { CarteZones } from '../../components/carte/CarteZones'
import { Badge } from '../../components/communs/Badge'
import { Loader } from '../../components/communs/Loader'
import { listerZones } from '../../services/zonesService'

export function AnaserZonesPage() {
  const [zones, setZones] = useState([])
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    listerZones().then(setZones).finally(() => setChargement(false))
  }, [])

  if (chargement) return <Loader />

  return (
    <div className="container-fluid py-4">
      <h1 className="h4 mb-3">Zones accidentogènes identifiées</h1>
      <CarteZones zones={zones} />
      <table className="table table-striped mt-4">
        <thead>
          <tr>
            <th>Zone</th>
            <th>Niveau de danger</th>
            <th>Incidents</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          {zones.map((zone) => (
            <tr key={zone.id}>
              <td>{zone.nom || `Zone #${zone.id}`}</td>
              <td><Badge valeur={zone.niveau_danger} /></td>
              <td>{zone.nombre_incidents}</td>
              <td><Badge valeur={zone.statut_validation} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
