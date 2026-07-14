import { useEffect, useMemo, useState } from 'react'
import { CarteZones } from '../../components/carte/CarteZones'
import { LegendeDanger } from '../../components/carte/LegendeDanger'
import { Icone } from '../../components/communs/Icone'
import { Loader } from '../../components/communs/Loader'
import { listerZones } from '../../services/zonesService'

const COMPTEURS = [
  { cle: 'total', libelle: 'Zones validées', stripe: 'var(--hivis)' },
  { cle: 'critique', libelle: 'Critiques', stripe: 'var(--danger-critique)' },
  { cle: 'vigilance', libelle: 'Sous vigilance', stripe: 'var(--danger-moyen)' },
  { cle: 'normale', libelle: 'Normales', stripe: 'var(--danger-faible)' },
]

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

  const comptes = useMemo(() => {
    const parNiveau = { normale: 0, vigilance: 0, critique: 0 }
    for (const z of zones) {
      if (z.niveau_danger in parNiveau) parNiveau[z.niveau_danger] += 1
    }
    return { total: zones.length, ...parNiveau }
  }, [zones])

  if (chargement) return <Loader />

  return (
    <div className="container py-4 accueil">
      {/* ---------- En-tête ---------- */}
      <div className="carte-header">
        <div className="eyebrow">Carte publique · Sénégal</div>
        <h1>Carte des zones accidentogènes</h1>
        <p>
          Chaque cercle marque un point noir identifié à partir des incidents détectés sur le terrain,
          puis validé par un administrateur. Cliquez sur une zone pour voir son niveau de danger et le
          nombre d'incidents recensés.
        </p>
        <div className="carte-compteurs">
          {COMPTEURS.map((c) => (
            <div className="carte-compteur" key={c.cle} style={{ '--stripe': c.stripe }}>
              <div className="val">{comptes[c.cle]}</div>
              <div className="lib">{c.libelle}</div>
            </div>
          ))}
        </div>
      </div>

      {erreur && <div className="alert alert-danger mt-3">{erreur}</div>}

      {/* ---------- Carte ---------- */}
      <div className="carte-cadre">
        <div className="barre">
          <span style={{ fontWeight: 600, color: 'var(--ink-soft)', fontSize: '0.9rem' }}>
            Agglomération de Dakar
          </span>
          <LegendeDanger />
        </div>
        <CarteZones zones={zones} />
      </div>

      <p className="carte-note">
        <Icone nom="attention" taille={16} />
        Données agrégées et anonymisées. Une zone n'apparaît qu'après validation par un administrateur.
      </p>
    </div>
  )
}
