import { Link } from 'react-router-dom'
import { Icone } from '../../components/communs/Icone'
import { useMetaPage } from '../../hooks/useMetaPage'

export function NotFoundPage() {
  useMetaPage({ titre: 'Page introuvable', description: 'Cette page n\'existe pas ou plus.' })

  return (
    <div className="container py-5 d-flex flex-column align-items-center text-center" style={{ minHeight: '50vh', justifyContent: 'center' }}>
      <span className="font-mono" style={{ color: 'var(--ink-soft)', fontSize: '0.85rem', letterSpacing: '0.14em' }}>ERREUR 404</span>
      <h1 className="mt-2 mb-3" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)' }}>Cette route n'a pas été détectée</h1>
      <p style={{ color: 'var(--ink-soft)', maxWidth: '48ch' }}>
        La page demandée n'existe pas ou a été déplacée. Retournez à l'accueil ou consultez la carte des
        zones à risque.
      </p>
      <div className="d-flex gap-2 mt-4" style={{ display: 'flex', gap: '0.75rem' }}>
        <Link to="/" className="btn btn-primary">Retour à l'accueil</Link>
        <Link to="/carte" className="btn btn-outline-primary">
          Voir la carte <Icone nom="fleche" taille={15} />
        </Link>
      </div>
    </div>
  )
}
