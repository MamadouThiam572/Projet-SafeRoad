/**
 * Données de la page Super Admin → Zones accidentogènes.
 *
 * Une ZONE est le résultat d'une ANALYSE de plusieurs événements : ce n'est ni
 * un incident (détecté par un boîtier), ni un signalement (déclaré par un
 * conducteur), mais un secteur routier où ces événements se répètent.
 *
 * Règle d'identification retenue pour la démonstration : un secteur de
 * 500 m de rayon qui rassemble au moins 3 événements (incidents + signalements
 * non rejetés) en 30 jours glissants devient une zone candidate ; ces 30 jours
 * forment sa « période d'observation ». Le niveau de risque est calculé à partir
 * de tous les événements du secteur sur 90 jours (gravité des incidents +
 * signalements).
 *
 * Cohérence avec les autres pages :
 *   - 73 zones au total, réparties par région comme au Dashboard
 *     (`REGION_STATS[].zones`) ;
 *   - « À valider » = `zonesEnAttente` du Dashboard (18, par région) ;
 *   - les incidents et signalements d'une zone sont de VRAIS éléments des pages
 *     Incidents et Signalements (même région, dans le rayon de la zone) : on peut
 *     les rouvrir là-bas ;
 *   - chaque zone a au moins un événement sur les 30 derniers jours : elle est
 *     donc comptée pour la période « 30 derniers jours » du Dashboard.
 *
 * Workflow (à confirmer avec l'équipe) : identifiée par le système → à analyser
 * (données complémentaires) → à valider → validée ou rejetée. L'administrateur
 * régional décide ; le Super Admin peut intervenir sur la décision.
 *
 * TODO backend : remplacer par la liste paginée des zones (filtres région /
 * localité / risque / statut / période), le détail (événements associés,
 * statistiques) et le changement de statut avec motif.
 */

import { RECENT_DAYS, REGION_STATS, SERIES_DATES, SERIES_DAYS } from '@/data/superAdminHome'
import { INITIAL_INCIDENTS, INCIDENT_TYPES, type Gravite, type Incident } from '@/data/superAdminIncidents'
import { INITIAL_SIGNALEMENTS, type Signalement } from '@/data/superAdminSignalements'

export type ZoneRisk = 'faible' | 'moyen' | 'eleve' | 'critique'
export type ZoneStatut = 'a_valider' | 'a_analyser' | 'validee' | 'rejetee'

export const RISK_ORDER: ZoneRisk[] = ['critique', 'eleve', 'moyen', 'faible']

export const RISK_META: Record<ZoneRisk, { label: string; color: string; soft: string; text: string; icon: string; radius: number }> = {
  critique: { label: 'Critique', color: '#dc3a2f', soft: '#fdeeec', text: '#c4281d', icon: 'error', radius: 10 },
  eleve: { label: 'Élevé', color: '#ea7b1c', soft: '#fdf1e6', text: '#b4590a', icon: 'warning', radius: 9 },
  moyen: { label: 'Moyen', color: '#d9a40c', soft: '#fdf8e6', text: '#8a6d02', icon: 'info', radius: 8 },
  faible: { label: 'Faible', color: '#1f9d55', soft: '#e9f6ee', text: '#1a8248', icon: 'check_circle', radius: 7 },
}

export const ZSTATUT_ORDER: ZoneStatut[] = ['a_valider', 'a_analyser', 'validee', 'rejetee']

