import api from './api'

// Non paginée : consommée telle quelle par les compteurs de la sidebar ANASER et le KPI
// « feedbacks en attente » du dashboard, qui ont besoin du total réel, pas d'une page.
export function listerFeedbacksAnaser() {
  return api.get('/alertes-anaser/').then((res) => res.data)
}

// Variante paginée (voir apps/core/pagination.py) pour le tableau de la page Feedback.
export function listerFeedbacksAnaserPagines(url) {
  return api.get(url || '/alertes-anaser/?page=1').then((res) => res.data)
}

export function creerFeedbackAnaser(donnees) {
  return api.post('/alertes-anaser/', donnees).then((res) => res.data)
}

export function mettreAJourFeedbackAnaser(id, statut) {
  return api.patch(`/alertes-anaser/${id}/`, { statut }).then((res) => res.data)
}
