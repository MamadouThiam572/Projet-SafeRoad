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
    // atob() renvoie un octet par caractère : sans TextDecoder, les accents encodés
    // en UTF-8 par le backend (ex. prenom = "Diène") s'afficheraient "DiÃ¨ne".
    const binary = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes)) as JwtPayload
  } catch {
    return null
  }
}

export function isJwtExpired(payload: JwtPayload): boolean {
  return Date.now() >= payload.exp * 1000
}
