import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icone } from '../../components/communs/Icone'
import { useAuth } from '../../hooks/useAuth'
import { useMetaPage } from '../../hooks/useMetaPage'

export function LoginPage() {
  useMetaPage({ titre: 'Connexion', description: 'Espace réservé aux administrateurs et agents ANASER.' })
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [motDePasseVisible, setMotDePasseVisible] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)
  const { connecter } = useAuth()
  const navigate = useNavigate()
  const champEmailRef = useRef(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setErreur(null)
    setEnCours(true)
    try {
      const role = await connecter(email, motDePasse)
      navigate(role === 'anaser' ? '/anaser/dashboard' : '/admin/dashboard')
    } catch (err) {
      // Ne jamais afficher err.response.data brut (fuite d'information serveur) : on
      // catégorise en messages sûrs plutôt que de tout réduire à « mot de passe incorrect »,
      // ce qui masquait auparavant les pannes réseau/serveur derrière un message trompeur.
      if (!err.response) {
        setErreur('Impossible de contacter le serveur. Vérifiez votre connexion.')
      } else if (err.response.status === 401) {
        setErreur('Email ou mot de passe incorrect.')
      } else if (err.response.status === 429) {
        setErreur('Trop de tentatives. Merci de patienter une minute avant de réessayer.')
      } else {
        setErreur('Une erreur est survenue. Réessayez dans quelques instants.')
      }
      // Le mot de passe saisi n'est jamais restauré après une erreur (hygiène de base :
      // s'il a été mal recopié, on ne veut pas laisser cette valeur traîner dans le DOM).
      setMotDePasse('')
      champEmailRef.current?.focus()
    } finally {
      setEnCours(false)
    }
  }

  return (
    <main className="login-page">
      <div className="container login-layout">
        <aside className="login-portrait" aria-label="Illustration d'une conductrice souriante avec son ordinateur">
          <img className="login-avatar" src="/image_connexion.png" alt="Femme souriante tenant un ordinateur portable" />
        </aside>
        <div className="surface-card login-card w-full p-4 md:p-5">
        <div className="font-mono text-xs uppercase tracking-widest text-ink-soft">Espace réservé</div>
        <h1 className="mt-1 mb-4 font-display text-2xl text-ink">Connexion</h1>
        <form onSubmit={handleSubmit} noValidate>
          {erreur && <div className="alert alert-danger mb-3" role="alert">{erreur}</div>}
          <div className="mb-3">
            <label className="form-label" htmlFor="login-email">Email</label>
            <input
              ref={champEmailRef}
              id="login-email"
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              required
            />
          </div>
          <div className="mb-2">
            <label className="form-label" htmlFor="login-mdp">Mot de passe</label>
            <div className="relative">
              <input
                id="login-mdp"
                type={motDePasseVisible ? 'text' : 'password'}
                className="form-control"
                style={{ paddingRight: '2.75rem' }}
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setMotDePasseVisible((v) => !v)}
                aria-label={motDePasseVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                aria-pressed={motDePasseVisible}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-soft hover:text-ink"
              >
                <Icone nom={motDePasseVisible ? 'oeil-barre' : 'oeil'} taille={17} />
              </button>
            </div>
          </div>
          <p className="mb-4 text-xs text-ink-soft">
            Mot de passe oublié ? Contactez un autre administrateur — il n'y a pas encore de
            réinitialisation en libre-service.
          </p>
          <button type="submit" className="btn btn-primary w-full" disabled={enCours}>
            {enCours ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
        <p className="mt-5 mb-0 text-sm text-ink-soft">
          Réservé aux administrateurs et à l'ANASER. Aucune inscription publique.
        </p>
        </div>
      </div>
    </main>
  )
}
