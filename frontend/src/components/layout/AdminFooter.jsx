import { useState } from 'react'
import { Icone } from '../communs/Icone'

const API_URL = import.meta.env.VITE_API_URL
const VERSION = '1.0.0'

// Pied de page collapsible de l'espace de gestion : ne prend jamais de place par défaut,
// affiché seulement au clic. Uniquement des liens réels (documentation API, site public) —
// jamais de « Mentions légales »/« Contact » factices qui ne mèneraient nulle part.
export function AdminFooter() {
  const [ouvert, setOuvert] = useState(false)
  const annee = new Date().getFullYear()

  return (
    <footer className="admin-footer">
      <div className="admin-footer__barre">
        <span className="admin-footer__statut">
          <span className="admin-footer__pastille" aria-hidden="true" />
          Système en ligne
        </span>
        <button
          type="button"
          className="admin-footer__toggle"
          onClick={() => setOuvert((v) => !v)}
          aria-expanded={ouvert}
          aria-label={ouvert ? 'Masquer les informations système' : 'Afficher les informations système'}
        >
          <Icone nom="fleche" taille={14} className={ouvert ? '-rotate-90' : 'rotate-90'} />
        </button>
      </div>
      {ouvert && (
        <div className="admin-footer__details">
          <span>© {annee} SafeRoad</span>
          <span className="font-mono">v{VERSION}</span>
          <a href={`${API_URL}/docs/`} target="_blank" rel="noreferrer">Documentation API</a>
          <a href="/" target="_blank" rel="noreferrer">Site public</a>
        </div>
      )}
    </footer>
  )
}
