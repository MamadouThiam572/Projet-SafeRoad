import { useEffect, useState } from 'react'
import { CarteZones } from '../../components/carte/CarteZones'
import { Loader } from '../../components/communs/Loader'
import { listerZones } from '../../services/zonesService'

export function CartePubliquePage() {
  const [zones, setZones] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    listerZones()
      .then(setZones)
      .catch(() => setErreur("Impossible de charger les zones accidentogènes."))
      .finally(() => setChargement(false))
  }, [])

  if (chargement) return <Loader />

  return (
    <div className="container-fluid py-4">
      <h1 className="h4 mb-3">Carte des zones accidentogènes</h1>
      {erreur && <div className="alert alert-danger">{erreur}</div>}
      <CarteZones zones={zones} />
    </div>
  )
}
