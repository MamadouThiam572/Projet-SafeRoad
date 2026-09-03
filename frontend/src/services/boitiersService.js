import api from './api'

export function listerBoitiers() {
  return api.get('/boitiers/').then((res) => res.data)
}

// Pagination optionnelle côté API (voir apps/core/pagination.py côté backend) : ce
// endpoint n'est consommé nulle part ailleurs pour un total, donc paginer par défaut ici
// ne casse aucun compteur — `url` permet de suivre `next`/`previous` renvoyés par l'API.
export function listerBoitiersPagines(url) {
  return api.get(url || '/boitiers/?page=1').then((res) => res.data)
}

export function creerBoitier(donnees) {
  return api.post('/boitiers/', donnees).then((res) => res.data)
}

export function regenererCle(id) {
  return api.post(`/boitiers/${id}/regenerer-cle/`).then((res) => res.data)
}
