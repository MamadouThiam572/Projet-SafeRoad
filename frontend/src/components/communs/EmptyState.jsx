import { Icone } from './Icone'

// État vide réutilisable (tableaux/listes sans données).
export function EmptyState({ icone = 'boite', titre, message, action }) {
  return (
    <div className="empty-state">
      <span className="empty-state__icone" aria-hidden="true">
        <Icone nom={icone} taille={26} />
      </span>
      <p className="empty-state__titre">{titre}</p>
      {message && <p className="empty-state__message">{message}</p>}
      {action}
    </div>
  )
}
