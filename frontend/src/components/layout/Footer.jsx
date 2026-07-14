import { Link } from 'react-router-dom'

export function Footer() {
  const annee = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <span className="brand-mark">
              <span className="dot" aria-hidden="true" />
              SafeRoad
            </span>
            <p>
              Détecter les accidents à la source, révéler les zones à risque et rendre la prévention
              routière visible par tous, au Sénégal.
            </p>
          </div>

          <nav className="footer-col" aria-label="Navigation du site">
            <h3>Explorer</h3>
            <Link to="/carte">Carte des zones à risque</Link>
            <Link to="/statistiques">Statistiques publiques</Link>
          </nav>

          <nav className="footer-col" aria-label="Accès réservé">
            <h3>Acteurs & partenaires</h3>
            <Link to="/login">Espace administrateur</Link>
            <Link to="/login">Espace ANASER</Link>
          </nav>

          <div className="footer-col">
            <h3>À propos</h3>
            <p className="footer-note">
              Plateforme de prévention routière conçue avec et pour les acteurs de la sécurité routière.
              Données agrégées et anonymisées.
            </p>
          </div>
        </div>

        <div className="footer-bas">
          <span>© {annee} SafeRoad — Prévention routière · Sénégal</span>
          <span className="font-mono">Boîtier ESP32 · Détection temps réel</span>
        </div>
      </div>
    </footer>
  )
}
