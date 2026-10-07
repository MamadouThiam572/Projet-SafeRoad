/**
 * Données de la page Super Admin → Incidents (vue nationale des événements
 * routiers détectés par les boîtiers SafeRoad).
 *
 * Les incidents sont générés de façon déterministe (pas de hasard à
 * l'exécution) À PARTIR des séries journalières du Dashboard national
 * (`REGION_SERIES[région].incidents`) : pour chaque région et chaque jour, il y
 * a exactement autant d'incidents que dans le Dashboard. Les totaux recoupent
 * donc ceux du Dashboard pour toute période choisie, par exemple 3 482
 * incidents sur les 30 derniers jours.
 *
 * Sur ces 30 jours (vue par défaut), les compteurs sont exactement ceux de la
 * maquette : 426 critiques, 138 en cours, 2 918 validés.
 *
 * Chaque incident est rattaché à un boîtier ACTIF et AFFECTÉ de sa région
 * (donc à un conducteur et à un véhicule) tirés de la page Boîtiers.
 *
 * TODO backend : remplacer par la liste paginée des incidents (filtres région /
 * période / type / gravité / statut / localité) et par les endpoints de
 * consultation du détail, de changement de statut et d'ajout d'observation.
 */

import { INITIAL_BOITIERS, INITIAL_CONDUCTEURS, type Boitier, type Conducteur } from '@/data/superAdminBoitiers'
import { RECENT_DAYS, REGION_SERIES, REGION_STATS, SERIES_DATES, SERIES_DAYS } from '@/data/superAdminHome'

export type Gravite = 'critique' | 'elevee' | 'moyenne' | 'faible'
export type Statut = 'nouveau' | 'en_cours' | 'valide' | 'cloture'

export const INCIDENT_TYPES = [
  'Excès de vitesse',
  "Freinage d'urgence",
  'Accélération brusque',
  'Secousse dangereuse',
  'Nid-de-poule',
  'Route dégradée',
  'Choc détecté',
] as const
export type IncidentType = (typeof INCIDENT_TYPES)[number]

export interface Incident {
  /** « INC-00248 » */
  id: string
  /** Numéro chronologique (1 = le plus ancien). */
  num: number
  /** Slug de région. */
  region: string
  locality: string
  type: IncidentType
  gravite: Gravite
  /** Statut initial (les modifications faites dans la page sont locales). */
  statut: Statut
  /** Indice dans SERIES_DATES (0 = plus ancien, 89 = dernier jour). */
  day: number
  /** Minute de la journée (0–1439). */
  minute: number
  lat: number
  lng: number
  boitierId: string
  conducteurId: string
  /** km/h */
  vitesseGps: number
  vitesseRadar: number
}

export const GRAVITE_ORDER: Gravite[] = ['critique', 'elevee', 'moyenne', 'faible']

export const GRAVITE_META: Record<Gravite, { label: string; color: string; soft: string; text: string; icon: string }> = {
  critique: { label: 'Critique', color: '#dc3a2f', soft: '#fdeeec', text: '#c4281d', icon: 'error' },
  elevee: { label: 'Élevée', color: '#e8940c', soft: '#fdf4e6', text: '#b86e00', icon: 'warning' },
  moyenne: { label: 'Moyenne', color: '#d9a40c', soft: '#fdf8e6', text: '#8a6d02', icon: 'info' },
  faible: { label: 'Faible', color: '#1f9d55', soft: '#e9f6ee', text: '#1a8248', icon: 'check_circle' },
}

export const STATUT_ORDER: Statut[] = ['nouveau', 'en_cours', 'valide', 'cloture']

