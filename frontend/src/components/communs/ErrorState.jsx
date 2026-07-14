import { Icone } from './Icone'

// Bandeau d'erreur réutilisable, avec réessai optionnel.
// `role="alert"` pour l'annonce aux lecteurs d'écran.
export function ErrorState({ message = 'Une erreur est survenue lors du chargement des données.', onReessayer }) {
  return (
    <div className="error-state" role="alert">
      <span className="error-state__icone" aria-hidden="true">
        <Icone nom="attention" taille={22} />
      </span>
      <span className="error-state__message">{message}</span>
      {onReessayer && (
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onReessayer}>
          Réessayer
        </button>
      )}
    </div>
  )
}
