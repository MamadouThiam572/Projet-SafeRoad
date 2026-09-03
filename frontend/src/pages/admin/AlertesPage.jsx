import { useState } from 'react'
import { Badge } from '../../components/communs/Badge'
import { EmptyState } from '../../components/communs/EmptyState'
import { ErrorState } from '../../components/communs/ErrorState'
import { PageHeader } from '../../components/communs/PageHeader'
import { Pagination } from '../../components/communs/Pagination'
import { SkeletonLignes } from '../../components/communs/Skeleton'
import { useCompteursAdmin } from '../../hooks/useCompteursAdmin'
import { useRequete } from '../../hooks/useRequete'
import { useToast } from '../../hooks/useToast'
import { listerAlertesPaginees, traiterAlerte } from '../../services/alertesService'

export function AlertesPage() {
  const [pageUrl, setPageUrl] = useState(undefined)
  const { donnees: page, chargement, erreur, rafraichir } = useRequete(() => listerAlertesPaginees(pageUrl), [pageUrl])
  const { rafraichirCompteurs } = useCompteursAdmin()
  const { succes } = useToast()
  const alertes = page?.results ?? []

  async function handleTraiter(alerte) {
    await traiterAlerte(alerte.id, 'traitee')
    await rafraichir()
    rafraichirCompteurs().catch(() => {})
    succes(`Alerte de l'incident #${alerte.incident} marquée comme traitée.`)
  }

  return (
    <>
      <PageHeader
        titre="Alertes critiques"
        icone="alerte"
        description="Suivez et traitez les alertes générées à partir des incidents critiques."
      />

      {erreur && !chargement && <ErrorState onReessayer={rafraichir} />}

      {!erreur && !chargement && alertes.length === 0 && (
        <div className="surface-card">
          <EmptyState
            icone="alerte"
            titre="Aucune alerte"
            message="Aucune alerte n'a été générée pour le moment."
          />
        </div>
      )}

      {!erreur && (chargement || alertes.length > 0) && (
        <div className="surface-card overflow-hidden">
          <div style={{ overflowX: 'auto' }}>
            <table className="table table-striped mb-0">
              <caption className="visually-hidden">Alertes critiques et leur statut de traitement</caption>
              <thead>
                <tr>
                  <th>Incident</th>
                  <th>Statut</th>
                  <th>Créée le</th>
                  <th><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {chargement ? (
                  <SkeletonLignes colonnes={4} lignes={4} />
                ) : (
                  alertes.map((alerte) => (
                    <tr key={alerte.id}>
                      <td className="font-mono">#{alerte.incident}</td>
                      <td><Badge valeur={alerte.statut} libelle={alerte.statut_libelle} /></td>
                      <td className="font-mono">{new Date(alerte.date_creation).toLocaleString('fr-FR')}</td>
                      <td>
                        {alerte.statut !== 'traitee' && (
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => handleTraiter(alerte)}
                            aria-label={`Marquer l'alerte de l'incident #${alerte.incident} comme traitée`}
                          >
                            Marquer comme traitée
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!chargement && <Pagination pagination={page} onNaviguer={setPageUrl} />}
        </div>
      )}
    </>
  )
}
