import api from './api'

// Paginé par curseur côté API (voir IncidentCursorPagination, backend) : `url` reçoit
// directement le lien `next`/`previous` renvoyé par la réponse précédente, pas un numéro
// de page — la table Incident grossit en continu, une pagination par offset s'y dégraderait.
export function listerIncidents(url) {
  return api.get(url || '/incidents/').then((res) => res.data)
}
