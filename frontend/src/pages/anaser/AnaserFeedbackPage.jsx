import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Badge } from '../../components/communs/Badge'
import { EmptyState } from '../../components/communs/EmptyState'
import { ErrorState } from '../../components/communs/ErrorState'
import { PageHeader } from '../../components/communs/PageHeader'
import { Pagination } from '../../components/communs/Pagination'
import { SkeletonLignes } from '../../components/communs/Skeleton'
import { useCompteursAnaser } from '../../hooks/useCompteursAnaser'
import { useRequete } from '../../hooks/useRequete'
import { useToast } from '../../hooks/useToast'
import { creerFeedbackAnaser, listerFeedbacksAnaserPagines, mettreAJourFeedbackAnaser } from '../../services/anaserService'
import { listerZones } from '../../services/zonesService'

const ACTIONS = [
  { valeur: 'aucune', libelle: 'Aucune' },
  { valeur: 'signalisation', libelle: 'Signalisation' },
  { valeur: 'ralentisseur', libelle: 'Ralentisseur' },
  { valeur: 'eclairage', libelle: 'Éclairage' },
  { valeur: 'autre', libelle: 'Autre' },
]

// Statut suivant dans le cycle de vie d'un feedback : soumise → en cours → réalisée (terminal).
const STATUT_SUIVANT = { soumise: 'en_cours', en_cours: 'realisee' }
const LIBELLE_ACTION_STATUT = { soumise: 'Démarrer', en_cours: 'Marquer réalisée' }

export function AnaserFeedbackPage() {
  const [searchParams] = useSearchParams()
  const zonePreselectionnee = searchParams.get('zone') ?? ''
  const [pageUrl, setPageUrl] = useState(undefined)
  const chargerFeedback = () => Promise.all([listerFeedbacksAnaserPagines(pageUrl), listerZones()])
  const { donnees, chargement, erreur, rafraichir } = useRequete(chargerFeedback, [pageUrl])
  const { rafraichirCompteurs } = useCompteursAnaser()
  const { succes } = useToast()
  const [formulaire, setFormulaire] = useState({
    zone: zonePreselectionnee,
    commentaire: '',
    action_prevue: 'aucune',
  })
  const [envoi, setEnvoi] = useState(false)

  const page = donnees?.[0]
  const zones = donnees?.[1] ?? []
  const feedbacks = page?.results ?? []

  async function handleSubmit(e) {
    e.preventDefault()
    setEnvoi(true)
    try {
      await creerFeedbackAnaser(formulaire)
      setFormulaire({ zone: '', commentaire: '', action_prevue: 'aucune' })
      await rafraichir()
      rafraichirCompteurs().catch(() => {})
      succes('Feedback envoyé.')
    } finally {
      setEnvoi(false)
    }
  }

  async function handleAvancerStatut(feedback) {
    const suivant = STATUT_SUIVANT[feedback.statut]
    if (!suivant) return
    await mettreAJourFeedbackAnaser(feedback.id, suivant)
    await rafraichir()
    rafraichirCompteurs().catch(() => {})
    succes(suivant === 'realisee' ? 'Feedback marqué comme réalisé.' : 'Feedback démarré.')
  }

  return (
    <>
      <PageHeader
        titre="Feedback ANASER"
        icone="boite"
        description="Proposez une action corrective pour une zone à risque, et suivez son avancement jusqu'à réalisation."
      />

      {erreur && !chargement && <ErrorState onReessayer={rafraichir} />}

      {chargement && (
        <div className="surface-card overflow-hidden">
          <table className="table table-striped mb-0">
            <tbody><SkeletonLignes colonnes={5} lignes={4} /></tbody>
          </table>
        </div>
      )}

      {donnees && !chargement && !erreur && (
        <>
          <form onSubmit={handleSubmit} className="surface-card p-3 mb-4 grid grid-cols-1 gap-2 md:grid-cols-12 md:items-end">
            <div className="md:col-span-3">
              <label className="form-label sr-only" htmlFor="feedback-zone">Zone</label>
              <select
                id="feedback-zone"
                className="form-select"
                value={formulaire.zone}
                onChange={(e) => setFormulaire({ ...formulaire, zone: e.target.value })}
                required
              >
                <option value="">Choisir une zone</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>{z.nom || `Zone #${z.id}`}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-4">
              <label className="form-label sr-only" htmlFor="feedback-commentaire">Commentaire</label>
              <input
                id="feedback-commentaire"
                className="form-control"
                placeholder="Commentaire"
                value={formulaire.commentaire}
                onChange={(e) => setFormulaire({ ...formulaire, commentaire: e.target.value })}
                required
              />
            </div>
            <div className="md:col-span-3">
              <label className="form-label sr-only" htmlFor="feedback-action">Action prévue</label>
              <select
                id="feedback-action"
                className="form-select"
                value={formulaire.action_prevue}
                onChange={(e) => setFormulaire({ ...formulaire, action_prevue: e.target.value })}
              >
                {ACTIONS.map((a) => <option key={a.valeur} value={a.valeur}>{a.libelle}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <button type="submit" className="btn btn-primary w-full" disabled={envoi}>
                {envoi ? 'Envoi…' : 'Envoyer'}
              </button>
            </div>
          </form>

          {feedbacks.length === 0 ? (
            <div className="surface-card">
              <EmptyState
                icone="boite"
                titre="Aucun feedback"
                message="Proposez une première action corrective à l'aide du formulaire ci-dessus."
              />
            </div>
          ) : (
            <div className="surface-card overflow-hidden">
              <div style={{ overflowX: 'auto' }}>
                <table className="table table-striped mb-0">
                  <caption className="visually-hidden">Feedbacks ANASER et leur statut de traitement</caption>
                  <thead>
                    <tr>
                      <th>Zone</th>
                      <th>Commentaire</th>
                      <th>Action prévue</th>
                      <th>Statut</th>
                      <th><span className="visually-hidden">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {feedbacks.map((f) => (
                      <tr key={f.id}>
                        <td>{f.zone ? `Zone #${f.zone}` : `Incident #${f.incident}`}</td>
                        <td>{f.commentaire}</td>
                        <td>{f.action_prevue_libelle ?? f.action_prevue}</td>
                        <td><Badge valeur={f.statut} libelle={f.statut_libelle} /></td>
                        <td>
                          {STATUT_SUIVANT[f.statut] && (
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => handleAvancerStatut(f)}
                              aria-label={`${LIBELLE_ACTION_STATUT[f.statut]} pour le feedback #${f.id}`}
                            >
                              {LIBELLE_ACTION_STATUT[f.statut]}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination pagination={page} onNaviguer={setPageUrl} />
            </div>
          )}
        </>
      )}
    </>
  )
}
