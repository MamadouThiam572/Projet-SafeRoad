import { Link } from 'react-router-dom'

const ETAPES = [
  {
    n: '01',
    titre: 'Détection embarquée',
    texte: "Le boîtier ESP32 (accéléromètre, radar, GPS) détecte les chocs, freinages brusques et collisions en temps réel.",
  },
  {
    n: '02',
    titre: 'Transmission sécurisée',
    texte: "Les données sont envoyées au serveur (ou mises en attente sur carte SD hors connexion) puis synchronisées automatiquement.",
  },
  {
    n: '03',
    titre: 'Zones à risque',
    texte: "Les incidents récurrents sont regroupés en zones accidentogènes, validées par un administrateur avant publication.",
  },
]

export function AccueilPage() {
  return (
    <div className="container py-5">
      <div className="hero mb-5">
        <div className="eyebrow">Prévention routière · Sénégal</div>
        <h1>Voir venir l'accident, avant qu'il n'arrive.</h1>
        <p>
          SafeRoad relie un boîtier embarqué de détection à une plateforme de suivi en temps réel pour
          identifier les zones accidentogènes récurrentes et alerter conducteurs et autorités.
        </p>
        <div className="d-flex flex-wrap gap-3 mt-4">
          <Link to="/carte" className="btn btn-accent">Voir la carte des zones à risque</Link>
          <Link to="/statistiques" className="btn btn-outline-light">Statistiques publiques</Link>
        </div>
      </div>

      <div className="row g-4">
        {ETAPES.map((etape) => (
          <div className="col-md-4" key={etape.n}>
            <div className="surface-card p-4 h-100">
              <div className="font-mono" style={{ color: 'var(--ink-soft)', fontSize: '0.85rem' }}>{etape.n}</div>
              <h2 className="h5 mt-2">{etape.titre}</h2>
              <p style={{ color: 'var(--ink-soft)', marginBottom: 0 }}>{etape.texte}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
