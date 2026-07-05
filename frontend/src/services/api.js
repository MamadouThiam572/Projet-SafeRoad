import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL

const api = axios.create({ baseURL: API_URL })

let accessToken = null
let refreshToken = null

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
        const { data } = await axios.post(`${API_URL}/auth/refresh/`, { refresh: refreshToken })
        definirTokens({ access: data.access })
        requeteOriginale.headers.Authorization = `Bearer ${data.access}`
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
