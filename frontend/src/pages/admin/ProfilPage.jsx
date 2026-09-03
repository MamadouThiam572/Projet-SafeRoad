import { useState } from 'react'
import { ErrorState } from '../../components/communs/ErrorState'
import { Loader } from '../../components/communs/Loader'
import { PageHeader } from '../../components/communs/PageHeader'
import { useAuth } from '../../hooks/useAuth'
import { useRequete } from '../../hooks/useRequete'
import { useToast } from '../../hooks/useToast'
import { mettreAJourProfil, moi } from '../../services/authService'

const LIBELLES_ROLE = { admin: 'Administrateur', anaser: 'ANASER' }

// Extrait un message lisible d'une erreur de validation DRF ({champ: [messages]})
// sans jamais afficher la structure brute de la réponse à l'utilisateur.
function messageErreur(err) {
  const donnees = err.response?.data
  if (donnees && typeof donnees === 'object') {
    const premierChamp = Object.values(donnees)[0]
    if (Array.isArray(premierChamp) && typeof premierChamp[0] === 'string') return premierChamp[0]
  }
  return 'Impossible d\'enregistrer les modifications. Réessayez dans quelques instants.'
}

export function ProfilPage() {
  const { donnees: profil, chargement, erreur, rafraichir, setDonnees } = useRequete(moi)
  const { mettreAJourUtilisateur } = useAuth()
  const { succes, erreur: toastErreur } = useToast()
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreurValidation, setErreurValidation] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setErreurValidation(null)
    setEnregistrement(true)
    try {
      const misAJour = await mettreAJourProfil({
        email: profil.email,
        nom: profil.nom,
        prenom: profil.prenom,
      })
      setDonnees(misAJour)
      mettreAJourUtilisateur({ email: misAJour.email, nom: misAJour.nom, prenom: misAJour.prenom })
      succes('Profil mis à jour.')
    } catch (err) {
      const message = messageErreur(err)
      setErreurValidation(message)
      toastErreur(message)
    } finally {
      setEnregistrement(false)
    }
  }

  return (
    <>
      <PageHeader
        titre="Mon profil"
        icone="utilisateur"
        description="Vos informations de compte sur SafeRoad."
      />

      {chargement && <Loader />}
      {erreur && !chargement && <ErrorState onReessayer={rafraichir} />}

      {profil && !chargement && !erreur && (
        <form onSubmit={handleSubmit} className="surface-card p-4 form-etroit">
          {erreurValidation && <div className="alert alert-danger mb-3" role="alert">{erreurValidation}</div>}

          <div className="mb-3">
            <label className="form-label" htmlFor="profil-prenom">Prénom</label>
            <input
              id="profil-prenom"
              className="form-control"
              value={profil.prenom}
              onChange={(e) => setDonnees({ ...profil, prenom: e.target.value })}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="profil-nom">Nom</label>
            <input
              id="profil-nom"
              className="form-control"
              value={profil.nom}
              onChange={(e) => setDonnees({ ...profil, nom: e.target.value })}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="profil-email">Email</label>
            <input
              id="profil-email"
              type="email"
              className="form-control"
              value={profil.email}
              onChange={(e) => setDonnees({ ...profil, email: e.target.value })}
              required
            />
          </div>

          <div className="mb-4 text-sm text-ink-soft">
            <p className="mb-1">
              Rôle : <strong className="text-ink">{LIBELLES_ROLE[profil.role] ?? profil.role}</strong>
              {' '}<span className="text-xs">(non modifiable ici)</span>
            </p>
            <p className="mb-1">
              Compte créé le {new Date(profil.date_creation).toLocaleDateString('fr-FR', { dateStyle: 'long' })}
            </p>
            {profil.derniere_connexion && (
              <p className="mb-0">
                Dernière connexion le{' '}
                {new Date(profil.derniere_connexion).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}
              </p>
            )}
          </div>

          <button type="submit" className="btn btn-primary" disabled={enregistrement}>
            {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </form>
      )}
    </>
  )
}
