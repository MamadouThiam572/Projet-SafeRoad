import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL

const api = axios.create({ baseURL: API_URL })

let accessToken = null
let refreshToken = null
// Le refresh token est à usage unique (ROTATE_REFRESH_TOKENS côté API) : deux appels
// concurrents avec le même token (ex. Promise.all([...]) dont chaque requête expire en
// même temps, ou React StrictMode qui double-invoque les effets en dev) feraient échouer
// le second, qui effacerait alors la session que le premier vient de rétablir. Ce
// singleton garantit qu'un seul rafraîchissement réseau est en vol à la fois — tous les
// appelants concurrents attendent la même promesse au lieu d'en déclencher une chacun.
let rafraichissementEnCours = null

export function definirTokens({ access, refresh }) {
  accessToken = access
  if (refresh) {
    refreshToken = refresh
    localStorage.setItem('saferoad_refresh_token', refresh)
  }
}

export function chargerRefreshTokenStocke() {
  return localStorage.getItem('saferoad_refresh_token')
}

export function effacerTokens() {
  accessToken = null
  refreshToken = null
  localStorage.removeItem('saferoad_refresh_token')
}

export function rafraichirSession() {
  // Au tout premier chargement de l'app, `refreshToken` (variable module, volontairement
  // non persistée) est encore vide alors que localStorage a déjà le token de la session
  // précédente — on le reprend ici pour que ce soit le même point d'entrée unique, que
  // l'appel vienne du montage initial (AuthContext) ou d'un 401 en cours de session.
  if (!refreshToken) refreshToken = chargerRefreshTokenStocke()
  if (!refreshToken) return Promise.reject(new Error('Aucun refresh token disponible.'))
  if (!rafraichissementEnCours) {
    rafraichissementEnCours = axios
      .post(`${API_URL}/auth/refresh/`, { refresh: refreshToken })
      .then(({ data }) => {
        definirTokens({ access: data.access, refresh: data.refresh })
        return data
      })
      .finally(() => {
        rafraichissementEnCours = null
      })
  }
  return rafraichissementEnCours
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const requeteOriginale = error.config
    if (error.response?.status === 401 && !requeteOriginale._retry && refreshToken) {
      requeteOriginale._retry = true
      try {
        const { access } = await rafraichirSession()
        requeteOriginale.headers.Authorization = `Bearer ${access}`
        return api(requeteOriginale)
      } catch (erreurRefresh) {
        effacerTokens()
        return Promise.reject(erreurRefresh)
      }
    }
    return Promise.reject(error)
  },
)

export default api
