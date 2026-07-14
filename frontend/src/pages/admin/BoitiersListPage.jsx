import { useState } from 'react'
import { EmptyState } from '../../components/communs/EmptyState'
import { ErrorState } from '../../components/communs/ErrorState'
import { Loader } from '../../components/communs/Loader'
import { PageHeader } from '../../components/communs/PageHeader'
import { useRequete } from '../../hooks/useRequete'
import { creerBoitier, listerBoitiers, regenererCle } from '../../services/boitiersService'

const FORMULAIRE_VIDE = { proprietaire_nom: '', proprietaire_telephone: '', numero_immatriculation: '' }

export function BoitiersListPage() {
  const { donnees: boitiers, chargement, erreur, rafraichir } = useRequete(listerBoitiers)
  const [nouvelleCle, setNouvelleCle] = useState(null)
  const [formulaire, setFormulaire] = useState(FORMULAIRE_VIDE)
  const [envoi, setEnvoi] = useState(false)

  async function handleCreer(e) {
    e.preventDefault()
    setEnvoi(true)
    try {
      const boitier = await creerBoitier(formulaire)
      setNouvelleCle({ id: boitier.id, api_key: boitier.api_key })
      setFormulaire(FORMULAIRE_VIDE)
      await rafraichir()
    } finally {
      setEnvoi(false)
    }
  }

  async function handleRegenererCle(id) {
    const resultat = await regenererCle(id)
    setNouvelleCle(resultat)
  }

  return (
    <>
      <PageHeader
        titre="Gestion des boîtiers"
        icone="boitier"
        description="Enregistrez les boîtiers embarqués et gérez leurs clés d'API."
      />

      {nouvelleCle && (
        <div className="alert alert-warning" role="alert">
          Clé API du boîtier <strong>{nouvelleCle.id}</strong> — à noter maintenant, elle ne sera plus jamais
          réaffichée : <code>{nouvelleCle.api_key}</code>
        </div>
      )}

      <form onSubmit={handleCreer} className="surface-card p-3 mb-4">
        <div className="row g-2 align-items-end">
          <div className="col-md-3">
            <label className="form-label" htmlFor="boitier-nom">Propriétaire</label>
            <input
              id="boitier-nom"
              className="form-control"
              placeholder="Nom du propriétaire"
              value={formulaire.proprietaire_nom}
              onChange={(e) => setFormulaire({ ...formulaire, proprietaire_nom: e.target.value })}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label" htmlFor="boitier-tel">Téléphone</label>
            <input
              id="boitier-tel"
              className="form-control"
              placeholder="Téléphone"
              value={formulaire.proprietaire_telephone}
              onChange={(e) => setFormulaire({ ...formulaire, proprietaire_telephone: e.target.value })}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label" htmlFor="boitier-immat">Immatriculation</label>
            <input
              id="boitier-immat"
              className="form-control"
              placeholder="Immatriculation"
              value={formulaire.numero_immatriculation}
              onChange={(e) => setFormulaire({ ...formulaire, numero_immatriculation: e.target.value })}
            />
          </div>
          <div className="col-md-3">
            <button type="submit" className="btn btn-primary w-100" disabled={envoi}>
              {envoi ? 'Création…' : 'Créer un boîtier'}
            </button>
          </div>
        </div>
      </form>

      {chargement && <Loader />}
      {erreur && !chargement && <ErrorState onReessayer={rafraichir} />}

      {boitiers && !chargement && !erreur && (
        boitiers.length === 0 ? (
          <div className="surface-card">
            <EmptyState
              icone="boitier"
              titre="Aucun boîtier enregistré"
              message="Créez un premier boîtier à l'aide du formulaire ci-dessus."
            />
          </div>
        ) : (
          <div className="surface-card p-3" style={{ overflowX: 'auto' }}>
            <table className="table table-striped mb-0">
              <caption className="visually-hidden">Boîtiers enregistrés</caption>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Propriétaire</th>
                  <th>Immatriculation</th>
                  <th>Statut</th>
                  <th><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {boitiers.map((b) => (
                  <tr key={b.id}>
                    <td><code>{b.id}</code></td>
                    <td>{b.proprietaire_nom}</td>
                    <td>{b.numero_immatriculation}</td>
                    <td><span className="badge badge-statut-neutre">{b.statut}</span></td>
                    <td>
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => handleRegenererCle(b.id)}
                        aria-label={`Régénérer la clé du boîtier ${b.id}`}
                      >
                        Régénérer la clé
                      </button>
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
