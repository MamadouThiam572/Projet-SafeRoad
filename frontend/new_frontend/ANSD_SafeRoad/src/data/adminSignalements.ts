/**
 * Données de la page /admin/signalements (« Signalements » de l'administrateur
 * régional) — les dangers remontés par les conducteurs depuis leur propre
 * page « Mes signalements » (src/pages/client/SignalementsPage.tsx), que
 * l'administrateur régional reçoit, vérifie à l'aide des données SafeRoad à
 * proximité, puis traite (validation, rejet, ou transmission à l'ANASER).
 *
 * Données de démonstration en attendant l'endpoint réel (probablement
 * apps/signalements côté backend) — pas d'appel API pour l'instant. On
 * reste volontairement sur un nombre d'entrées modeste (12, pas 127 comme
 * sur la maquette) : les cartes KPI de la page sont calculées à partir de
 * cette liste réelle, pas d'un chiffre inventé à côté.
 *
 * Comme pour /admin/zones, /admin/incidents et /admin/monitoring, chaque
 * signalement porte un "offset" (delta en degrés) appliqué au centre de la
 * région réellement connectée (voir src/lib/regions.ts).
 */

export type DangerType = 'nid_de_poule' | 'chaussee_inondee' | 'signalisation_absente' | 'chaussee_degradee' | 'autre'
export type StatutSignalement = 'en_attente' | 'en_verification' | 'valide' | 'rejete'
export type Correspondance = 'constatee' | 'aucune' | 'complementaire' | null

export const DANGER_META: Record<DangerType, { label: string; icon: string; tint: string; soft: string }> = {
  nid_de_poule: { label: 'Nid-de-poule', icon: 'construction', tint: '#e8940c', soft: '#fdf4e6' },
  chaussee_inondee: { label: 'Chaussée inondée', icon: 'water_drop', tint: '#2b6cb0', soft: '#e8f0f9' },
  signalisation_absente: { label: 'Signalisation absente', icon: 'no_crash', tint: '#7c3aed', soft: '#f1eafe' },
  chaussee_degradee: { label: 'Chaussée dégradée', icon: 'warning', tint: '#dc3a2f', soft: '#fdeeec' },
  autre: { label: 'Autre', icon: 'help', tint: '#64748b', soft: '#f1f5f9' },
}

export const STATUT_META: Record<StatutSignalement, { label: string; icon: string; soft: string; text: string }> = {
  en_attente: { label: 'En attente', icon: 'schedule', soft: '#fdf4e6', text: '#e8940c' },
  en_verification: { label: 'En vérification', icon: 'search', soft: '#e8f0f9', text: '#2b6cb0' },
  valide: { label: 'Validé', icon: 'check_circle', soft: '#e9f6ee', text: '#1f9d55' },
  rejete: { label: 'Rejeté', icon: 'cancel', soft: '#fdeeec', text: '#dc3a2f' },
}

export const CORRESPONDANCE_LABEL: Record<NonNullable<Correspondance>, string> = {
  constatee: 'Correspondance constatée',
  aucune: 'Aucune correspondance',
  complementaire: 'Vérification complémentaire nécessaire',
}

export interface EvenementProche {
  type: string
  distanceM: number
  date: string
  heure: string
}

export interface HistoriqueEntry {
  date: string
  heure: string
  texte: string
}

export interface Signalement {
  id: string
  type: DangerType
  localite: string
  lieu: string
  offset: [number, number]
  conducteur: string
  telephone: string
  vehicule?: string
  boitier?: string
  date: string
  heure: string
  /** Même instant, au format ISO triable. */
  ts: string
  statut: StatutSignalement
  description: string
  evenementsProches: EvenementProche[]
  evenementsSimilaires: number
  correspondance: Correspondance
  historique: HistoriqueEntry[]
}

