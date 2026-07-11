import api from './api'

export function listerAlertes() {
  return api.get('/alertes/').then((res) => res.data)
}

export function traiterAlerte(id, statut = 'traitee') {
  return api.patch(`/alertes/${id}/traiter/`, { statut }).then((res) => res.data)
}
