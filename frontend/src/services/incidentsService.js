import api from './api'

export function listerIncidents() {
  return api.get('/incidents/').then((res) => res.data)
}
