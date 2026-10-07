import { PATHS } from '@/routes/paths'

export type RiskLevel = 'critique' | 'vigilance' | 'normale'

export interface AdminKpi {
  icon: string
  tint: string
  soft: string
  value: string
  label: string
  trend: string
  trendIcon: 'up' | 'down' | 'flat'
  cta: string
  /** Route vers laquelle le CTA de la carte redirige. */
  to: string
}

/** Indicateurs clés de la région — vue d'ensemble du jour pour l'Admin Régional. */
export const ADMIN_KPIS: AdminKpi[] = [
  { icon: 'directions_car', tint: '#2b6cb0', soft: '#e8f0f9', value: '8', label: 'Boîtiers IoT', trend: '1 en ligne', trendIcon: 'up', cta: 'Voir tous', to: PATHS.admin.monitoring },
  { icon: 'report', tint: '#dc3a2f', soft: '#fdeeec', value: '3', label: "Incidents aujourd'hui", trend: '-1 vs hier', trendIcon: 'down', cta: 'Voir détails', to: PATHS.admin.incidents },
  { icon: 'notifications_active', tint: '#e8940c', soft: '#fdf4e6', value: '5', label: 'Alertes actives', trend: '0 vs hier', trendIcon: 'flat', cta: 'Voir toutes', to: PATHS.admin.alertes },
  { icon: 'crisis_alert', tint: '#7c3aed', soft: '#f1eafe', value: '7', label: 'Zones à risque', trend: 'stable', trendIcon: 'flat', cta: 'Voir la carte', to: PATHS.admin.carte },
  /* La page Statistiques dédiée a été retirée : ce CTA renvoie maintenant vers Historique,
     qui porte désormais la section « Statistiques » de la région. */
  { icon: 'show_chart', tint: '#0F766E', soft: '#e7f5f0', value: '32', label: 'Trajets surveillés', trend: '12%', trendIcon: 'up', cta: "Voir l'historique", to: PATHS.admin.historique },
]

export interface AdminEvent {
  id: string
  icon: string
  tint: string
  soft: string
  title: string
  location: string
  ago: string
  badge: { label: string; tint: string; soft: string } | null
}

/**
 * Fil d'événements récents toutes sources confondues (incidents, capteurs,
 * résolutions). Lieux génériques (plus de noms de quartiers dakarois) pour
 * rester cohérents quelle que soit la région réellement connectée.
 */
export const ADMIN_EVENTS: AdminEvent[] = [
  {
    id: 'e1',
    icon: 'report',
    tint: '#dc3a2f',
    soft: '#fdeeec',
    title: 'Accident signalé',
    location: 'RN3 – Km 12',
    ago: 'il y a 12 min',
    badge: { label: 'Critique', tint: '#dc3a2f', soft: '#fdeeec' },
  },
  {
    id: 'e2',
    icon: 'speed',
    tint: '#e8940c',
    soft: '#fdf4e6',
    title: 'Freinage brusque détecté',
    location: 'Avenue principale',
    ago: 'il y a 28 min',
    badge: { label: 'Vigilance', tint: '#e8940c', soft: '#fdf4e6' },
  },
  {
    id: 'e3',
    icon: 'wifi_off',
    tint: '#2b6cb0',
    soft: '#e8f0f9',
    title: 'Boîtier hors ligne',
    location: 'SR-03 (périphérie)',
    ago: 'il y a 42 min',
    badge: null,
  },
  {
    id: 'e4',
    icon: 'check_circle',
    tint: '#1f9d55',
    soft: '#e9f6ee',
    title: 'Retour à la normale',
    location: 'Zone technopole',
    ago: 'il y a 1 h',
    badge: { label: 'Résolu', tint: '#1f9d55', soft: '#e9f6ee' },
  },
]

export interface AdminZone {
  id: string
  name: string
  /** Delta [lat, lng] en degrés par rapport au centre de la région connectée (src/lib/regions.ts). */
  offset: [number, number]
  incidents: number
  avgSpeed: number
  level: RiskLevel
  lastDetection: string
}

/**
 * Zones à risque de la région — alimente la carte régionale (RegionMap) et
 * le classement de droite du dashboard. Positions relatives au centre de la
 * région connectée, pas de coordonnées absolues (voir src/lib/regions.ts).
 */