export const STATUT_META: Record<Statut, { label: string; soft: string; text: string; icon: string; hint: string }> = {
  nouveau: { label: 'Nouveau', soft: '#f1eafe', text: '#6d28d9', icon: 'fiber_new', hint: 'Détecté, pas encore pris en charge.' },
  en_cours: { label: 'En cours', soft: '#e8f0f9', text: '#2b6cb0', icon: 'pending', hint: 'Pris en charge, en cours de suivi.' },
  valide: { label: 'Validé', soft: '#e9f6ee', text: '#1a8248', icon: 'verified', hint: 'Événement confirmé.' },
  cloture: { label: 'Clôturé', soft: '#eef2f5', text: '#5b6b78', icon: 'task_alt', hint: 'Traité, plus aucune action attendue.' },
}

export const TYPE_ICON: Record<IncidentType, string> = {
  'Excès de vitesse': 'speed',
  "Freinage d'urgence": 'front_hand',
  'Accélération brusque': 'moving',
  'Secousse dangereuse': 'waves',
  'Nid-de-poule': 'circle',
  'Route dégradée': 'edit_road',
  'Choc détecté': 'car_crash',
}

/** Un incident nécessite une attention particulière : critique et pas encore traité. */
export const needsAttention = (gravite: Gravite, statut: Statut) => gravite === 'critique' && (statut === 'nouveau' || statut === 'en_cours')

/* ------------------------------------------------------------------ */
/* Localités (coordonnées approximatives, démonstration)               */
/* ------------------------------------------------------------------ */

export interface Locality {
  name: string
  lat: number
  lng: number
  /** Poids de tirage : le chef-lieu concentre davantage d'incidents. */
  w: number
}

export const LOCALITIES: Record<string, Locality[]> = {
  dakar: [
    { name: 'Mermoz', lat: 14.7071, lng: -17.4725, w: 3 },
    { name: 'Parcelles Assainies', lat: 14.76, lng: -17.44, w: 3 },
    { name: 'Pikine', lat: 14.7549, lng: -17.3908, w: 3 },
    { name: 'Guédiawaye', lat: 14.7694, lng: -17.3989, w: 2 },
    { name: 'Plateau', lat: 14.6692, lng: -17.4338, w: 2 },
    { name: 'Almadies', lat: 14.7437, lng: -17.5122, w: 1 },
    { name: 'Rufisque', lat: 14.7167, lng: -17.2667, w: 2 },
  ],
  thies: [
    { name: 'Thiès Ville', lat: 14.7886, lng: -16.9246, w: 4 },
    { name: 'Mbour', lat: 14.4198, lng: -16.964, w: 3 },
    { name: 'Tivaouane', lat: 14.9519, lng: -16.819, w: 1 },
    { name: 'Joal-Fadiouth', lat: 14.1667, lng: -16.8333, w: 1 },
  ],
  diourbel: [
    { name: 'Diourbel', lat: 14.6553, lng: -16.2336, w: 3 },
    { name: 'Touba', lat: 14.85, lng: -15.8833, w: 3 },
    { name: 'Mbacké', lat: 14.7903, lng: -15.9083, w: 2 },
    { name: 'Bambey', lat: 14.7, lng: -16.45, w: 1 },
  ],
  saint_louis: [
    { name: 'Saint-Louis', lat: 16.0179, lng: -16.4896, w: 4 },
    { name: 'Richard-Toll', lat: 16.4625, lng: -15.7006, w: 2 },
    { name: 'Dagana', lat: 16.5167, lng: -15.5, w: 1 },
    { name: 'Podor', lat: 16.65, lng: -14.9667, w: 1 },
  ],
  louga: [
    { name: 'Louga', lat: 15.6144, lng: -16.2247, w: 4 },
    { name: 'Linguère', lat: 15.3944, lng: -15.1181, w: 1 },
    { name: 'Kébémer', lat: 15.3667, lng: -16.45, w: 1 },
  ],
  kaolack: [
    { name: 'Kaolack', lat: 14.1652, lng: -16.0753, w: 4 },
    { name: 'Guinguinéo', lat: 14.2667, lng: -15.95, w: 1 },
    { name: 'Nioro du Rip', lat: 13.75, lng: -15.8, w: 1 },
  ],
  ziguinchor: [
    { name: 'Ziguinchor', lat: 12.5833, lng: -16.2719, w: 4 },
    { name: 'Bignona', lat: 12.8095, lng: -16.2261, w: 2 },
    { name: 'Oussouye', lat: 12.4833, lng: -16.55, w: 1 },
  ],
  tambacounda: [
    { name: 'Tambacounda', lat: 13.7708, lng: -13.6673, w: 4 },
    { name: 'Goudiry', lat: 14.1833, lng: -12.7167, w: 1 },
    { name: 'Bakel', lat: 14.9, lng: -12.4667, w: 1 },
  ],
  fatick: [
    { name: 'Fatick', lat: 14.339, lng: -16.4111, w: 3 },
    { name: 'Gossas', lat: 14.4833, lng: -16.2667, w: 1 },
    { name: 'Foundiougne', lat: 14.1333, lng: -16.4667, w: 1 },
  ],
  kaffrine: [
    { name: 'Kaffrine', lat: 14.1059, lng: -15.5508, w: 3 },
    { name: 'Koungheul', lat: 13.9833, lng: -14.8, w: 1 },
  ],
  kedougou: [
    { name: 'Kédougou', lat: 12.5605, lng: -12.1747, w: 3 },
    { name: 'Saraya', lat: 12.85, lng: -11.7667, w: 1 },
  ],
  kolda: [
    { name: 'Kolda', lat: 12.8939, lng: -14.9406, w: 3 },
    { name: 'Vélingara', lat: 13.15, lng: -14.1167, w: 1 },
  ],
  matam: [
    { name: 'Matam', lat: 15.6559, lng: -13.2554, w: 3 },
    { name: 'Kanel', lat: 15.4833, lng: -13.1667, w: 1 },
  ],
  sedhiou: [
    { name: 'Sédhiou', lat: 12.7081, lng: -15.5569, w: 3 },
    { name: 'Bounkiling', lat: 13.0333, lng: -15.6833, w: 1 },
  ],
}

