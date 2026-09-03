import { useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/communs/Badge'
import { CarteZones } from '../../components/carte/CarteZones'
import { LegendeDanger } from '../../components/carte/LegendeDanger'
import { EmptyState } from '../../components/communs/EmptyState'
import { Icone } from '../../components/communs/Icone'
import { Loader } from '../../components/communs/Loader'
import { useMetaPage } from '../../hooks/useMetaPage'
import { listerZones } from '../../services/zonesService'

const COMPTEURS = [
  { cle: 'total', libelle: 'Zones validées', stripe: 'var(--hivis)' },
  { cle: 'critique', libelle: 'Critiques', stripe: 'var(--danger-critique)' },
  { cle: 'vigilance', libelle: 'Sous vigilance', stripe: 'var(--danger-moyen)' },
  { cle: 'normale', libelle: 'Normales', stripe: 'var(--danger-faible)' },
]

export function CartePubliquePage() {
  useMetaPage({
    titre: 'Carte des zones à risque',
    description: "Carte publique des zones accidentogènes détectées et validées au Sénégal, mise à jour en continu.",
    chemin: '/carte',
  })
  const [zones, setZones] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    listerZones()
      .then(setZones)
      .catch(() => setErreur("Impossible de charger les zones accidentogènes. Vérifiez votre connexion et réessayez."))
      .finally(() => setChargement(false))
  }, [])

  const comptes = useMemo(() => {
    const parNiveau = { normale: 0, vigilance: 0, critique: 0 }
    for (const z of zones) {
      if (z.niveau_danger in parNiveau) parNiveau[z.niveau_danger] += 1
    }
    return { total: zones.length, ...parNiveau }
  }, [zones])

  const derniereMaj = useMemo(() => {
    if (zones.length === 0) return null
    return zones.reduce((plusRecent, z) => (z.date_maj > plusRecent ? z.date_maj : plusRecent), zones[0].date_maj)
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
          puis validé par un administrateur. La carte comme le tableau ci-dessous présentent les mêmes
          zones, avec leur niveau de danger et le nombre d'incidents recensés.
        </p>
        {derniereMaj && (
          <p className="font-mono" style={{ fontSize: '0.8rem', color: 'rgba(244,246,249,0.6)', marginTop: '0.5rem' }}>
            Dernière mise à jour : {new Date(derniereMaj).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}
          </p>
        )}
        <div className="carte-compteurs">
          {COMPTEURS.map((c) => (
            <div className="carte-compteur" key={c.cle} style={{ '--stripe': c.stripe }}>
              <div className="val">{comptes[c.cle]}</div>
              <div className="lib">{c.libelle}</div>
            </div>
          ))}
        </div>
      </div>

      {erreur && (
        <div className="error-state mt-3" role="alert">
          <span className="error-state__icone" aria-hidden="true"><Icone nom="attention" taille={22} /></span>
          <span className="error-state__message">{erreur}</span>
        </div>
      )}

      {!erreur && zones.length === 0 ? (
        <div className="surface-card mt-4">
          <EmptyState
            icone="zone"
            titre="Aucune zone publiée pour le moment"
            message="Les zones accidentogènes apparaissent ici une fois validées par un administrateur."
          />
        </div>
      ) : (
        <>
          {/* ---------- Carte ---------- */}
          <div className="carte-cadre">
            <div className="barre">
              <span style={{ fontWeight: 600, color: 'var(--ink-soft)', fontSize: '0.9rem' }}>
                Sénégal
              </span>
              <LegendeDanger />
            </div>
            <CarteZones zones={zones} />
          </div>

          {/* ---------- Équivalent texte, accessible au clavier et aux lecteurs d'écran :
              la carte seule (popups Leaflet non focusables) ne suffit pas à transmettre
              cette information de sécurité publique à tous les usagers. Sert aussi de
              vue de secours quand des zones proches se chevauchent visuellement sur la
              carte à l'échelle. ---------- */}
          <div className="surface-card mt-4 p-3" style={{ overflowX: 'auto' }}>
            <table className="table table-striped mb-0">
              <caption className="mb-2 text-left text-sm font-semibold text-ink">
                Liste des zones accidentogènes publiées, triées par niveau de danger
              </caption>
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>Niveau de danger</th>
                  <th>Incidents recensés</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((zone) => (
                  <tr key={zone.id}>
                    <td>{zone.nom || `Zone #${zone.id}`}</td>
                    <td><Badge valeur={zone.niveau_danger} libelle={zone.niveau_danger_libelle} /></td>
                    <td className="font-mono">{zone.nombre_incidents}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="carte-note">
        <Icone nom="attention" taille={16} />
        Données agrégées et anonymisées. Une zone n'apparaît qu'après validation par un administrateur.
      </p>
    </div>
  )
}
