export interface RegionalTrip {
  id: string
  /**
   * Suffixe de la plaque, SANS le préfixe régional (ex. "2145-AB").
   * Le préfixe ("DL-", "DK-"…) dépend de la région du compte connecté et
   * est ajouté à l'affichage via regionPlatePrefix() — voir src/lib/regions.ts.
   */
  vehicle: string
  driver: string
  route: string
  date: string
  duration: string
  km: number
  alerts: number
  score: number
}

/** Historique des trajets effectués par les véhicules connectés de la région. */
export const REGIONAL_TRIPS: RegionalTrip[] = [
  {
    id: 'rt1',
    vehicle: '2145-AB',
    driver: 'Ibrahima Sarr',
    route: 'Axe principal → RN3 – Km 12',
    date: '15/09/2026',
    duration: '28 min',
    km: 19,
    alerts: 1,
    score: 84,
  },
  {
    id: 'rt2',
    vehicle: '4471-EF',
    driver: 'Moussa Diop',
    route: 'Zone résidentielle → Avenue principale',
    date: '15/09/2026',
    duration: '22 min',
    km: 14,
    alerts: 1,
    score: 88,
  },
  {
    id: 'rt3',
    vehicle: '1187-GH',
    driver: 'Fatou Camara',
    route: 'Périphérie → Centre-ville',
    date: '15/09/2026',
    duration: '19 min',
    km: 11,
    alerts: 2,
    score: 79,
  },
  {
    id: 'rt4',
    vehicle: '0932-CD',
    driver: 'Aïssatou Ndao',
    route: 'Centre-ville → Rond-point central',
    date: '14/09/2026',
    duration: '15 min',
    km: 8,
    alerts: 0,
    score: 95,
  },
  {
    id: 'rt5',
    vehicle: '2803-IJ',
    driver: 'Cheikh Fall',
    route: 'Zone résidentielle → Zone technopole',
    date: '14/09/2026',
    duration: '24 min',
    km: 16,
    alerts: 1,
    score: 90,
  },
  {
    id: 'rt6',
    vehicle: '2145-AB',
    driver: 'Ibrahima Sarr',
    route: 'RN3 – Km 12 → Centre-ville',
    date: '13/09/2026',
    duration: '31 min',
    km: 21,
    alerts: 2,
    score: 81,
  },
  {
    id: 'rt7',
    vehicle: '4471-EF',
    driver: 'Moussa Diop',
    route: 'Avenue principale → Zone résidentielle',
    date: '13/09/2026',
    duration: '20 min',
    km: 13,
    alerts: 0,
    score: 93,
  },
  {
    id: 'rt8',
    vehicle: '1187-GH',
    driver: 'Fatou Camara',
    route: 'Centre-ville → Route de contournement',
    date: '12/09/2026',
    duration: '17 min',
    km: 9,
    alerts: 1,
    score: 87,
  },
]

export type DeviceEventType = 'connexion' | 'deconnexion' | 'maintenance'

export interface DeviceHistoryEntry {
  id: string
  deviceId: string
  /** Suffixe de plaque uniquement — voir RegionalTrip.vehicle ci-dessus. */
  vehicle?: string
  event: DeviceEventType
  date: string
  time: string
  detail: string
}

/** Journal de connectivité des boîtiers IoT de la région. */
export const DEVICE_HISTORY: DeviceHistoryEntry[] = [
  {
    id: 'dh1',
    deviceId: 'SR-03',
    vehicle: undefined,
    event: 'deconnexion',
    date: '15/09/2026',
    time: '14:18',
    detail: 'Périphérie — perte de signal depuis 42 min',
  },
  {
    id: 'dh2',
    deviceId: 'SR-07',
    vehicle: '2803-IJ',
    event: 'deconnexion',
    date: '15/09/2026',
    time: '13:35',
    detail: 'Zone technopole — coupure prolongée',
  },
  {
    id: 'dh3',
    deviceId: 'SR-01',
    vehicle: '2145-AB',
    event: 'connexion',
    date: '15/09/2026',
    time: '08:02',
    detail: 'Reconnexion automatique après redémarrage',
  },
  {
    id: 'dh4',
    deviceId: 'SR-05',
    vehicle: '4471-EF',
    event: 'maintenance',
    date: '14/09/2026',
    time: '16:40',
    detail: 'Mise à jour du firmware effectuée',
  },
  {
    id: 'dh5',
    deviceId: 'SR-02',
    vehicle: '0932-CD',
    event: 'connexion',
    date: '14/09/2026',
    time: '07:55',
    detail: 'Mise en service du boîtier',
  },
  {
    id: 'dh6',
    deviceId: 'SR-06',
    vehicle: '1187-GH',
    event: 'connexion',
    date: '13/09/2026',
    time: '09:12',
    detail: 'Reconnexion après coupure réseau',
  },
  {
    id: 'dh7',
    deviceId: 'SR-04',
    vehicle: undefined,
    event: 'maintenance',
    date: '12/09/2026',
    time: '11:20',
    detail: 'Contrôle technique périodique',
  },
]

export interface HistoryDayStat {
  date: string
  trajets: number
  distanceKm: number
  boitiersActifs: number
  disponibilite: number
}

/** Série des 7 derniers jours — alimente le graphique à bascule de la page Historique. */
export const HISTORY_WEEK_STATS: HistoryDayStat[] = [
  { date: '09/09', trajets: 9, distanceKm: 96, boitiersActifs: 6, disponibilite: 82 },
  { date: '10/09', trajets: 11, distanceKm: 118, boitiersActifs: 7, disponibilite: 88 },
  { date: '11/09', trajets: 8, distanceKm: 84, boitiersActifs: 6, disponibilite: 79 },
  { date: '12/09', trajets: 12, distanceKm: 131, boitiersActifs: 7, disponibilite: 90 },
  { date: '13/09', trajets: 10, distanceKm: 107, boitiersActifs: 6, disponibilite: 85 },
  { date: '14/09', trajets: 9, distanceKm: 99, boitiersActifs: 7, disponibilite: 91 },
  { date: '15/09', trajets: 7, distanceKm: 76, boitiersActifs: 6, disponibilite: 86 },
]
