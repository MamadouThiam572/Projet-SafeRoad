import api from './api'

export function obtenirConfiguration() {
  return api.get('/configuration/').then((res) => res.data)
}

export function mettreAJourConfiguration(donnees) {
  return api.put('/configuration/', donnees).then((res) => res.data)
}