/** Localités de chaque région, pour le filtre « Localité ». */
export const LOCALITY_NAMES: Record<string, string[]> = Object.fromEntries(
  Object.entries(LOCALITIES).map(([slug, list]) => [slug, list.map((l) => l.name)]),
)

/* ------------------------------------------------------------------ */
/* Génération déterministe                                             */
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

const rnd = mulberry32(20261006)
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1))

function weighted<T>(items: T[], weight: (t: T) => number): T {
  const total = items.reduce((s, it) => s + weight(it), 0)
  let r = rnd() * total
  for (const it of items) {
    r -= weight(it)
    if (r <= 0) return it
  }
  return items[items.length - 1]
}

const TYPE_WEIGHT: Record<IncidentType, number> = {
  'Excès de vitesse': 28,
  "Freinage d'urgence": 20,
  'Accélération brusque': 14,
  'Secousse dangereuse': 12,
  'Nid-de-poule': 10,
  'Route dégradée': 9,
  'Choc détecté': 7,
}

/** Gravité « de base » d'un type : sert à corréler type et gravité. */
const TYPE_SEVERITY: Record<IncidentType, number> = {
  'Excès de vitesse': 0.55,
  "Freinage d'urgence": 0.6,
  'Accélération brusque': 0.45,
  'Secousse dangereuse': 0.4,
  'Nid-de-poule': 0.2,
  'Route dégradée': 0.15,
  'Choc détecté': 0.9,
}

/** Poids par heure : pointes du matin et du soir. */
const HOUR_WEIGHT = [1, 1, 1, 1, 2, 3, 6, 9, 9, 7, 6, 6, 7, 7, 6, 7, 8, 10, 10, 8, 5, 3, 2, 1]

/** Part de chaque gravité (hors critiques, dont le nombre est imposé). */
const SHARE_ELEVEE = 0.22
const SHARE_MOYENNE = 0.38

