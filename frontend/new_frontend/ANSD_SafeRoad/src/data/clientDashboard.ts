import { ilYa } from '@/data/adminHome'
import { idAffichage } from '@/data/superAdminBoitiers'
import type { TableauDeBordConducteurApi } from '@/lib/api'

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

/* ------------------------------------------------------------------ */
/* Données réelles (GET /conducteur/tableau-de-bord/)                  */
/* ------------------------------------------------------------------ */

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

/**
 * Résumé du backend -> indicateurs et état du boîtier de l'accueil. Les kilomètres et trajets
 * ne sont pas encore transmis par le boîtier : affichés « — », jamais inventés.
 */
export function accueilDepuisApi(api: TableauDeBordConducteurApi | null, maintenant = Date.now()) {
  const alertes = api?.alertes ?? { total: 0, critiques: 0 }
  const signalements = api?.signalements ?? { total: 0, en_attente: 0, valides: 0 }
  const kpis: DashboardKpi[] = [
    { icon: 'notifications_active', tint: '#dc3a2f', soft: '#fdeeec', value: String(alertes.total), label: 'Alertes reçues', note: `Sur les ${api?.jours ?? 30} derniers jours` },
    { icon: 'route', tint: '#2b6cb0', soft: '#e8f0f9', value: '—', label: 'Kilomètres parcourus', note: 'Bientôt : trajets transmis par le boîtier' },
    { icon: 'crisis_alert', tint: '#e8940c', soft: '#fdf4e6', value: String(alertes.critiques), label: 'Alertes en zone critique', note: 'Zones reconnues par l\'ANASER' },
    { icon: 'flag', tint: '#0F766E', soft: '#e7f5f0', value: String(signalements.total), label: 'Signalements envoyés', note: `${pluriel(signalements.valides, 'validé')} · ${signalements.en_attente} en attente` },
  ]
  const b = api?.boitier
  const boitier = b
    ? {
        id: idAffichage(b.id),
        immatriculation: b.immatriculation ?? 'Véhicule non renseigné',
        online: b.en_ligne,
        lastSeen: b.derniere_activite ? ilYa(b.derniere_activite, maintenant) : 'Jamais',
      }
    : null
  return { kpis, boitier }
}
