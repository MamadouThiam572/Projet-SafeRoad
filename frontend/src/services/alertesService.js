import api from './api'

// Non paginée : consommée telle quelle par les compteurs de la sidebar admin et le KPI
// « alertes nouvelles » du dashboard, qui ont besoin du total réel, pas d'une page.
export function listerAlertes() {
  return api.get('/alertes/').then((res) => res.data)
}

// Variante paginée (voir apps/core/pagination.py) pour le tableau de la page Alertes —
// `url` permet de suivre `next`/`previous` renvoyés par l'API.
export function listerAlertesPaginees(url) {
  return api.get(url || '/alertes/?page=1').then((res) => res.data)
}

export function traiterAlerte(id, statut = 'traitee') {
  return api.patch(`/alertes/${id}/traiter/`, { statut }).then((res) => res.data)
}
