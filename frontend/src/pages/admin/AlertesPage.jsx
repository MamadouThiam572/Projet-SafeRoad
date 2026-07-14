import { Badge } from '../../components/communs/Badge'
import { EmptyState } from '../../components/communs/EmptyState'
import { ErrorState } from '../../components/communs/ErrorState'
import { Loader } from '../../components/communs/Loader'
import { PageHeader } from '../../components/communs/PageHeader'
import { useAdmin } from '../../hooks/useAdmin'
import { useRequete } from '../../hooks/useRequete'
import { listerAlertes, traiterAlerte } from '../../services/alertesService'

export function AlertesPage() {
  const { donnees: alertes, chargement, erreur, rafraichir } = useRequete(listerAlertes)
  const { rafraichirCompteurs } = useAdmin()

  async function handleTraiter(id) {
    await traiterAlerte(id, 'traitee')
    await rafraichir()
    rafraichirCompteurs().catch(() => {})
  }

  return (
    <>
      <PageHeader
        titre="Alertes critiques"
        icone="alerte"
        description="Suivez et traitez les alertes générées à partir des incidents critiques."
      />

      {chargement && <Loader />}
      {erreur && !chargement && <ErrorState onReessayer={rafraichir} />}

      {alertes && !chargement && !erreur && (
        alertes.length === 0 ? (
          <div className="surface-card">
            <EmptyState
              icone="alerte"
              titre="Aucune alerte"
              message="Aucune alerte n'a été générée pour le moment."
            />
          </div>
        ) : (
          <div className="surface-card p-3" style={{ overflowX: 'auto' }}>
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
                {alertes.map((alerte) => (
                  <tr key={alerte.id}>
                    <td className="font-mono">#{alerte.incident}</td>
                    <td><Badge valeur={alerte.statut} /></td>
                    <td className="font-mono">{new Date(alerte.date_creation).toLocaleString('fr-FR')}</td>
                    <td>
                      {alerte.statut !== 'traitee' && (
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => handleTraiter(alerte.id)}
                          aria-label={`Marquer l'alerte de l'incident #${alerte.incident} comme traitée`}
                        >
                          Marquer comme traitée
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </>
  )
}
