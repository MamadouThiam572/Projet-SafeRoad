export type RiskLevel = 'critique' | 'vigilance' | 'normale'

export const RISK_META: Record<RiskLevel, { label: string; colorHex: string; textClass: string; softClass: string }> = {
  critique: { label: 'Zone critique', colorHex: '#dc3a2f', textClass: 'text-danger-600', softClass: 'bg-danger-50' },
  vigilance: { label: 'Zone de vigilance', colorHex: '#e8940c', textClass: 'text-warning-600', softClass: 'bg-warning-50' },
  normale: { label: 'Zone normale', colorHex: '#1f9d55', textClass: 'text-success-600', softClass: 'bg-success-50' },
}

export interface ClientZone {
  id: string
  name: string
  region: string
  roadType: 'autoroute' | 'nationale' | 'regionale' | 'voirie_urbaine'
  level: RiskLevel
  lat: number
  lng: number
  /** Distance indicative depuis le véhicule — valeur de démonstration, non calculée en direct. */
  distanceKm: number
}

/**
 * Vue « conducteur » des zones à risque : trois niveaux seulement (contre les
 * quatre statuts internes de `data/localities.ts`, qui mêlent workflow de
 * validation ANASER et niveau de risque) — un conducteur n'a pas besoin de
 * savoir qu'une zone est « à examiner », seulement si elle est dangereuse.
 */
export const CLIENT_ZONES: ClientZone[] = [
  { id: 'z1', name: 'RN1 — Km 45', region: 'Thiès', roadType: 'nationale', level: 'critique', lat: 14.6, lng: -17.05, distanceKm: 2.5 },
  { id: 'z2', name: 'Carrefour Liberté', region: 'Dakar', roadType: 'voirie_urbaine', level: 'vigilance', lat: 14.6928, lng: -17.4467, distanceKm: 4.1 },
  { id: 'z3', name: 'RN2 — Km 12', region: 'Diourbel', roadType: 'nationale', level: 'critique', lat: 14.72, lng: -16.05, distanceKm: 9.8 },
  { id: 'z4', name: 'Route de Mbour', region: 'Thiès', roadType: 'regionale', level: 'vigilance', lat: 14.4, lng: -16.9, distanceKm: 12.3 },
  { id: 'z5', name: 'RN3 — Km 28', region: 'Kaolack', roadType: 'nationale', level: 'normale', lat: 14.1, lng: -16.2, distanceKm: 28.6 },
  { id: 'z6', name: 'VDN — Km 7', region: 'Dakar', roadType: 'autoroute', level: 'critique', lat: 14.7167, lng: -17.45, distanceKm: 3.8 },
  { id: 'z7', name: 'A1 — Km 32', region: 'Thiès', roadType: 'autoroute', level: 'critique', lat: 14.79, lng: -16.93, distanceKm: 6.4 },
  { id: 'z8', name: 'RN1 — Km 82 (Mbour)', region: 'Thiès', roadType: 'nationale', level: 'vigilance', lat: 14.42, lng: -16.965, distanceKm: 12.5 },
  { id: 'z9', name: 'RN1 — Km 25 (Rufisque)', region: 'Dakar', roadType: 'nationale', level: 'normale', lat: 14.72, lng: -17.27, distanceKm: 18.2 },
  { id: 'z10', name: 'RN3 — Km 88 (Diourbel)', region: 'Diourbel', roadType: 'nationale', level: 'vigilance', lat: 14.6559, lng: -16.2333, distanceKm: 34.6 },
  { id: 'z11', name: 'RN2 — Km 63 (Louga)', region: 'Louga', roadType: 'nationale', level: 'vigilance', lat: 15.6173, lng: -16.224, distanceKm: 46.1 },
  { id: 'z12', name: 'Route de Dahra', region: 'Louga', roadType: 'regionale', level: 'normale', lat: 15.399, lng: -15.118, distanceKm: 61.4 },
  { id: 'z13', name: 'Pont Faidherbe', region: 'Saint-Louis', roadType: 'voirie_urbaine', level: 'normale', lat: 16.0179, lng: -16.4896, distanceKm: 82.9 },
  { id: 'z14', name: 'Route de Bignona', region: 'Ziguinchor', roadType: 'voirie_urbaine', level: 'normale', lat: 12.5665, lng: -16.2733, distanceKm: 245.7 },
  { id: 'z15', name: 'PK 560 – PK 566, RN6', region: 'Kolda', roadType: 'nationale', level: 'normale', lat: 12.8939, lng: -14.9412, distanceKm: 268.3 },
]

export const CLIENT_REGIONS = Array.from(new Set(CLIENT_ZONES.map((z) => z.region))).sort()

export const ROAD_TYPE_LABELS_CLIENT: Record<ClientZone['roadType'], string> = {
  autoroute: 'Autoroute',
  nationale: 'Route nationale',
  regionale: 'Route régionale',
  voirie_urbaine: 'Voirie urbaine',
}
