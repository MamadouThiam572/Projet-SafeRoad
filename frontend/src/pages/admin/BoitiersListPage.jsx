import { useEffect, useState } from 'react'
import { Loader } from '../../components/communs/Loader'
import { creerBoitier, listerBoitiers, regenererCle } from '../../services/boitiersService'

export function BoitiersListPage() {
  const [boitiers, setBoitiers] = useState([])
  const [chargement, setChargement] = useState(true)
  const [nouvelleCle, setNouvelleCle] = useState(null)
  const [formulaire, setFormulaire] = useState({ proprietaire_nom: '', proprietaire_telephone: '', numero_immatriculation: '' })

  function rafraichir() {
    return listerBoitiers().then(setBoitiers)
  }

  useEffect(() => {
    rafraichir().finally(() => setChargement(false))
  }, [])

  async function handleCreer(e) {
    e.preventDefault()
    const boitier = await creerBoitier(formulaire)
    setNouvelleCle({ id: boitier.id, api_key: boitier.api_key })
    setFormulaire({ proprietaire_nom: '', proprietaire_telephone: '', numero_immatriculation: '' })
    await rafraichir()
  }

  async function handleRegenererCle(id) {
    const resultat = await regenererCle(id)
    setNouvelleCle(resultat)
  }

  if (chargement) return <Loader />

  return (
    <div className="container py-4">
      <h1 className="h4 mb-4">Gestion des boîtiers</h1>

      {nouvelleCle && (
        <div className="alert alert-warning">
          Clé API pour le boîtier <strong>{nouvelleCle.id}</strong> (à noter, elle ne sera plus jamais affichée) :{' '}
          <code>{nouvelleCle.api_key}</code>
        </div>
      )}

      <form onSubmit={handleCreer} className="row g-2 mb-4">
        <div className="col-md-3">
          <input
            className="form-control"
            placeholder="Nom du propriétaire"
            value={formulaire.proprietaire_nom}
            onChange={(e) => setFormulaire({ ...formulaire, proprietaire_nom: e.target.value })}
          />
        </div>
        <div className="col-md-3">
          <input
            className="form-control"
            placeholder="Téléphone"
            value={formulaire.proprietaire_telephone}
            onChange={(e) => setFormulaire({ ...formulaire, proprietaire_telephone: e.target.value })}
          />
        </div>
        <div className="col-md-3">
          <input
            className="form-control"
            placeholder="Immatriculation"
            value={formulaire.numero_immatriculation}
            onChange={(e) => setFormulaire({ ...formulaire, numero_immatriculation: e.target.value })}
          />
        </div>
        <div className="col-md-3">
          <button type="submit" className="btn btn-primary w-100">Créer un boîtier</button>
        </div>
      </form>

      <table className="table table-striped">
        <thead>
          <tr>
            <th>ID</th>
            <th>Propriétaire</th>
            <th>Immatriculation</th>
            <th>Statut</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {boitiers.map((b) => (
            <tr key={b.id}>
              <td><code>{b.id}</code></td>
              <td>{b.proprietaire_nom}</td>
              <td>{b.numero_immatriculation}</td>
              <td>{b.statut}</td>
              <td>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => handleRegenererCle(b.id)}>
                  Régénérer la clé
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
