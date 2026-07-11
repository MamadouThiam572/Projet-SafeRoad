import { useEffect, useState } from 'react'
import { Loader } from '../../components/communs/Loader'
import { creerFeedbackAnaser, listerFeedbacksAnaser } from '../../services/anaserService'
import { listerZones } from '../../services/zonesService'

const ACTIONS = ['aucune', 'signalisation', 'ralentisseur', 'eclairage', 'autre']

export function AnaserFeedbackPage() {
  const [feedbacks, setFeedbacks] = useState([])
  const [zones, setZones] = useState([])
  const [chargement, setChargement] = useState(true)
  const [formulaire, setFormulaire] = useState({ zone: '', commentaire: '', action_prevue: 'aucune' })

  function rafraichir() {
    return listerFeedbacksAnaser().then(setFeedbacks)
  }

  useEffect(() => {
    Promise.all([rafraichir(), listerZones().then(setZones)]).finally(() => setChargement(false))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    await creerFeedbackAnaser(formulaire)
    setFormulaire({ zone: '', commentaire: '', action_prevue: 'aucune' })
    await rafraichir()
  }

  if (chargement) return <Loader />

  return (
    <div className="container py-4">
      <h1 className="h4 mb-4">Feedback ANASER</h1>

      <form onSubmit={handleSubmit} className="surface-card p-3 row g-2 mb-4">
        <div className="col-md-3">
          <select
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
        <div className="col-md-4">
          <input
            className="form-control"
            placeholder="Commentaire"
            value={formulaire.commentaire}
            onChange={(e) => setFormulaire({ ...formulaire, commentaire: e.target.value })}
            required
          />
        </div>
        <div className="col-md-3">
          <select
            className="form-select"
            value={formulaire.action_prevue}
            onChange={(e) => setFormulaire({ ...formulaire, action_prevue: e.target.value })}
          >
            {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="col-md-2">
          <button type="submit" className="btn btn-primary w-100">Envoyer</button>
        </div>
      </form>

      <div className="surface-card p-3" style={{ overflowX: 'auto' }}>
        <table className="table table-striped mb-0">
          <thead>
            <tr>
              <th>Zone</th>
              <th>Commentaire</th>
              <th>Action prévue</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {feedbacks.map((f) => (
              <tr key={f.id}>
                <td>{f.zone}</td>
                <td>{f.commentaire}</td>
                <td>{f.action_prevue}</td>
                <td><span className="badge badge-statut-neutre">{f.statut}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