export const ZSTATUT_META: Record<ZoneStatut, { label: string; color: string; soft: string; text: string; icon: string; hint: string }> = {
  a_valider: { label: 'À valider', color: '#e8940c', soft: '#fdf4e6', text: '#b86e00', icon: 'schedule', hint: 'Analyse terminée : en attente de décision.' },
  a_analyser: { label: 'À analyser', color: '#2b6cb0', soft: '#e8f0f9', text: '#245a94', icon: 'troubleshoot', hint: 'Données complémentaires en cours de collecte avant décision.' },
  validee: { label: 'Validée', color: '#1f9d55', soft: '#e9f6ee', text: '#1a8248', icon: 'check_circle', hint: 'Zone officiellement retenue comme accidentogène.' },
  rejetee: { label: 'Rejetée', color: '#dc3a2f', soft: '#fdeeec', text: '#c4281d', icon: 'cancel', hint: "Non retenue (événements isolés, cause ponctuelle, travaux terminés…)." },
}

/** Rayon d'une zone (m). */
export const ZONE_RADIUS_M = 500
/** Nombre minimal d'événements pour identifier une zone... */
export const ZONE_MIN_EVENTS = 3
/** ...sur cette durée (jours glissants) : la période d'observation. */
export const ZONE_WINDOW_DAYS = 30

export interface Zone {
  /** « ZN-00024 » */
  id: string
  /** Numéro chronologique d'identification (1 = la plus ancienne). */
  num: number
  region: string
  locality: string
  lat: number
  lng: number
  risk: ZoneRisk
  /** Score de risque (somme pondérée des événements, 90 jours). */
  score: number
  /** Statut initial (les modifications faites dans la page sont locales). */
  statut: ZoneStatut
  /** Début de la période d'observation (indice dans SERIES_DATES) : 30 jours avant l'identification. */
  obsStartDay: number
  /** Jour d'identification : fin de la période d'observation (au moins 3 événements sur les 30 jours qui précèdent). */
  identDay: number
  /** Jour de la décision (validation ou rejet), s'il y en a eu une. */
  decisionDay: number | null
  /** Motif du rejet, pour une zone rejetée. */
  rejectReason: string | null
}

export interface ZoneHistoryItem {
  at: string
  text: string
}

/* ------------------------------------------------------------------ */
/* Outils                                                              */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rnd = mulberry32(20261008)
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1))

const M_PER_DEG_LAT = 111_320
/** Distance approchée (m) : suffisante à l'échelle d'une région. */
function distM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dy = (aLat - bLat) * M_PER_DEG_LAT
  const dx = (aLng - bLng) * M_PER_DEG_LAT * Math.cos((((aLat + bLat) / 2) * Math.PI) / 180)
  return Math.sqrt(dx * dx + dy * dy)
}

const GRAVITE_WEIGHT: Record<Gravite, number> = { critique: 5, elevee: 3, moyenne: 2, faible: 1 }
/** Un signalement non rejeté pèse autant qu'un incident de gravité moyenne. */
const SIG_WEIGHT = 2

const p2 = (n: number) => String(n).padStart(2, '0')
const dayLabel = (day: number) => `${SERIES_DATES[day].slice(8, 10)}/${SERIES_DATES[day].slice(5, 7)}`
const dayFull = (day: number) => `${SERIES_DATES[day].slice(8, 10)}/${SERIES_DATES[day].slice(5, 7)}/${SERIES_DATES[day].slice(0, 4)}`

/** « 05/09/2026 » */
export const zoneDate = (day: number) => dayFull(day)

/* ------------------------------------------------------------------ */
/* Événements d'une zone                                               */
/* ------------------------------------------------------------------ */

const incidentsByRegion = new Map<string, Incident[]>()
for (const i of INITIAL_INCIDENTS) {
  const list = incidentsByRegion.get(i.region)
  if (list) list.push(i)
  else incidentsByRegion.set(i.region, [i])
}
const sigsByRegion = new Map<string, Signalement[]>()
for (const s of INITIAL_SIGNALEMENTS) {
  if (s.statut === 'rejete') continue
  const list = sigsByRegion.get(s.region)
  if (list) list.push(s)
  else sigsByRegion.set(s.region, [s])
}

interface Located {
  lat: number
  lng: number
}
function within<T extends Located>(list: T[] | undefined, lat: number, lng: number): T[] {
  if (!list) return []
  return list.filter((e) => distM(e.lat, e.lng, lat, lng) <= ZONE_RADIUS_M)
}

