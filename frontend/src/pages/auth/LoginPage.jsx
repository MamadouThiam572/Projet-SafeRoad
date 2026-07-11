import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)
  const { connecter } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setErreur(null)
    setEnCours(true)
    try {
      const role = await connecter(email, motDePasse)
      navigate(role === 'anaser' ? '/anaser/dashboard' : '/admin/dashboard')
    } catch {
      setErreur('Email ou mot de passe incorrect.')
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="container d-flex justify-content-center py-5">
      <div className="surface-card p-4 p-md-5" style={{ maxWidth: 420, width: '100%' }}>
        <div className="font-mono" style={{ color: 'var(--ink-soft)', fontSize: '0.8rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Espace réservé</div>
        <h1 className="h3 mt-1 mb-4">Connexion</h1>
        <form onSubmit={handleSubmit}>
          {erreur && <div className="alert alert-danger">{erreur}</div>}
          <div className="mb-3">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="mb-4">
            <label className="form-label">Mot de passe</label>
            <input
              type="password"
              className="form-control"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary w-100" disabled={enCours}>
            {enCours ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
        <p style={{ color: 'var(--ink-soft)', fontSize: '0.85rem', marginTop: '20px', marginBottom: 0 }}>
          Réservé aux administrateurs et à l'ANASER. Aucune inscription publique.
        </p>
      </div>
    </div>
  )
}