export const SIGNALEMENTS: Signalement[] = [
  {
    id: 'SIG-001', type: 'nid_de_poule', localite: 'Centre-ville', lieu: 'Voie principale', offset: [0.023, 0.05],
    conducteur: 'Aminata Diop', telephone: '77 123 45 67', vehicule: undefined, boitier: 'SR-BOX-014',
    date: '03/10/2026', heure: '10:25', ts: '2026-10-03T10:25', statut: 'en_attente',
    description: "Présence d'un nid-de-poule important sur la voie droite.",
    evenementsProches: [
      { type: 'RouteDefectueuse', distanceM: 35, date: '03/10/2026', heure: '10:23' },
      { type: 'SecousseDangereuse', distanceM: 42, date: '03/10/2026', heure: '10:24' },
    ],
    evenementsSimilaires: 4, correspondance: null,
    historique: [{ date: '03/10/2026', heure: '10:25', texte: 'Signalement créé par le conducteur' }],
  },
  {
    id: 'SIG-002', type: 'chaussee_inondee', localite: 'Périphérie', lieu: 'Route de contournement', offset: [-0.033, -0.084],
    conducteur: 'Moussa Diop', telephone: '78 456 12 89', vehicule: 'DK-4471-EF', boitier: 'SR-BOX-021',
    date: '02/10/2026', heure: '09:12', ts: '2026-10-02T09:12', statut: 'en_verification',
    description: "Chaussée envahie par l'eau après les dernières pluies, visibilité réduite pour les usagers.",
    evenementsProches: [{ type: 'RisqueAquaplaning', distanceM: 18, date: '02/10/2026', heure: '09:10' }],
    evenementsSimilaires: 2, correspondance: 'constatee',
    historique: [
      { date: '02/10/2026', heure: '09:12', texte: 'Signalement créé par le conducteur' },
      { date: '02/10/2026', heure: '10:05', texte: "Signalement pris en charge par l'administrateur régional" },
    ],
  },
  {
    id: 'SIG-003', type: 'signalisation_absente', localite: 'Centre-ville', lieu: 'Rond-point central', offset: [-0.0152, -0.0559],
    conducteur: 'Samba Ndiaye', telephone: '70 998 44 21', vehicule: undefined, boitier: undefined,
    date: '01/10/2026', heure: '18:42', ts: '2026-10-01T18:42', statut: 'valide',
    description: 'Panneau de signalisation renversé au niveau du rond-point, aucune indication pour les usagers.',
    evenementsProches: [], evenementsSimilaires: 0, correspondance: 'aucune',
    historique: [
      { date: '01/10/2026', heure: '18:42', texte: 'Signalement créé par le conducteur' },
      { date: '01/10/2026', heure: '19:15', texte: "Signalement pris en charge par l'administrateur régional" },
      { date: '02/10/2026', heure: '08:30', texte: "Signalement validé par l'administrateur régional" },
    ],
  },
  {
    id: 'SIG-004', type: 'chaussee_degradee', localite: 'Zone résidentielle', lieu: 'Rue des manguiers', offset: [-0.051, 0.012],
    conducteur: 'Fatou Sow', telephone: '77 302 65 10', vehicule: undefined, boitier: undefined,
    date: '01/10/2026', heure: '16:37', ts: '2026-10-01T16:37', statut: 'rejete',
    description: 'Fissures profondes sur toute la largeur de la chaussée.',
    evenementsProches: [], evenementsSimilaires: 0, correspondance: 'aucune',
    historique: [
      { date: '01/10/2026', heure: '16:37', texte: 'Signalement créé par le conducteur' },
      { date: '01/10/2026', heure: '17:05', texte: "Signalement pris en charge par l'administrateur régional" },
      { date: '01/10/2026', heure: '17:40', texte: "Signalement rejeté par l'administrateur régional — déjà traité par les services techniques" },
    ],
  },
  {
    id: 'SIG-005', type: 'nid_de_poule', localite: 'Axe principal', lieu: 'RN3 – Km 18', offset: [0.031, 0.063],
    conducteur: 'Ibrahima Diallo', telephone: '76 221 09 54', vehicule: undefined, boitier: undefined,
    date: '01/10/2026', heure: '14:20', ts: '2026-10-01T14:20', statut: 'en_attente',
    description: 'Nid-de-poule profond apparu après les pluies de la semaine dernière.',
    evenementsProches: [{ type: 'RouteDefectueuse', distanceM: 52, date: '01/10/2026', heure: '14:18' }],
    evenementsSimilaires: 1, correspondance: null,
    historique: [{ date: '01/10/2026', heure: '14:20', texte: 'Signalement créé par le conducteur' }],
  },
  {
    id: 'SIG-006', type: 'autre', localite: 'Sortie nord', lieu: 'Sortie ville — RN4', offset: [0.088, 0.036],
    conducteur: 'Ousmane Ba', telephone: '78 114 77 32', vehicule: undefined, boitier: undefined,
    date: '01/10/2026', heure: '11:15', ts: '2026-10-01T11:15', statut: 'en_verification',
    description: 'Animal errant régulièrement présent sur la chaussée en soirée.',
    evenementsProches: [], evenementsSimilaires: 0, correspondance: 'complementaire',
    historique: [
      { date: '01/10/2026', heure: '11:15', texte: 'Signalement créé par le conducteur' },
      { date: '01/10/2026', heure: '12:00', texte: "Signalement pris en charge par l'administrateur régional" },
    ],
  },
  {
    id: 'SIG-007', type: 'chaussee_inondee', localite: 'Zone de la gare', lieu: 'Route de la gare', offset: [0.058, 0.09],
    conducteur: 'Aïssatou Cissé', telephone: '70 556 88 02', vehicule: undefined, boitier: undefined,
    date: '30/09/2026', heure: '19:40', ts: '2026-09-30T19:40', statut: 'valide',
    description: 'Flaques persistantes gênant la circulation sur les deux voies.',
    evenementsProches: [{ type: 'RisqueAquaplaning', distanceM: 29, date: '30/09/2026', heure: '19:38' }],
    evenementsSimilaires: 3, correspondance: 'constatee',
    historique: [
      { date: '30/09/2026', heure: '19:40', texte: 'Signalement créé par le conducteur' },
      { date: '30/09/2026', heure: '20:10', texte: "Signalement pris en charge par l'administrateur régional" },
      { date: '01/10/2026', heure: '08:00', texte: "Signalement validé par l'administrateur régional" },
    ],
  },
  {
    id: 'SIG-008', type: 'signalisation_absente', localite: 'Périphérie ouest', lieu: 'Route de contournement', offset: [-0.033, -0.084],
    conducteur: 'Cheikh Mbaye', telephone: '77 889 23 41', vehicule: undefined, boitier: undefined,
    date: '01/10/2026', heure: '17:22', ts: '2026-10-01T17:22', statut: 'en_attente',
    description: 'Feu tricolore hors service depuis plusieurs jours.',
    evenementsProches: [], evenementsSimilaires: 0, correspondance: null,
    historique: [{ date: '01/10/2026', heure: '17:22', texte: 'Signalement créé par le conducteur' }],
  },
  {
    id: 'SIG-009', type: 'nid_de_poule', localite: 'Centre-ville', lieu: 'Marché central', offset: [-0.008, 0.034],
    conducteur: 'Modou Fall', telephone: '76 334 90 17', vehicule: undefined, boitier: undefined,
    date: '29/09/2026', heure: '08:05', ts: '2026-09-29T08:05', statut: 'rejete',
    description: 'Petite dégradation déjà réparée par les services techniques.',
    evenementsProches: [], evenementsSimilaires: 0, correspondance: 'aucune',
    historique: [
      { date: '29/09/2026', heure: '08:05', texte: 'Signalement créé par le conducteur' },
      { date: '29/09/2026', heure: '09:00', texte: "Signalement pris en charge par l'administrateur régional" },
      { date: '29/09/2026', heure: '09:30', texte: "Signalement rejeté par l'administrateur régional — déjà résolu" },
    ],
  },
  {
    id: 'SIG-010', type: 'chaussee_degradee', localite: 'Axe principal', lieu: 'RN3 – Km 12', offset: [0.0485, 0.0123],
    conducteur: 'Awa Diouf', telephone: '70 772 41 93', vehicule: undefined, boitier: 'SR-BOX-014',
    date: '28/09/2026', heure: '13:50', ts: '2026-09-28T13:50', statut: 'valide',
    description: 'Affaissement de la chaussée sur la voie de droite, risque pour les deux-roues.',
    evenementsProches: [{ type: 'RouteDefectueuse', distanceM: 14, date: '28/09/2026', heure: '13:47' }],
    evenementsSimilaires: 5, correspondance: 'constatee',
    historique: [
      { date: '28/09/2026', heure: '13:50', texte: 'Signalement créé par le conducteur' },
      { date: '28/09/2026', heure: '14:20', texte: "Signalement pris en charge par l'administrateur régional" },
      { date: '28/09/2026', heure: '15:00', texte: "Signalement validé par l'administrateur régional" },
    ],
  },
  {
    id: 'SIG-011', type: 'autre', localite: 'Zone technopole', lieu: 'Zone technopole', offset: [0.0085, -0.0644],
    conducteur: 'Bineta Sarr', telephone: '78 220 66 05', vehicule: undefined, boitier: undefined,
    date: '27/09/2026', heure: '20:14', ts: '2026-09-27T20:14', statut: 'en_attente',
    description: 'Éclairage public défaillant sur tout le tronçon.',
    evenementsProches: [], evenementsSimilaires: 0, correspondance: null,
    historique: [{ date: '27/09/2026', heure: '20:14', texte: 'Signalement créé par le conducteur' }],
  },
  {
    id: 'SIG-012', type: 'chaussee_inondee', localite: 'Centre-ville', lieu: 'Avenue principale', offset: [0.001, -0.006],
    conducteur: 'Lamine Gueye', telephone: '77 445 38 60', vehicule: undefined, boitier: undefined,
    date: '26/09/2026', heure: '09:30', ts: '2026-09-26T09:30', statut: 'valide',
    description: 'Canalisation bouchée provoquant une inondation récurrente à chaque pluie.',
    evenementsProches: [{ type: 'RisqueAquaplaning', distanceM: 21, date: '26/09/2026', heure: '09:27' }],
    evenementsSimilaires: 2, correspondance: 'constatee',
    historique: [
      { date: '26/09/2026', heure: '09:30', texte: 'Signalement créé par le conducteur' },
      { date: '26/09/2026', heure: '10:00', texte: "Signalement pris en charge par l'administrateur régional" },
      { date: '26/09/2026', heure: '10:45', texte: "Signalement validé par l'administrateur régional" },
    ],
  },
]

/**
 * Tendances sur quelques relevés récents, pour la petite courbe (sparkline)
 * de chaque carte KPI — un agrégat temporel qui ne se déduit pas de la seule
 * liste de signalements ci-dessus (qui ne couvre qu'un instantané). Démonstration.
 */
export const KPI_TRENDS = {
  total: [8, 9, 9, 10, 11, 11, 12],
  enAttente: [2, 3, 2, 3, 4, 3, 4],
  enVerification: [1, 1, 2, 1, 2, 2, 2],
  traites: [5, 5, 5, 6, 5, 6, 6],
}
