import api from './api'

export function login(email, password) {
  return api.post('/auth/login/', { email, password }).then((res) => res.data)
}

// Blackliste le refresh token côté serveur — sans cet appel, une « déconnexion » ne fait
// qu'oublier le token localement : il resterait utilisable jusqu'à son expiration naturelle.
export function logout(refresh) {
  return api.post('/auth/logout/', { refresh }).then((res) => res.data)
}

export function moi() {
  return api.get('/auth/me/').then((res) => res.data)
}

export function mettreAJourProfil(donnees) {
  return api.patch('/auth/me/', donnees).then((res) => res.data)
}
