import api from './api'

export function statistiquesPubliques() {
  return api.get('/statistiques/publiques/').then((res) => res.data)
}

export function statistiquesDashboard(zoneId) {
  return api.get('/statistiques/dashboard/', { params: zoneId ? { zone: zoneId } : {} }).then((res) => res.data)
}
