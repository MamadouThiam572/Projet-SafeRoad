import api from './api'

export function listerFeedbacksAnaser() {
  return api.get('/alertes-anaser/').then((res) => res.data)
}

export function creerFeedbackAnaser(donnees) {
  return api.post('/alertes-anaser/', donnees).then((res) => res.data)
}
