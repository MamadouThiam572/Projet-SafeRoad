/**
 * Données de la page /admin/zones (« Zones à valider » — vue « Zones à risque »
 * de l'administrateur régional). Toujours des données de démonstration en
 * attendant l'endpoint réel (probablement apps/zones côté backend) : chaque
 * mutation locale est marquée // TODO backend avec le verbe HTTP attendu.
 *
 * Chaque zone porte un petit "offset" (delta en degrés) appliqué au centre
 * de la région réellement connectée (voir src/lib/regions.ts) — pas de
 * coordonnées absolues, pour que la carte s'affiche sur la région de
 * l'administrateur (Diourbel, Thiès, etc.) plutôt que toujours sur Dakar.
 */

export type RiskLevel = 'critique' | 'vigilance' | 'normale'
export type StatutValidation = 'en_cours' | 'validee'

export interface CommentaireZone {
  auteur: string
  date: string
  texte: string
}

export interface PointEvolution {
  date: string
  valeur: number
}

export interface ZoneRisque {
  id: string
  nom: string
  localite: string
  type: string
  niveau: RiskLevel
  incidents: number
  avgSpeed: number
  lastDetection: string
  /** Delta [lat, lng] en degrés par rapport au centre de la région connectée. */
  offset: [number, number]
  statut: StatutValidation
  evolution: PointEvolution[]
  commentaires: CommentaireZone[]
}

export const ZONES_RISQUE: ZoneRisque[] = [
  {
    id: 'ZD-001',
    nom: 'RN3 – Km 12',
    localite: 'Axe principal',
    type: 'Accident',
    niveau: 'critique',
    incidents: 23,
    avgSpeed: 87,
    lastDetection: '09/09/2026 14:32',
    offset: [0.023, 0.05],
    statut: 'en_cours',
    evolution: [
      { date: '03/09', valeur: 9 },
      { date: '04/09', valeur: 12 },
      { date: '05/09', valeur: 14 },
      { date: '06/09', valeur: 15 },
      { date: '07/09', valeur: 19 },
      { date: '08/09', valeur: 21 },
      { date: '09/09', valeur: 23 },
    ],
    commentaires: [
      {
        auteur: 'ANASER',
        date: '09/09/2026 14:20',
        texte: 'Accident signalé sur cette zone, le trafic est ralenti.',
      },
    ],
  },
  {
    id: 'ZD-002',
    nom: 'Avenue principale',
    localite: 'Centre-ville',
    type: 'Route défectueuse',
    niveau: 'vigilance',
    incidents: 12,
    avgSpeed: 54,
    lastDetection: '09/09/2026 12:18',
    offset: [0.001, -0.006],
    statut: 'validee',
    evolution: [
      { date: '03/09', valeur: 8 },
      { date: '04/09', valeur: 9 },
      { date: '05/09', valeur: 9 },
      { date: '06/09', valeur: 10 },
      { date: '07/09', valeur: 11 },
      { date: '08/09', valeur: 11 },
      { date: '09/09', valeur: 12 },
    ],
    commentaires: [],
  },
  {
    id: 'ZD-003',
    nom: 'Rond-point central',
    localite: 'Centre-ville',
    type: 'Freinage brusque',
    niveau: 'critique',
    incidents: 8,
    avgSpeed: 41,
    lastDetection: '09/09/2026 11:05',
    offset: [0.014, -0.026],
    statut: 'en_cours',
    evolution: [
      { date: '03/09', valeur: 3 },
      { date: '04/09', valeur: 4 },
      { date: '05/09', valeur: 4 },
      { date: '06/09', valeur: 5 },
      { date: '07/09', valeur: 6 },
      { date: '08/09', valeur: 7 },
      { date: '09/09', valeur: 8 },
    ],
    commentaires: [],
  },
  {
    id: 'ZD-004',
    nom: 'Route de contournement',
    localite: 'Périphérie ouest',
    type: 'Excès de vitesse',
    niveau: 'vigilance',
    incidents: 6,
    avgSpeed: 96,
    lastDetection: '09/09/2026 10:42',
    offset: [-0.033, -0.084],
    statut: 'validee',
    evolution: [
      { date: '03/09', valeur: 4 },
      { date: '04/09', valeur: 4 },
      { date: '05/09', valeur: 5 },
      { date: '06/09', valeur: 5 },
      { date: '07/09', valeur: 6 },
      { date: '08/09', valeur: 6 },
      { date: '09/09', valeur: 6 },
    ],
    commentaires: [],
  },
  {
    id: 'ZD-005',
    nom: 'Route de la gare',
    localite: 'Zone de la gare',
    type: 'Autre',
    niveau: 'normale',
    incidents: 3,
    avgSpeed: 62,
    lastDetection: '09/09/2026 09:21',
    offset: [0.058, 0.09],
    statut: 'en_cours',
    evolution: [
      { date: '03/09', valeur: 1 },
      { date: '04/09', valeur: 1 },
      { date: '05/09', valeur: 2 },
      { date: '06/09', valeur: 2 },
      { date: '07/09', valeur: 2 },
      { date: '08/09', valeur: 3 },
      { date: '09/09', valeur: 3 },
    ],
    commentaires: [],
  },
  {
    id: 'ZD-006',
    nom: 'Marché central',
    localite: 'Centre-ville',
    type: 'Encombrement',
    niveau: 'vigilance',
    incidents: 5,
    avgSpeed: 18,
    lastDetection: '08/09/2026 18:02',
    offset: [-0.008, 0.034],
    statut: 'en_cours',
    evolution: [
      { date: '03/09', valeur: 2 },
      { date: '04/09', valeur: 3 },
      { date: '05/09', valeur: 3 },
      { date: '06/09', valeur: 4 },
      { date: '07/09', valeur: 4 },
      { date: '08/09', valeur: 5 },
      { date: '09/09', valeur: 5 },
    ],
    commentaires: [],
  },
  {
    id: 'ZD-007',
    nom: 'Sortie ville — RN4',
    localite: 'Sortie nord',
    type: 'Excès de vitesse',
    niveau: 'normale',
    incidents: 2,
    avgSpeed: 104,
    lastDetection: '08/09/2026 16:47',
    offset: [0.088, 0.036],
    statut: 'validee',
    evolution: [
      { date: '03/09', valeur: 1 },
      { date: '04/09', valeur: 1 },
      { date: '05/09', valeur: 1 },
      { date: '06/09', valeur: 1 },
      { date: '07/09', valeur: 2 },
      { date: '08/09', valeur: 2 },
      { date: '09/09', valeur: 2 },
    ],
    commentaires: [],
  },
]

/**
 * Tendances hebdomadaires par niveau et taux de récurrence global — des
 * agrégats calculés côté backend en temps réel, donc non déductibles de la
 * seule liste de zones ci-dessus. Valeurs de démonstration.
 */
export const ZONES_TENDANCES: Record<RiskLevel, string> = {
  critique: '+2',
  vigilance: '+3',
  normale: '-2',
}

export const TAUX_RECURRENCE_7J = { valeur: 38, tendance: '+6%' }
