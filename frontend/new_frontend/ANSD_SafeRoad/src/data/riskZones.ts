export type ZoneStatus = 'validee' | 'observation' | 'normale'

export interface RiskZone {
  id: string
  name: string
  region: string
  lat: number
  lng: number
  status: ZoneStatus
  note: string
}

export const STATUS_META: Record<ZoneStatus, { color: string; label: string; dotClass: string }> = {
  validee: { color: '#dc3a2f', label: 'Validée', dotClass: 'bg-danger-600' },
  observation: { color: '#e8940c', label: 'En observation', dotClass: 'bg-warning-600' },
  normale: { color: '#1f9d55', label: 'Normale', dotClass: 'bg-success-600' },
}

/**
 * Emprise du Sénégal (sud-ouest / nord-est), ajustée au plus près du
 * territoire réel — un rectangle ne peut pas coller exactement aux
 * frontières (la Gambie s'insère dedans, le Mali/la Mauritanie/la Guinée
 * la bordent sans marge), mais un rectangle proche de la vraie proportion
 * du pays réduit fortement la part visible des pays voisins.
 */
export const SENEGAL_BOUNDS: [[number, number], [number, number]] = [
  [12.28, -17.55],
  [16.7, -11.38],
]

/**
 * Zones de démonstration réparties sur plusieurs régions du pays, en
 * attendant le branchement au backend réel (zones remontées par les
 * boîtiers IoT puis validées par un administrateur régional).
 */
export const DEMO_ZONES: RiskZone[] = [
  {
    id: 'dakar-rufisque',
    name: 'Route de Rufisque',
    region: 'Dakar',
    lat: 14.7167,
    lng: -17.27,
    status: 'validee',
    note: 'Récurrence confirmée par un administrateur régional.',
  },
  {
    id: 'louga-rn2',
    name: 'RN2, sortie de Louga',
    region: 'Louga',
    lat: 15.6173,
    lng: -16.224,
    status: 'validee',
    note: 'Plusieurs signalements radar sur cette portion depuis mars.',
  },
  {
    id: 'thies-mbour',
    name: 'Axe Thiès–Mbour',
    region: 'Thiès',
    lat: 14.791,
    lng: -16.9359,
    status: 'observation',
    note: "En attente de confirmation par l'ANASER.",
  },
  {
    id: 'kaolack-kaffrine',
    name: 'Route de Kaffrine',
    region: 'Kaolack',
    lat: 14.1652,
    lng: -16.0726,
    status: 'observation',
    note: 'Comportements à risque détectés par nos boîtiers IoT.',
  },
  {
    id: 'saint-louis-pont',
    name: 'Pont Faidherbe',
    region: 'Saint-Louis',
    lat: 16.0179,
    lng: -16.4896,
    status: 'normale',
    note: 'Aucune récurrence notable sur les 90 derniers jours.',
  },
  {
    id: 'tambacounda-rn1',
    name: 'RN1 vers Kidira',
    region: 'Tambacounda',
    lat: 13.7671,
    lng: -13.6681,
    status: 'normale',
    note: 'Zone sous surveillance de routine.',
  },
  {
    id: 'ziguinchor-bignona',
    name: 'Route de Bignona',
    region: 'Ziguinchor',
    lat: 12.5665,
    lng: -16.2733,
    status: 'normale',
    note: 'Aucune récurrence notable sur les 90 derniers jours.',
  },
]
