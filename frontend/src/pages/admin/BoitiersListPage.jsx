import { useState } from 'react'
import { ConfirmDialog } from '../../components/communs/ConfirmDialog'
import { EmptyState } from '../../components/communs/EmptyState'
import { ErrorState } from '../../components/communs/ErrorState'
import { PageHeader } from '../../components/communs/PageHeader'
import { Pagination } from '../../components/communs/Pagination'
import { SkeletonLignes } from '../../components/communs/Skeleton'
import { useConfirmDialog } from '../../hooks/useConfirmDialog'
import { useRequete } from '../../hooks/useRequete'
import { creerBoitier, listerBoitiersPagines, regenererCle } from '../../services/boitiersService'

const FORMULAIRE_VIDE = { proprietaire_nom: '', proprietaire_telephone: '', numero_immatriculation: '' }

export function BoitiersListPage() {
  const [pageUrl, setPageUrl] = useState(undefined)
  const { donnees: page, chargement, erreur, rafraichir } = useRequete(() => listerBoitiersPagines(pageUrl), [pageUrl])
  const { etatConfirmation, demanderConfirmation, confirmer, annuler } = useConfirmDialog()
  const [nouvelleCle, setNouvelleCle] = useState(null)
  const [formulaire, setFormulaire] = useState(FORMULAIRE_VIDE)
  const [envoi, setEnvoi] = useState(false)
  const boitiers = page?.results ?? []

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

  async function handleRegenererCle(boitier) {
    // Action à conséquence physique : le boîtier cesse de transmettre avec l'ancienne
    // clé dès expiration de la fenêtre de grâce — jamais au premier clic.
    const confirme = await demanderConfirmation({
      titre: 'Régénérer la clé de ce boîtier ?',
      danger: true,
      labelConfirmer: 'Régénérer',
      message:
        `Le boîtier ${boitier.id} devra être reconfiguré avec la nouvelle clé avant l'expiration de la ` +
        "fenêtre de grâce, sans quoi il cessera de transmettre ses données. L'ancienne clé reste valide " +
        'temporairement pour laisser le temps de reconfigurer le dispositif sur le terrain.',
    })
    if (!confirme) return
    const resultat = await regenererCle(boitier.id)
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
          {nouvelleCle.ancienne_cle_valide_jusqu_a && (
            <>
              <br />
              L'ancienne clé reste valide jusqu'au{' '}
              {new Date(nouvelleCle.ancienne_cle_valide_jusqu_a).toLocaleString('fr-FR')}.
            </>
          )}
        </div>
      )}

      <form onSubmit={handleCreer} className="surface-card p-3 mb-4">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4 md:items-end">
          <div>
            <label className="form-label" htmlFor="boitier-nom">Propriétaire</label>
            <input
              id="boitier-nom"
              className="form-control"
              placeholder="Nom du propriétaire"
              value={formulaire.proprietaire_nom}
              onChange={(e) => setFormulaire({ ...formulaire, proprietaire_nom: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="boitier-tel">Téléphone</label>
            <input
              id="boitier-tel"
              className="form-control"
              placeholder="Téléphone"
              value={formulaire.proprietaire_telephone}
              onChange={(e) => setFormulaire({ ...formulaire, proprietaire_telephone: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="boitier-immat">Immatriculation</label>
            <input
              id="boitier-immat"
              className="form-control"
              placeholder="Immatriculation"
              value={formulaire.numero_immatriculation}
              onChange={(e) => setFormulaire({ ...formulaire, numero_immatriculation: e.target.value })}
            />
          </div>
          <div>
            <button type="submit" className="btn btn-primary w-full" disabled={envoi}>
              {envoi ? 'Création…' : 'Créer un boîtier'}
            </button>
          </div>
        </div>
      </form>

      {erreur && !chargement && <ErrorState onReessayer={rafraichir} />}

      {!erreur && !chargement && boitiers.length === 0 && (
        <div className="surface-card">
          <EmptyState
            icone="boitier"
            titre="Aucun boîtier enregistré"
            message="Créez un premier boîtier à l'aide du formulaire ci-dessus."
          />
        </div>
      )}

      {!erreur && (chargement || boitiers.length > 0) && (
        <div className="surface-card overflow-hidden">
          <div style={{ overflowX: 'auto' }}>
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
                {chargement ? (
                  <SkeletonLignes colonnes={5} lignes={4} />
                ) : (
                  boitiers.map((b) => (
                    <tr key={b.id}>
                      <td><code>{b.id}</code></td>
                      <td>{b.proprietaire_nom}</td>
                      <td>{b.numero_immatriculation}</td>
                      <td><span className="badge badge-statut-neutre">{b.statut_libelle ?? b.statut}</span></td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => handleRegenererCle(b)}
                          aria-label={`Régénérer la clé du boîtier ${b.id}`}
                        >
                          Régénérer la clé
                        </button>
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

      <ConfirmDialog etat={etatConfirmation} onConfirmer={confirmer} onAnnuler={annuler} />
    </>
  )
}
