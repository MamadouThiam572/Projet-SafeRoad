/**
 * Aide régionale partagée entre les pages de l'Admin Régional (dashboard,
 * carte régionale, zones à risque) : centre approximatif de chaque région
 * du Sénégal, pour centrer une carte Leaflet sur la région réellement
 * connectée plutôt que de toujours l'afficher sur Dakar, et mise en forme
 * du libellé de région. Slugs alignés sur apps/core/regions.py (backend).
 *
 * Les coordonnées des chefs-lieux sont approximatives — suffisantes pour
 * centrer une carte de démonstration, pas une géolocalisation précise.
 */

export const REGION_CENTERS: Record<string, [number, number]> = {
  dakar: [14.716, -17.4],
  diourbel: [14.655, -16.233],
  fatick: [14.339, -16.415],
  kaffrine: [14.105, -15.55],
  kaolack: [14.152, -16.076],
  kedougou: [12.56, -12.174],
  kolda: [12.894, -14.941],
  louga: [15.618, -16.224],
  matam: [15.656, -13.255],
  saint_louis: [16.019, -16.489],
  sedhiou: [12.708, -15.557],
  tambacounda: [13.771, -13.667],
  thies: [14.789, -16.926],
  ziguinchor: [12.586, -16.273],
}

export function regionCenter(regionSlug?: string | null): [number, number] {
  if (!regionSlug) return REGION_CENTERS.dakar
  return REGION_CENTERS[regionSlug] ?? REGION_CENTERS.dakar
}

/**
 * Préfixe d'immatriculation par région (ancien système sénégalais par
 * département, encore utilisé ici pour générer des matricules de démo
 * cohérents avec la région réellement connectée — pas une référence
 * officielle actuelle).
 */
export const REGION_PLATE_PREFIX: Record<string, string> = {
  dakar: 'DK',
  diourbel: 'DL',
  fatick: 'FK',
  kaffrine: 'KA',
  kaolack: 'KL',
  kedougou: 'KE',
  kolda: 'KD',
  louga: 'LG',
  matam: 'MT',
  saint_louis: 'SL',
  sedhiou: 'SE',
  tambacounda: 'TC',
  thies: 'TH',
  ziguinchor: 'ZG',
}

export function regionPlatePrefix(regionSlug?: string | null): string {
  if (!regionSlug) return REGION_PLATE_PREFIX.dakar
  return REGION_PLATE_PREFIX[regionSlug] ?? REGION_PLATE_PREFIX.dakar
}

/** "diourbel" -> "Diourbel", "saint_louis" -> "Saint-Louis". */
export function regionLabel(regionSlug?: string | null): string {
  if (!regionSlug) return 'Dakar'
  if (regionSlug === 'saint_louis') return 'Saint-Louis'
  return regionSlug.charAt(0).toUpperCase() + regionSlug.slice(1)
}

export function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(4)}° N · ${lng.toFixed(4)}°`
}

/** Position réelle = centre de la région connectée + un delta [lat, lng] fixe. */
export function offsetLatLng(center: [number, number], offset: [number, number]): [number, number] {
  return [center[0] + offset[0], center[1] + offset[1]]
}