export const ADMIN_REGION_ZONES: AdminZone[] = [
  { id: 'z1', name: 'RN3 – Km 12', offset: [0.0485, 0.0123], incidents: 23, avgSpeed: 87, level: 'critique', lastDetection: 'il y a 12 min' },
  { id: 'z2', name: 'Avenue principale', offset: [-0.0434, -0.0381], incidents: 12, avgSpeed: 64, level: 'vigilance', lastDetection: 'il y a 28 min' },
  { id: 'z3', name: 'Rond-point central', offset: [-0.0152, -0.0559], incidents: 8, avgSpeed: 32, level: 'vigilance', lastDetection: 'il y a 51 min' },
  { id: 'z4', name: 'Route de contournement', offset: [0.0389, 0.0097], incidents: 6, avgSpeed: 48, level: 'normale', lastDetection: 'il y a 1 h' },
  { id: 'z5', name: 'Zone technopole', offset: [0.0085, -0.0644], incidents: 4, avgSpeed: 42, level: 'normale', lastDetection: 'il y a 2 h' },
]

export interface TopLocality {
  id: string
  name: string
  incidents: number
  alerts: number
  level: RiskLevel
}

/**
 * Localités les plus actives sur 7 jours, triées par sévérité puis volume.
 * Libellés génériques (plus de quartiers de Dakar) pour rester cohérents
 * quelle que soit la région connectée.
 */
export const TOP_LOCALITIES: TopLocality[] = [
  { id: 'l1', name: 'Zone nord', incidents: 5, alerts: 3, level: 'critique' },
  { id: 'l2', name: 'Périphérie', incidents: 4, alerts: 2, level: 'vigilance' },
  { id: 'l3', name: 'Zone résidentielle', incidents: 2, alerts: 1, level: 'vigilance' },
  { id: 'l4', name: 'Zone est', incidents: 2, alerts: 1, level: 'normale' },
  { id: 'l5', name: 'Centre-ville', incidents: 1, alerts: 0, level: 'normale' },
]

export interface PendingZone {
  id: string
  name: string
  level: 'critique' | 'vigilance'
  detectedAt: string
}

/** File d'attente de validation — extrait des zones détectées par le système, en attente d'une décision de l'Admin Régional. */
export const PENDING_ZONES: PendingZone[] = [
  { id: 'p1', name: 'RN3 – Km 12', level: 'critique', detectedAt: "Détecté par l'IA le 15 sept. 2026" },
  { id: 'p2', name: 'Avenue centrale', level: 'vigilance', detectedAt: "Détecté par l'IA le 11 sept. 2026" },
  { id: 'p3', name: 'Quartier résidentiel nord', level: 'vigilance', detectedAt: "Détecté par l'IA le 9 sept. 2026" },
]

export interface DayStat {
  date: string
  incidents: number
  alertes: number
  zones: number
}

/** Série des 7 derniers jours — alimente le graphique à bascule Incidents / Alertes / Zones. */
export const WEEK_STATS: DayStat[] = [
  { date: '03/09', incidents: 4, alertes: 6, zones: 1 },
  { date: '04/09', incidents: 6, alertes: 5, zones: 2 },
  { date: '05/09', incidents: 3, alertes: 4, zones: 1 },
  { date: '06/09', incidents: 5, alertes: 7, zones: 2 },
  { date: '07/09', incidents: 7, alertes: 6, zones: 3 },
  { date: '08/09', incidents: 4, alertes: 5, zones: 2 },
  { date: '09/09', incidents: 3, alertes: 4, zones: 1 },
]

export interface IncidentBreakdown {
  label: string
  pct: number
  color: string
}

/** Répartition des 45 incidents du mois par type — alimente le donut. */
export const INCIDENT_BREAKDOWN: IncidentBreakdown[] = [
  { label: 'Accidents', pct: 40, color: '#2b6cb0' },
  { label: 'Freinages brusques', pct: 24, color: '#7c3aed' },
  { label: 'Virages dangereux', pct: 16, color: '#e8940c' },
  { label: 'Route défectueuse', pct: 12, color: '#dc3a2f' },
  { label: 'Autres', pct: 8, color: '#94a3b8' },
]

export const INCIDENT_TOTAL = 45
