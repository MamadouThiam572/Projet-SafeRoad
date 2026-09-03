import { Icone } from './Icone'

// `pagination` : réponse brute de l'API DRF paginée — { count, next, previous } pour une
// pagination par page ; { next, previous } sans `count` pour une pagination par curseur
// (ex. Incident — compter dessus serait coûteux sur un flux qui grossit en continu).
// `onNaviguer(url)` reçoit directement l'URL `next`/`previous` fournie par l'API (déjà
// complète), pas un numéro de page à recalculer côté client.
export function Pagination({ pagination, onNaviguer }) {
  if (!pagination || (!pagination.next && !pagination.previous)) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
      <span className="text-xs text-ink-soft">
        {pagination.count != null ? (
          <>
            <span className="font-mono font-semibold text-ink">{pagination.count}</span> résultat{pagination.count > 1 ? 's' : ''} au total
          </>
        ) : (
          "Résultats les plus récents d'abord"
        )}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          disabled={!pagination.previous}
          onClick={() => onNaviguer(pagination.previous)}
        >
          <Icone nom="fleche" taille={13} className="rotate-180" />
          Précédent
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          disabled={!pagination.next}
          onClick={() => onNaviguer(pagination.next)}
        >
          Suivant
          <Icone nom="fleche" taille={13} />
        </button>
      </div>
    </div>
  )
}