/* ------------------------------------------------------------------ */
/* Génération                                                          */
/* ------------------------------------------------------------------ */

interface Candidate {
  region: string
  lat: number
  lng: number
  locality: string
  score: number
  recent: number
  /** Jours (indices) de chaque événement du secteur, triés. */
  days: number[]
}

/** Nombre d'événements du secteur sur les 30 jours qui se terminent au jour `day`. */
function windowCount(days: number[], day: number): number {
  let n = 0
  for (const d of days) if (d <= day && d > day - ZONE_WINDOW_DAYS) n++
  return n
}

/** Jours où la règle d'identification est satisfaite, dans [lo, hi]. */
function eligibleDays(days: number[], lo: number, hi: number): number[] {
  const out: number[] = []
  for (let d = Math.max(0, lo); d <= Math.min(SERIES_DAYS - 1, hi); d++) if (windowCount(days, d) >= ZONE_MIN_EVENTS) out.push(d)
  return out
}

const CELL = 0.005
const MIN_SPACING_M = 1200

function evaluate(region: string, lat: number, lng: number): Candidate | null {
  const incs = within(incidentsByRegion.get(region), lat, lng)
  const sigs = within(sigsByRegion.get(region), lat, lng)
  const total = incs.length + sigs.length
  if (total < ZONE_MIN_EVENTS) return null
  const recentStart = SERIES_DAYS - RECENT_DAYS
  const recent = incs.filter((i) => i.day >= recentStart).length + sigs.filter((s) => s.day >= recentStart).length
  if (recent === 0) return null
  const score = incs.reduce((a, i) => a + GRAVITE_WEIGHT[i.gravite], 0) + sigs.length * SIG_WEIGHT
  const days = [...incs.map((i) => i.day), ...sigs.map((s) => s.day)].sort((a, b) => a - b)
  if (eligibleDays(days, 0, SERIES_DAYS - 1).length === 0) return null
  const counts = new Map<string, number>()
  for (const i of incs) counts.set(i.locality, (counts.get(i.locality) ?? 0) + 1)
  for (const s of sigs) counts.set(s.locality, (counts.get(s.locality) ?? 0) + 1)
  const locality = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]
  return { region, lat, lng, locality, score, recent, days }
}

function pickRegionZones(region: string, count: number): Candidate[] {
  if (count === 0) return []
  // Cellules de ~550 m pondérées par la gravité des incidents et les signalements.
  const cells = new Map<string, { lat: number; lng: number; w: number; n: number }>()
  const add = (lat: number, lng: number, w: number) => {
    const key = `${Math.round(lat / CELL)},${Math.round(lng / CELL)}`
    const c = cells.get(key) ?? { lat: 0, lng: 0, w: 0, n: 0 }
    c.lat += lat
    c.lng += lng
    c.w += w
    c.n += 1
    cells.set(key, c)
  }
  for (const i of incidentsByRegion.get(region) ?? []) add(i.lat, i.lng, GRAVITE_WEIGHT[i.gravite])
  for (const s of sigsByRegion.get(region) ?? []) add(s.lat, s.lng, SIG_WEIGHT)
  const ranked = [...cells.values()].map((c) => ({ lat: c.lat / c.n, lng: c.lng / c.n, w: c.w })).sort((a, b) => b.w - a.w || a.lat - b.lat)

  const chosen: Candidate[] = []
  for (const cell of ranked) {
    if (chosen.length >= count) break
    // Un tour de recentrage sur les événements du rayon.
    const near = [...within(incidentsByRegion.get(region), cell.lat, cell.lng), ...within(sigsByRegion.get(region), cell.lat, cell.lng)]
    if (near.length === 0) continue
    const lat = near.reduce((a, e) => a + e.lat, 0) / near.length
    const lng = near.reduce((a, e) => a + e.lng, 0) / near.length
    if (chosen.some((c) => distM(c.lat, c.lng, lat, lng) < MIN_SPACING_M)) continue
    const cand = evaluate(region, Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5)
    if (cand) chosen.push(cand)
  }
  return chosen
}

