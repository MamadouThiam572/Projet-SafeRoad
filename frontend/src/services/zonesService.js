import api from './api'

export function listerZones() {
  return api.get('/zones/').then((res) => res.data)
}

export function validerZone(id, statutValidation) {
  return api.patch(`/zones/${id}/valider/`, { statut_validation: statutValidation }).then((res) => res.data)
}

export function genererZones() {
  return api.post('/zones/generer/').then((res) => res.data)
}
