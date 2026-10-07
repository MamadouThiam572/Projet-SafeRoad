/**
 * Données de démonstration du Dashboard national (Super Admin).
 *
 * Les 14 régions du Sénégal portent chacune leurs propres chiffres, et TOUS
 * les totaux affichés (boîtiers, incidents, signalements, zones…) sont
 * calculés à partir de ces lignes — ils recoupent donc exactement ceux de la
 * maquette (156 boîtiers, 3 482 incidents, 864 signalements, 73 zones…).
 *
 * Les séries journalières (90 jours) sont générées de façon déterministe
 * (pas de hasard à l'exécution) et réparties pour que leur somme soit égale
 * au total de la région sur les 30 derniers jours (les 60 jours précédents
 * alimentent les périodes « 3 derniers mois » et « Personnalisée »).
 *
 * TODO backend : remplacer par les agrégats nationaux (par région) exposés
 * par l'API réservée au rôle super_admin.
 */

import { REGIONS_WITH_INACTIVE_ADMIN } from '@/data/superAdminUsers'

export interface RegionStat {
  slug: string
  label: string
  boitiers: number
  /** Boîtiers affectés à un conducteur. */
  affectes: number
  conducteurs: number
  /** Total sur les 30 derniers jours. */
  incidents: number
  /** Total sur les 30 derniers jours. */
  alertes: number
  signalements: number
  signalementsEnAttente: number
  zones: number
  zonesEnAttente: number
  /** Boîtiers nécessitant une attention technique. */
  anomalies: number
  /** Le compte de l'administrateur régional est inactif (dérivé de la page Utilisateurs). */
  adminAction: boolean
}

const RAW_REGION_STATS: Omit<RegionStat, 'adminAction'>[] = [
  { slug: 'dakar', label: 'Dakar', boitiers: 42, affectes: 37, conducteurs: 444, incidents: 1240, alertes: 2037, signalements: 312, signalementsEnAttente: 5, zones: 24, zonesEnAttente: 5, anomalies: 2 },
  { slug: 'thies', label: 'Thiès', boitiers: 27, affectes: 24, conducteurs: 224, incidents: 624, alertes: 1025, signalements: 156, signalementsEnAttente: 3, zones: 13, zonesEnAttente: 3, anomalies: 1 },
  { slug: 'diourbel', label: 'Diourbel', boitiers: 18, affectes: 15, conducteurs: 137, incidents: 382, alertes: 628, signalements: 92, signalementsEnAttente: 2, zones: 8, zonesEnAttente: 2, anomalies: 1 },
  { slug: 'saint_louis', label: 'Saint-Louis', boitiers: 15, affectes: 12, conducteurs: 108, incidents: 301, alertes: 495, signalements: 74, signalementsEnAttente: 2, zones: 7, zonesEnAttente: 2, anomalies: 0 },
  { slug: 'louga', label: 'Louga', boitiers: 12, affectes: 10, conducteurs: 89, incidents: 248, alertes: 408, signalements: 61, signalementsEnAttente: 1, zones: 5, zonesEnAttente: 1, anomalies: 0 },
  { slug: 'kaolack', label: 'Kaolack', boitiers: 10, affectes: 8, conducteurs: 72, incidents: 201, alertes: 330, signalements: 48, signalementsEnAttente: 1, zones: 4, zonesEnAttente: 1, anomalies: 1 },
  { slug: 'ziguinchor', label: 'Ziguinchor', boitiers: 8, affectes: 7, conducteurs: 63, incidents: 176, alertes: 289, signalements: 35, signalementsEnAttente: 1, zones: 3, zonesEnAttente: 1, anomalies: 0 },
  { slug: 'tambacounda', label: 'Tambacounda', boitiers: 6, affectes: 5, conducteurs: 51, incidents: 142, alertes: 233, signalements: 28, signalementsEnAttente: 1, zones: 2, zonesEnAttente: 1, anomalies: 0 },
  { slug: 'fatick', label: 'Fatick', boitiers: 5, affectes: 4, conducteurs: 19, incidents: 52, alertes: 85, signalements: 14, signalementsEnAttente: 1, zones: 2, zonesEnAttente: 1, anomalies: 0 },
  { slug: 'kaffrine', label: 'Kaffrine', boitiers: 3, affectes: 2, conducteurs: 11, incidents: 31, alertes: 51, signalements: 9, signalementsEnAttente: 0, zones: 1, zonesEnAttente: 0, anomalies: 0 },
  { slug: 'kedougou', label: 'Kédougou', boitiers: 2, affectes: 2, conducteurs: 5, incidents: 14, alertes: 23, signalements: 4, signalementsEnAttente: 0, zones: 0, zonesEnAttente: 0, anomalies: 0 },
  { slug: 'kolda', label: 'Kolda', boitiers: 3, affectes: 2, conducteurs: 10, incidents: 29, alertes: 48, signalements: 12, signalementsEnAttente: 1, zones: 2, zonesEnAttente: 1, anomalies: 0 },
  { slug: 'matam', label: 'Matam', boitiers: 2, affectes: 1, conducteurs: 6, incidents: 18, alertes: 30, signalements: 7, signalementsEnAttente: 0, zones: 1, zonesEnAttente: 0, anomalies: 0 },
  { slug: 'sedhiou', label: 'Sédhiou', boitiers: 3, affectes: 1, conducteurs: 9, incidents: 24, alertes: 39, signalements: 12, signalementsEnAttente: 0, zones: 1, zonesEnAttente: 0, anomalies: 0 },
]