const REJECT_REASONS = [
  'Événements isolés dans le temps : aucune récurrence confirmée sur le terrain.',
  'Cause ponctuelle (chantier terminé), le danger n\'existe plus.',
  'Données insuffisantes pour justifier une zone officielle.',
]

function build(): Zone[] {
  // 1. Choix des secteurs, région par région (nombre de zones du Dashboard).
  const all: Candidate[] = REGION_STATS.flatMap((r) => pickRegionZones(r.slug, r.zones))

  // 2. Niveau de risque : rang national sur le score (4 critiques, 17 élevées, 28 moyennes, le reste faible).
  const byScore = [...all].sort((a, b) => b.score - a.score || a.region.localeCompare(b.region))
  const riskOf = new Map<Candidate, ZoneRisk>()
  byScore.forEach((c, idx) => riskOf.set(c, idx < 4 ? 'critique' : idx < 21 ? 'eleve' : idx < 49 ? 'moyen' : 'faible'))

  // 3. Statuts : « À valider » par région = zonesEnAttente du Dashboard (les plus actives récemment).
  const statutOf = new Map<Candidate, ZoneStatut>()
  // Une zone à décider doit avoir été identifiée récemment : on prend d'abord celles dont la règle est satisfaite sur les derniers jours.
  const late = (c: Candidate, lo: number) => (eligibleDays(c.days, lo, SERIES_DAYS - 1).length > 0 ? 1 : 0)
  const byRecent = (a: Candidate, b: Candidate) => late(b, 60) - late(a, 60) || b.recent - a.recent || b.score - a.score
  for (const r of REGION_STATS) {
    const list = all.filter((c) => c.region === r.slug).sort(byRecent)
    list.slice(0, r.zonesEnAttente).forEach((c) => statutOf.set(c, 'a_valider'))
  }
  for (const slug of ['thies', 'saint_louis']) {
    const c = all.filter((x) => x.region === slug && !statutOf.has(x)).sort(byRecent)[0]
    if (c) statutOf.set(c, 'a_analyser')
  }
  const rejected = all.filter((c) => !statutOf.has(c)).sort((a, b) => a.score - b.score)[0]
  if (rejected) statutOf.set(rejected, 'rejetee')
  for (const c of all) if (!statutOf.has(c)) statutOf.set(c, 'validee')

  // 4. Dates : une zone à décider est identifiée récemment ; l'identification tombe un jour où la règle est satisfaite.
  const pickDay = (c: Candidate, lo: number, hi: number): number => {
    const inRange = eligibleDays(c.days, lo, hi)
    if (inRange.length > 0) return inRange[int(0, inRange.length - 1)]
    const all = eligibleDays(c.days, 0, SERIES_DAYS - 1)
    return [...all].sort((a, b) => Math.abs(a - hi) - Math.abs(b - hi) || a - b)[0]
  }
  const staged = all.map((c) => {
    const statut = statutOf.get(c)!
    let identDay: number
    let decisionDay: number | null = null
    if (statut === 'a_valider') identDay = pickDay(c, 60, SERIES_DAYS - 1)
    else if (statut === 'a_analyser') identDay = pickDay(c, 72, SERIES_DAYS - 1)
    else if (statut === 'rejetee') {
      identDay = pickDay(c, 15, 55)
      decisionDay = Math.min(SERIES_DAYS - 1, identDay + int(3, 10))
    } else {
      identDay = pickDay(c, 0, 75)
      decisionDay = Math.min(SERIES_DAYS - 1, identDay + int(2, 14))
    }
    return { c, statut, identDay, decisionDay }
  })
  staged.sort((a, b) => a.identDay - b.identDay || a.c.region.localeCompare(b.c.region) || b.c.score - a.c.score)

  return staged.map(({ c, statut, identDay, decisionDay }, idx) => ({
    id: `ZN-${String(idx + 1).padStart(5, '0')}`,
    num: idx + 1,
    region: c.region,
    locality: c.locality,
    lat: c.lat,
    lng: c.lng,
    risk: riskOf.get(c)!,
    score: c.score,
    statut,
    obsStartDay: Math.max(0, identDay - (ZONE_WINDOW_DAYS - 1)),
    identDay,
    decisionDay,
    rejectReason: statut === 'rejetee' ? REJECT_REASONS[idx % REJECT_REASONS.length] : null,
  }))
}