/** Compteurs imposés sur les 30 derniers jours (maquette). */
const RECENT_CRITIQUES = 426
const RECENT_NOUVEAUX = 87
const RECENT_EN_COURS = 138
const RECENT_CLOTURES = 339

interface Stub {
  region: string
  day: number
  minute: number
  locality: Locality
  type: IncidentType
  score: number
  gravite: Gravite
  statut: Statut
}

function build(): Incident[] {
  // 1. Un « stub » par incident, selon les séries journalières du Dashboard.
  const stubs: Stub[] = []
  for (const r of REGION_STATS) {
    const list = LOCALITIES[r.slug]
    const series = REGION_SERIES[r.slug].incidents
    for (let day = 0; day < SERIES_DAYS; day++) {
      for (let k = 0; k < series[day]; k++) {
        const hour = weighted(HOUR_WEIGHT.map((w, h) => ({ w, h })), (x) => x.w).h
        const type = weighted([...INCIDENT_TYPES], (t) => TYPE_WEIGHT[t])
        stubs.push({
          region: r.slug,
          day,
          minute: hour * 60 + int(0, 59),
          locality: weighted(list, (l) => l.w),
          type,
          score: TYPE_SEVERITY[type] + rnd() * 0.6,
          gravite: 'faible',
          statut: 'valide',
        })
      }
    }
  }

  // 2. Ordre chronologique : le numéro de référence suit le temps.
  stubs.sort((a, b) => a.day - b.day || a.minute - b.minute)

  // 3. Gravité : corrélée au type, avec un nombre de critiques imposé sur les 30 derniers jours.
  const recentStart = SERIES_DAYS - RECENT_DAYS
  const recent = stubs.filter((s) => s.day >= recentStart)
  const older = stubs.filter((s) => s.day < recentStart)
  const grade = (group: Stub[], critiques: number) => {
    const byScore = [...group].sort((a, b) => b.score - a.score)
    const nElevee = Math.round(group.length * SHARE_ELEVEE)
    const nMoyenne = Math.round(group.length * SHARE_MOYENNE)
    byScore.forEach((s, i) => {
      s.gravite =
        i < critiques ? 'critique' : i < critiques + nElevee ? 'elevee' : i < critiques + nElevee + nMoyenne ? 'moyenne' : 'faible'
    })
  }
  grade(recent, Math.min(RECENT_CRITIQUES, recent.length))
  grade(older, Math.round(older.length * 0.122))

  // 4. Statut : les plus récents sont « nouveaux » puis « en cours » ; le reste est traité.
  const newestFirst = [...recent].reverse()
  const resolved = newestFirst.slice(RECENT_NOUVEAUX + RECENT_EN_COURS)
  const order = resolved.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  const closed = new Set(order.slice(0, Math.min(RECENT_CLOTURES, resolved.length)))
  newestFirst.forEach((s, i) => {
    if (i < RECENT_NOUVEAUX) s.statut = 'nouveau'
    else if (i < RECENT_NOUVEAUX + RECENT_EN_COURS) s.statut = 'en_cours'
    else s.statut = closed.has(i - RECENT_NOUVEAUX - RECENT_EN_COURS) ? 'cloture' : 'valide'
  })
  for (const s of older) s.statut = rnd() < 0.88 ? 'valide' : 'cloture'

  // 5. Boîtier détecteur (actif et affecté, de la région), conducteur, position, vitesses.
  const pool = new Map<string, Boitier[]>()
  for (const r of REGION_STATS) {
    const assigned = INITIAL_BOITIERS.filter((b) => b.region === r.slug && b.conducteurId)
    const active = assigned.filter((b) => b.status === 'actif')
    pool.set(r.slug, active.length > 0 ? active : assigned)
  }

  return stubs.map((s, i): Incident => {
    const boitier = pool.get(s.region)![int(0, pool.get(s.region)!.length - 1)]
    const speeding = s.type === 'Excès de vitesse'
    const gps = speeding ? int(85, 135) : int(18, 82)
    return {
      id: `INC-${String(i + 1).padStart(5, '0')}`,
      num: i + 1,
      region: s.region,
      locality: s.locality.name,
      type: s.type,
      gravite: s.gravite,
      statut: s.statut,
      day: s.day,
      minute: s.minute,
      lat: Math.round((s.locality.lat + (rnd() - 0.5) * 0.024) * 1e5) / 1e5,
      lng: Math.round((s.locality.lng + (rnd() - 0.5) * 0.024) * 1e5) / 1e5,
      boitierId: boitier.id,
      conducteurId: boitier.conducteurId!,
      vitesseGps: gps,
      vitesseRadar: Math.max(0, gps + int(-4, 2)),
    }
  })
}

