export interface DashboardKpi {
  icon: string
  tint: string
  soft: string
  value: string
  label: string
  note: string
}

/** Indicateurs clés sur les 30 derniers jours — vue d'ensemble de l'activité du conducteur. */
export const DASHBOARD_KPIS: DashboardKpi[] = [
  {
    icon: 'notifications_active',
    tint: '#dc3a2f',
    soft: '#fdeeec',
    value: '34',
    label: 'Alertes reçues',
    note: 'Sur les 30 derniers jours',
  },
  {
    icon: 'route',
    tint: '#2b6cb0',
    soft: '#e8f0f9',
    value: '1 284',
    label: 'Kilomètres parcourus',
    note: '42 trajets enregistrés',
  },
  {
    icon: 'crisis_alert',
    tint: '#e8940c',
    soft: '#fdf4e6',
    value: '7',
    label: 'Zones critiques traversées',
    note: 'Dont 3 sur la RN1',
  },
  {
    icon: 'flag',
    tint: '#0F766E',
    soft: '#e7f5f0',
    value: '3',
    label: 'Signalements envoyés',
    note: '2 validés par un administrateur',
  },
]

export const DRIVING_SCORE = { value: 88, label: 'Conduite prudente' }

export interface ScoreRow {
  label: string
  value: string
  pct: number
  tint: string
}

export const SCORE_ROWS: ScoreRow[] = [
  { label: 'Respect des vitesses', value: '92 %', pct: 92, tint: '#25c79a' },
  { label: 'Freinages brusques', value: '4 ce mois', pct: 28, tint: '#e8940c' },
  { label: 'Zones critiques évitées', value: '81 %', pct: 81, tint: '#25c79a' },
]

/** Position du véhicule — utilisée pour centrer la carte et calculer les zones à proximité. */
export const DRIVER_POSITION = { lat: 14.7231, lng: -17.1385 }

export const RADIUS_CHOICES = [5, 20, 50] as const

export const LIVE_ALERT = {
  title: 'Zone à risque sur votre trajet',
  detail: 'RN1 — Km 45 (Thiès) · à 1,2 km · 23 incidents détectés ce mois',
}

export const BOX_STATUS = {
  id: 'SR-041',
  online: true,
  battery: 78,
  lastSeen: 'il y a 2 min',
}