export const INITIAL_ZONES: Zone[] = build()

/* ------------------------------------------------------------------ */
/* Événements, comptages et analyse                                    */
/* ------------------------------------------------------------------ */

export interface ZoneEvents {
  incidents: Incident[]
  signalements: Signalement[]
}

const eventsCache = new Map<string, ZoneEvents>()

/** Tous les événements (90 jours) à moins de 500 m de la zone : incidents, et signalements non rejetés. */
export function zoneEvents(z: Zone): ZoneEvents {
  let hit = eventsCache.get(z.id)
  if (!hit) {
    const key = (e: { day: number; minute: number }) => e.day * 1440 + e.minute
    hit = {
      incidents: within(incidentsByRegion.get(z.region), z.lat, z.lng).sort((a, b) => key(b) - key(a)),
      signalements: within(sigsByRegion.get(z.region), z.lat, z.lng).sort((a, b) => key(b) - key(a)),
    }
    eventsCache.set(z.id, hit)
  }
  return hit
}

/** Nombre d'incidents et de signalements dans la fenêtre [start, end[ (indices de jours). */
export function zoneCounts(z: Zone, start: number, end: number): { incidents: number; signalements: number } {
  const ev = zoneEvents(z)
  return {
    incidents: ev.incidents.filter((i) => i.day >= start && i.day < end).length,
    signalements: ev.signalements.filter((s) => s.day >= start && s.day < end).length,
  }
}

/** Événements qui ont conduit à l'identification : ceux de la période d'observation (30 jours avant l'identification). */
export function identifyingEvents(z: Zone): ZoneEvents {
  const ev = zoneEvents(z)
  return {
    incidents: ev.incidents.filter((i) => i.day >= z.obsStartDay && i.day <= z.identDay),
    signalements: ev.signalements.filter((s) => s.day >= z.obsStartDay && s.day <= z.identDay),
  }
}

export interface ZoneAnalysis {
  weekly: { label: string; start: number; end: number; incidents: number; signalements: number }[]
  /** Indice de la semaine qui contient le jour d'identification. */
  identWeek: number
  byType: { label: string; count: number }[]
  byGravite: Record<Gravite, number>
  byMoment: { label: string; count: number }[]
  recent: number
  previous: number
  /** Évolution en % des incidents (30 derniers jours vs 30 précédents), null s'il n'y avait rien avant. */
  trendPct: number | null
  peak: string
  totalIncidents: number
  totalSignalements: number
}

const analysisCache = new Map<string, ZoneAnalysis>()

const WEEKS = 13

