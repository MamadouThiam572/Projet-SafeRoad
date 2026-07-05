import { Link } from 'react-router-dom'

export function AccueilPage() {
  return (
    <div className="container py-5 text-center">
      <h1>SafeRoad</h1>
      <p className="lead">
        Système intelligent de suivi en temps réel et de prévention des accidents routiers récurrents au Sénégal.
      </p>
      <div className="d-flex justify-content-center gap-3 mt-4">
        <Link to="/carte" className="btn btn-primary">Voir la carte des zones à risque</Link>
        <Link to="/statistiques" className="btn btn-outline-secondary">Statistiques publiques</Link>
      </div>
    </div>
  )
}
