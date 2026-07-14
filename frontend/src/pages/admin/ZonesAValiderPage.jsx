import { useState } from 'react'
import { Badge } from '../../components/communs/Badge'
import { EmptyState } from '../../components/communs/EmptyState'
import { ErrorState } from '../../components/communs/ErrorState'
import { Loader } from '../../components/communs/Loader'
import { PageHeader } from '../../components/communs/PageHeader'
import { useAdmin } from '../../hooks/useAdmin'
import { useRequete } from '../../hooks/useRequete'
import { genererZones, listerZones, validerZone } from '../../services/zonesService'

export function ZonesAValiderPage() {
  const { donnees: zones, chargement, erreur, rafraichir } = useRequete(listerZones)
  const { rafraichirCompteurs } = useAdmin()
  const [generation, setGeneration] = useState(false)

  async function handleValider(id, statut) {
    await validerZone(id, statut)
    await rafraichir()
    rafraichirCompteurs().catch(() => {})
  }

  async function handleGenerer() {
    setGeneration(true)
    try {
      await genererZones()
      await rafraichir()
      rafraichirCompteurs().catch(() => {})
    } finally {
      setGeneration(false)
    }
  }

  return (
    <>
      <PageHeader
        titre="Zones accidentogènes"
        icone="zone"
        description="Validez ou rejetez les zones à risque détectées automatiquement à partir des incidents."
        actions={
          <button className="btn btn-primary" onClick={handleGenerer} disabled={generation || chargement}>
            {generation ? 'Génération…' : 'Relancer la détection'}
          </button>
        }
      />

      {chargement && <Loader />}
      {erreur && !chargement && <ErrorState onReessayer={rafraichir} />}

      {zones && !chargement && !erreur && (
        zones.length === 0 ? (
          <div className="surface-card">
            <EmptyState
              icone="zone"
              titre="Aucune zone détectée"
              message="Lancez la détection pour analyser les incidents et générer des zones à risque."
            />
          </div>
        ) : (
          <div className="surface-card p-3" style={{ overflowX: 'auto' }}>
            <table className="table table-striped mb-0">
              <caption className="visually-hidden">Zones accidentogènes et leur statut de validation</caption>
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>Niveau de danger</th>
                  <th>Incidents</th>
                  <th>Statut</th>
                  <th><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {zones.map((zone) => {
                  const nom = zone.nom || `Zone #${zone.id}`
                  return (
                    <tr key={zone.id}>
                      <td>{nom}</td>
                      <td><Badge valeur={zone.niveau_danger} /></td>
                      <td className="font-mono">{zone.nombre_incidents}</td>
                      <td><Badge valeur={zone.statut_validation} /></td>
                      <td>
                        {zone.statut_validation === 'en_attente' && (
                          <>
                            <button
                              className="btn btn-sm btn-success me-2"
                              onClick={() => handleValider(zone.id, 'validee')}
                              aria-label={`Valider ${nom}`}
                            >
                              Valider
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleValider(zone.id, 'rejetee')}
                              aria-label={`Rejeter ${nom}`}
                            >
                              Rejeter
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </>
  )
}