/** Statistiques associées à une zone : évolution hebdomadaire, répartitions, tendance. */
export function zoneAnalysis(z: Zone): ZoneAnalysis {
  let hit = analysisCache.get(z.id)
  if (hit) return hit
  const ev = zoneEvents(z)
  const weekly = Array.from({ length: WEEKS }, (_, w) => {
    const end = SERIES_DAYS - 1 - 7 * (WEEKS - 1 - w)
    const start = Math.max(0, end - 6)
    return {
      label: dayLabel(start),
      start,
      end,
      incidents: ev.incidents.filter((i) => i.day >= start && i.day <= end).length,
      signalements: ev.signalements.filter((s) => s.day >= start && s.day <= end).length,
    }
  })
  const identWeek = Math.max(0, weekly.findIndex((w) => z.identDay >= w.start && z.identDay <= w.end))

  const typeCounts = new Map<string, number>()
  for (const i of ev.incidents) typeCounts.set(i.type, (typeCounts.get(i.type) ?? 0) + 1)
  const byType = INCIDENT_TYPES.map((t) => ({ label: t as string, count: typeCounts.get(t) ?? 0 }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count)

  const byGravite: Record<Gravite, number> = { critique: 0, elevee: 0, moyenne: 0, faible: 0 }
  for (const i of ev.incidents) byGravite[i.gravite]++

  const moments = [
    { label: 'Nuit (0 h – 6 h)', count: 0 },
    { label: 'Matin (6 h – 12 h)', count: 0 },
    { label: 'Après-midi (12 h – 18 h)', count: 0 },
    { label: 'Soir (18 h – 24 h)', count: 0 },
  ]
  for (const e of [...ev.incidents, ...ev.signalements]) moments[Math.floor(e.minute / 360)].count++
  const peak = [...moments].sort((a, b) => b.count - a.count)[0].label

  const recent = ev.incidents.filter((i) => i.day >= SERIES_DAYS - RECENT_DAYS).length
  const previous = ev.incidents.filter((i) => i.day >= SERIES_DAYS - 2 * RECENT_DAYS && i.day < SERIES_DAYS - RECENT_DAYS).length
  const trendPct = previous === 0 ? null : Math.round(((recent - previous) / previous) * 100)

  hit = {
    weekly,
    identWeek,
    byType,
    byGravite,
    byMoment: moments,
    recent,
    previous,
    trendPct,
    peak,
    totalIncidents: ev.incidents.length,
    totalSignalements: ev.signalements.length,
  }
  analysisCache.set(z.id, hit)
  return hit
}

/** Historique initial d'une zone (les actions faites dans la page s'y ajoutent). */
export function zoneBaseHistory(z: Zone): ZoneHistoryItem[] {
  const id = identifyingEvents(z)
  const n = id.incidents.length + id.signalements.length
  const at = (day: number, h: number, m: number) => `${dayLabel(day)} ${p2(h)}:${p2(m)}`
  const region = REGION_STATS.find((r) => r.slug === z.region)?.label ?? z.region
  const items: ZoneHistoryItem[] = [
    {
      at: at(z.identDay, 6, 0),
      text: `Zone identifiée par l'analyse : ${n} événements (${id.incidents.length} incident${id.incidents.length > 1 ? 's' : ''}, ${id.signalements.length} signalement${id.signalements.length > 1 ? 's' : ''}) dans un rayon de ${ZONE_RADIUS_M} m en ${ZONE_WINDOW_DAYS} jours.`,
    },
  ]
  if (z.statut === 'a_analyser') items.push({ at: at(z.identDay, 9, 30), text: 'Données complémentaires demandées avant décision.' })
  if (z.statut === 'a_valider') items.push({ at: at(z.identDay, 9, 30), text: `Transmise à l'administrateur régional ${region} pour décision.` })
  if (z.statut === 'validee' && z.decisionDay !== null) {
    items.push({ at: at(z.identDay, 9, 30), text: `Transmise à l'administrateur régional ${region} pour décision.` })
    items.push({ at: at(z.decisionDay, 11, 15), text: `Validée par l'administrateur régional ${region}.` })
  }
  if (z.statut === 'rejetee' && z.decisionDay !== null) {
    items.push({ at: at(z.identDay, 9, 30), text: `Transmise à l'administrateur régional ${region} pour décision.` })
    items.push({ at: at(z.decisionDay, 14, 5), text: `Rejetée par l'administrateur régional ${region}. Motif : « ${z.rejectReason} »` })
  }
  return items
}
