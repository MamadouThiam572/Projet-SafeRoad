/**
 * Décodage du payload d'un JWT — usage strictement lié à l'affichage
 * (ex. adapter le menu selon le rôle). Le backend Django/DRF reste la
 * seule source d'autorité : il vérifie la signature et applique les
 * droits réels à chaque requête.
 */
export interface JwtPayload {
  sub: string
  email: string
  first_name?: string
  last_name?: string
  role: string
  region?: string
  exp: number
  [key: string]: unknown
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json) as JwtPayload
  } catch {
    return null
  }
}

export function isJwtExpired(payload: JwtPayload): boolean {
  return Date.now() >= payload.exp * 1000
}
