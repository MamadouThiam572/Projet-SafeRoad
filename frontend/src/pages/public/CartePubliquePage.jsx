import { useEffect, useState } from 'react'
import { CarteZones } from '../../components/carte/CarteZones'
import { LegendeDanger } from '../../components/carte/LegendeDanger'
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
    <div className="container py-4">
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
        <div>
          <h1 className="h4 mb-1">Carte des zones accidentogènes</h1>
          <p style={{ color: 'var(--ink-soft)', marginBottom: 0 }}>
            {zones.length} zone{zones.length !== 1 ? 's' : ''} identifiée{zones.length !== 1 ? 's' : ''} et validée{zones.length !== 1 ? 's' : ''}
          </p>
        </div>
        <LegendeDanger />
      </div>
      {erreur && <div className="alert alert-danger">{erreur}</div>}
      <div className="surface-card p-2" style={{ overflow: 'hidden' }}>
        <CarteZones zones={zones} />
      </div>
    </div>
  )
}
