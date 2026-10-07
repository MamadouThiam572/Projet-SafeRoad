export type VehicleStatus = 'en_route' | 'stationne' | 'hors_ligne'

export interface ConnectedVehicle {
  id: string
  matricule: string
  driverName: string
  status: VehicleStatus
  speed: number
  lastUpdate: string
  /**
   * Trace récente du trajet — le dernier point est la position actuelle.
   * Chaque point est un delta [lat, lng] par rapport au centre de la région
   * connectée (src/lib/regions.ts), pas une coordonnée absolue — sinon les
   * véhicules resteraient affichés autour de Dakar même quand la carte est
   * recentrée sur la région de l'administrateur connecté.
   */
  path: [number, number][]
}

/**
 * Véhicules connectés circulant (ou récemment vus) dans la région de
 * l'Admin Régional. Les trajets ont été conçus pour amener chaque véhicule
 * près d'une des zones à risque de ADMIN_REGION_ZONES (adminHome.ts) — v1
 * termine sur z1, v2 sur z3, v3 sur z2, v4 sur z4, v5 sur z5 — ce lien est
 * conservé ici via les mêmes offsets finaux.
 */
export const CONNECTED_VEHICLES: ConnectedVehicle[] = [
  {
    id: 'v1',
    matricule: 'DK-2145-AB',
    driverName: 'Ibrahima Sarr',
    status: 'en_route',
    speed: 62,
    lastUpdate: 'il y a 30 s',
    path: [
      [0.0641, 0.0234],
      [0.0572, 0.0189],
      [0.0528, 0.0156],
      [0.0485, 0.0123],
    ],
  },
  {
    id: 'v2',
    matricule: 'DK-0932-CD',
    driverName: 'Aïssatou Ndao',
    status: 'stationne',
    speed: 0,
    lastUpdate: 'il y a 4 min',
    path: [
      [-0.022, -0.0498],
      [-0.0185, -0.0527],
      [-0.0152, -0.0559],
    ],
  },
  {
    id: 'v3',
    matricule: 'DK-4471-EF',
    driverName: 'Moussa Diop',
    status: 'en_route',
    speed: 45,
    lastUpdate: 'il y a 45 s',
    path: [
      [-0.0548, -0.0291],
      [-0.051, -0.0331],
      [-0.0471, -0.0358],
      [-0.0434, -0.0381],
    ],
  },
  {
    id: 'v4',
    matricule: 'DK-1187-GH',
    driverName: 'Fatou Camara',
    status: 'en_route',
    speed: 71,
    lastUpdate: 'il y a 15 s',
    path: [
      [0.025, -0.002],
      [0.0321, 0.0021],
      [0.0359, 0.0059],
      [0.0389, 0.0097],
    ],
  },
  {
    id: 'v5',
    matricule: 'DK-2803-IJ',
    driverName: 'Cheikh Fall',
    status: 'hors_ligne',
    speed: 0,
    lastUpdate: 'il y a 25 min',
    path: [
      [0.0029, -0.0581],
      [0.0057, -0.0613],
      [0.0085, -0.0644],
    ],
  },
]

export const VEHICLE_STATUS_META: Record<VehicleStatus, { label: string; color: string; soft: string; text: string }> = {
  en_route: { label: 'En circulation', color: '#2b6cb0', soft: '#e8f0f9', text: '#2b6cb0' },
  stationne: { label: 'À l\'arrêt', color: '#e8940c', soft: '#fdf4e6', text: '#e8940c' },
  hors_ligne: { label: 'Hors ligne', color: '#94a3b8', soft: '#f1f5f9', text: '#64748b' },
}
