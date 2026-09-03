import { useState } from 'react'
import { Badge } from '../../components/communs/Badge'
import { ConfirmDialog } from '../../components/communs/ConfirmDialog'
import { EmptyState } from '../../components/communs/EmptyState'
import { ErrorState } from '../../components/communs/ErrorState'
import { PageHeader } from '../../components/communs/PageHeader'
import { SkeletonLignes } from '../../components/communs/Skeleton'
import { useCompteursAdmin } from '../../hooks/useCompteursAdmin'
import { useConfirmDialog } from '../../hooks/useConfirmDialog'
import { useRequete } from '../../hooks/useRequete'
import { useToast } from '../../hooks/useToast'
import { genererZones, listerZones, validerZone } from '../../services/zonesService'

export function ZonesAValiderPage() {
  const { donnees: zones, chargement, erreur, rafraichir } = useRequete(listerZones)
  const { rafraichirCompteurs } = useCompteursAdmin()
  const { etatConfirmation, demanderConfirmation, confirmer, annuler } = useConfirmDialog()
  const { succes } = useToast()
  const [generation, setGeneration] = useState(false)

  async function handleValider(zone) {
    await validerZone(zone.id, 'validee')
    await rafraichir()
    rafraichirCompteurs().catch(() => {})
    succes(`${zone.nom || `Zone #${zone.id}`} validée.`)
  }

  async function handleRejeter(zone) {
    const nom = zone.nom || `Zone #${zone.id}`
    const confirme = await demanderConfirmation({
      titre: 'Rejeter cette zone ?',
      message:
        `« ${nom} » ne sera plus proposée à la validation. Si de nouveaux incidents confirment ` +
        'ce cluster, la détection pourra la faire réapparaître — cette action est sans risque pour les données déjà enregistrées.',
      labelConfirmer: 'Rejeter',
    })
    if (!confirme) return
    await validerZone(zone.id, 'rejetee')
    await rafraichir()
    rafraichirCompteurs().catch(() => {})
    succes(`${nom} rejetée.`)
  }

  async function handleGenerer() {
    setGeneration(true)
    try {
      const resultat = await genererZones()
      await rafraichir()
      rafraichirCompteurs().catch(() => {})
      succes(`Détection relancée : ${resultat.zones_creees} zone(s) créée(s), ${resultat.zones_mises_a_jour} mise(s) à jour.`)
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

      {erreur && !chargement && <ErrorState onReessayer={rafraichir} />}

      {!erreur && !chargement && zones && zones.length === 0 && (
        <div className="surface-card">
          <EmptyState
            icone="zone"
            titre="Aucune zone détectée"
            message="Lancez la détection pour analyser les incidents et générer des zones à risque."
          />
        </div>
      )}

      {!erreur && (chargement || (zones && zones.length > 0)) && (
        <div className="surface-card overflow-hidden">
          <div style={{ overflowX: 'auto' }}>
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
                {chargement ? <SkeletonLignes colonnes={5} lignes={4} /> : zones.map((zone) => {
                  const nom = zone.nom || `Zone #${zone.id}`
                  return (
                    <tr key={zone.id}>
                      <td>{nom}</td>
                      <td><Badge valeur={zone.niveau_danger} libelle={zone.niveau_danger_libelle} /></td>
                      <td className="font-mono">{zone.nombre_incidents}</td>
                      <td><Badge valeur={zone.statut_validation} libelle={zone.statut_validation_libelle} /></td>
                      <td>
                        {zone.statut_validation === 'en_attente' && (
                          <>
                            <button
                              className="btn btn-sm btn-success me-2"
                              onClick={() => handleValider(zone)}
                              aria-label={`Valider ${nom}`}
                            >
                              Valider
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleRejeter(zone)}
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
        </div>
      )}

      <ConfirmDialog etat={etatConfirmation} onConfirmer={confirmer} onAnnuler={annuler} />
    </>
  )
}
