import api from './api'

export function login(email, password) {
  return api.post('/auth/login/', { email, password }).then((res) => res.data)
}

export function rafraichirToken(refresh) {
  return api.post('/auth/refresh/', { refresh }).then((res) => res.data)
}

export function moi() {
  return api.get('/auth/me/').then((res) => res.data)
}
