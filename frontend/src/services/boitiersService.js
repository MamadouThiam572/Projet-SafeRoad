import api from './api'

export function listerBoitiers() {
  return api.get('/boitiers/').then((res) => res.data)
}

export function creerBoitier(donnees) {
  return api.post('/boitiers/', donnees).then((res) => res.data)
}

export function regenererCle(id) {
  return api.post(`/boitiers/${id}/regenerer-cle/`).then((res) => res.data)
}