export const REGION_STATS: RegionStat[] = RAW_REGION_STATS.map((r) => ({
  ...r,
  adminAction: REGIONS_WITH_INACTIVE_ADMIN.has(r.slug),
}))

/* ------------------------------------------------------------------ */
/* Séries journalières (90 jours : 03/07/2026 → 30/09/2026)            */
/* ------------------------------------------------------------------ */

export type SeriesKey = 'incidents' | 'signalements' | 'alertes'

export const SERIES_DAYS = 90
/** Les 30 derniers jours de chaque série totalisent exactement les chiffres de REGION_STATS. */
export const RECENT_DAYS = 30

const SERIES_END = Date.UTC(2026, 8, 30) // 30/09/2026
const DAY_MS = 24 * 60 * 60 * 1000

/** Dates ISO (AAAA-MM-JJ) des 90 jours, du plus ancien au plus récent. */
export const SERIES_DATES: string[] = Array.from({ length: SERIES_DAYS }, (_, i) =>
  new Date(SERIES_END - (SERIES_DAYS - 1 - i) * DAY_MS).toISOString().slice(0, 10),
)

/** Libellés JJ/MM correspondants. */
export const SERIES_LABELS: string[] = SERIES_DATES.map((d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`)

/** Répartit `total` selon `weights` en entiers dont la somme vaut exactement `total`. */
function distribute(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0)
  const raw = weights.map((w) => (total * w) / sum)
  const floors = raw.map(Math.floor)
  let remainder = total - floors.reduce((a, b) => a + b, 0)
  const order = raw.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac)
  for (let k = 0; remainder > 0; k = (k + 1) % order.length, remainder--) floors[order[k].i] += 1
  return floors
}

function weightsFor(days: number, seed: number, offset: number): number[] {
  let state = seed * 9301 + 49297 + offset
  const rnd = () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
  return Array.from({ length: days }, (_, d) => 1 + 0.25 * Math.sin((d + offset) / 3.2 + (seed % 7)) + (rnd() - 0.5) * 0.4)
}

/**
 * 90 valeurs journalières : les 30 derniers jours totalisent `recentTotal`,
 * les 60 jours précédents un peu moins par jour (légère hausse récente).
 */
function makeSeries(recentTotal: number, seed: number): number[] {
  const olderDays = SERIES_DAYS - RECENT_DAYS
  const older = distribute(Math.round(recentTotal * 1.7), weightsFor(olderDays, seed, 0))
  const recent = distribute(recentTotal, weightsFor(RECENT_DAYS, seed, olderDays))
  return [...older, ...recent]
}

export const REGION_SERIES: Record<string, Record<SeriesKey, number[]>> = Object.fromEntries(
  REGION_STATS.map((r, idx) => [
    r.slug,
    {
      incidents: makeSeries(r.incidents, idx + 1),
      signalements: makeSeries(r.signalements, idx + 101),
      alertes: makeSeries(r.alertes, idx + 201),
    },
  ]),
)

/* ------------------------------------------------------------------ */
/* Activité récente                                                    */
/* ------------------------------------------------------------------ */

export type SystemEventKind = 'signalement' | 'zone' | 'incident' | 'boitier'

export interface SystemEvent {
  id: string
  kind: SystemEventKind
  title: string
  /** Slug de région (pour le filtre) et lieu affiché. */
  region: string
  place: string
  time: string // HH:mm
}

export const EVENT_META: Record<SystemEventKind, { icon: string; fg: string; bg: string }> = {
  signalement: { icon: 'campaign', fg: '#dc3a2f', bg: '#fdeeec' },
  zone: { icon: 'location_on', fg: '#e8940c', bg: '#fdf4e6' },
  incident: { icon: 'warning', fg: '#dc3a2f', bg: '#fdeeec' },
  boitier: { icon: 'memory', fg: '#1f9d55', bg: '#e9f6ee' },
}

/** Du plus récent au plus ancien. */
export const SYSTEM_EVENTS: SystemEvent[] = [
  { id: 'ev1', kind: 'signalement', title: 'Nouveau signalement', region: 'dakar', place: 'Dakar — Mermoz', time: '14:32' },
  { id: 'ev2', kind: 'zone', title: 'Zone proposée', region: 'thies', place: 'Thiès — Thiès Ville', time: '14:18' },
  { id: 'ev3', kind: 'incident', title: 'Incident détecté', region: 'dakar', place: 'Dakar — Parcelles', time: '13:54' },
  { id: 'ev4', kind: 'boitier', title: 'Nouveau boîtier enregistré', region: 'saint_louis', place: 'Saint-Louis', time: '13:41' },
  { id: 'ev5', kind: 'incident', title: 'Incident détecté', region: 'diourbel', place: 'Diourbel — Axe principal', time: '13:20' },
  { id: 'ev6', kind: 'signalement', title: 'Nouveau signalement', region: 'kaolack', place: 'Kaolack — Centre-ville', time: '12:47' },
  { id: 'ev7', kind: 'zone', title: 'Zone proposée', region: 'diourbel', place: 'Diourbel — Zone de la gare', time: '12:15' },
  { id: 'ev8', kind: 'boitier', title: 'Nouveau boîtier enregistré', region: 'louga', place: 'Louga', time: '11:58' },
  { id: 'ev9', kind: 'incident', title: 'Incident détecté', region: 'ziguinchor', place: 'Ziguinchor — Sortie nord', time: '11:30' },
]