export const INITIAL_INCIDENTS: Incident[] = build()

/* ------------------------------------------------------------------ */
/* Aides d'affichage                                                   */
/* ------------------------------------------------------------------ */

const p2 = (n: number) => String(n).padStart(2, '0')

/** JJ/MM/AAAA */
export const incidentDate = (i: Pick<Incident, 'day'>) => {
  const iso = SERIES_DATES[i.day]
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

/** HH:mm */
export const incidentTime = (i: Pick<Incident, 'minute'>) => `${p2(Math.floor(i.minute / 60))}:${p2(i.minute % 60)}`

export const driverById: Map<string, Conducteur> = new Map(INITIAL_CONDUCTEURS.map((c) => [c.id, c]))

function hash(s: string): number {
  let h = 2166136261
  for (let k = 0; k < s.length; k++) {
    h ^= s.charCodeAt(k)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const MODELS = ['Toyota Hilux', 'Toyota Corolla', 'Peugeot 308', 'Renault Duster', 'Hyundai i10', 'Nissan Qashqai', 'Kia Picanto', 'Mercedes Sprinter', 'Dacia Logan', 'Ford Transit']

/** Téléphone et modèle de véhicule du conducteur (dérivés de son identifiant : stables, fictifs). */
export function driverExtras(conducteurId: string): { phone: string; model: string } {
  const h = hash(conducteurId)
  const prefix = ['77', '78', '76', '70', '75'][h % 5]
  const n = (h >>> 3) % 10_000_000
  const d = String(n).padStart(7, '0')
  return { phone: `+221 ${prefix} ${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 7)}`, model: MODELS[(h >>> 7) % MODELS.length] }
}

export interface HistoryItem {
  /** HH:mm (ou JJ/MM HH:mm si un autre jour que l'incident). */
  at: string
  text: string
}

/** Chronologie initiale d'un incident, selon son statut d'origine. */
export function baseHistory(i: Incident): HistoryItem[] {
  const start = i.minute
  const stamp = (offset: number) => {
    const total = start + offset
    const dayShift = Math.floor(total / 1440)
    const m = ((total % 1440) + 1440) % 1440
    const hhmm = `${p2(Math.floor(m / 60))}:${p2(m % 60)}`
    if (dayShift === 0) return hhmm
    const d = SERIES_DATES[Math.min(i.day + dayShift, SERIES_DAYS - 1)]
    return `${d.slice(8, 10)}/${d.slice(5, 7)} ${hhmm}`
  }
  const o1 = 2 + (i.num % 4)
  const o2 = o1 + 2 + (i.num % 5)
  const o3 = o2 + 20 + (i.num % 35)
  const o4 = o3 + 5 + (i.num % 20)

  const items: HistoryItem[] = [{ at: stamp(0), text: `Incident détecté par ${i.boitierId}` }]
  if (i.statut === 'nouveau') return items
  items.push({ at: stamp(o1), text: "Consulté par l'administrateur régional" }, { at: stamp(o2), text: 'Statut → En cours' })
  if (i.statut === 'en_cours') return items
  items.push({ at: stamp(o3), text: 'Observation ajoutée' }, { at: stamp(o4), text: i.statut === 'valide' ? 'Statut → Validé' : 'Statut → Clôturé' })
  return items
}
