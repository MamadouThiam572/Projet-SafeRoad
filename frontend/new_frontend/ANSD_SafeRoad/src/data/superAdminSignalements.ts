/**
 * Données de la page Super Admin → Signalements.
 *
 * Un SIGNALEMENT est un danger ou un problème déclaré VOLONTAIREMENT par un
 * conducteur depuis son espace (à ne pas confondre avec un incident, détecté
 * automatiquement par le boîtier). Il n'est pas considéré comme un danger
 * confirmé tant qu'il n'a pas été vérifié.
 *
 * Les signalements sont générés de façon déterministe à partir des séries
 * journalières du Dashboard national (`REGION_SERIES[région].signalements`) :
 * mêmes totaux que le Dashboard pour une même région et une même période
 * (864 sur les 30 derniers jours). Sur ces 30 jours :
 *   - « À vérifier » = « Signalements en attente » du Dashboard (18, par région) ;
 *   - 58 en cours de vérification et 682 validés (maquette) ;
 *   - les 106 restants sont rejetés (la maquette n'en montrait aucun).
 *
 * Les « événements à proximité » sont de VRAIS incidents de la page Incidents
 * (même région, ±2 jours, dans un rayon de 400 m) : on peut les ouvrir là-bas.
 *
 * TODO backend : remplacer par la liste paginée des signalements (filtres
 * région / période / type / statut), le détail (description, conducteur),
 * la recherche d'événements à proximité et le changement de statut.
 */

import { INITIAL_BOITIERS, INITIAL_CONDUCTEURS } from '@/data/superAdminBoitiers'
import { RECENT_DAYS, REGION_SERIES, REGION_STATS, SERIES_DATES, SERIES_DAYS } from '@/data/superAdminHome'
import { INITIAL_INCIDENTS, LOCALITIES, type Incident } from '@/data/superAdminIncidents'

export type DangerType = 'nid_de_poule' | 'chaussee_degradee' | 'signalisation_absente' | 'chaussee_inondee' | 'obstacle' | 'autre'
export type SigStatut = 'a_verifier' | 'en_verification' | 'valide' | 'rejete'
export type Correspondance = 'constatee' | 'complementaire' | 'aucune'

export const DANGER_ORDER: DangerType[] = ['nid_de_poule', 'chaussee_degradee', 'signalisation_absente', 'chaussee_inondee', 'obstacle', 'autre']

export const DANGER_META: Record<DangerType, { label: string; icon: string; tint: string; soft: string }> = {
  nid_de_poule: { label: 'Nid-de-poule', icon: 'warning', tint: '#e8940c', soft: '#fdf4e6' },
  chaussee_degradee: { label: 'Chaussée dégradée', icon: 'edit_road', tint: '#dc3a2f', soft: '#fdeeec' },
  signalisation_absente: { label: 'Signalisation absente', icon: 'no_crash', tint: '#7c3aed', soft: '#f1eafe' },
  chaussee_inondee: { label: 'Chaussée inondée', icon: 'water_drop', tint: '#2b6cb0', soft: '#e8f0f9' },
  obstacle: { label: 'Obstacle', icon: 'block', tint: '#0e7490', soft: '#e0f2f7' },
  autre: { label: 'Autre', icon: 'help', tint: '#64748b', soft: '#f1f5f9' },
}

export const SIG_STATUT_ORDER: SigStatut[] = ['a_verifier', 'en_verification', 'valide', 'rejete']

export const SIG_STATUT_META: Record<SigStatut, { label: string; icon: string; color: string; soft: string; text: string; hint: string }> = {
  a_verifier: { label: 'À vérifier', icon: 'schedule', color: '#e8940c', soft: '#fdf4e6', text: '#b86e00', hint: 'Reçu, pas encore pris en charge.' },
  en_verification: { label: 'En vérification', icon: 'search', color: '#7c3aed', soft: '#f1eafe', text: '#6d28d9', hint: "Pris en charge : l'équipe recoupe avec les données SafeRoad." },
  valide: { label: 'Validé', icon: 'check_circle', color: '#1f9d55', soft: '#e9f6ee', text: '#1a8248', hint: 'Danger confirmé après vérification.' },
  rejete: { label: 'Rejeté', icon: 'cancel', color: '#dc3a2f', soft: '#fdeeec', text: '#c4281d', hint: 'Non retenu (doublon, information insuffisante, danger non constaté…).' },
}

export const CORRESPONDANCE_META: Record<Correspondance, { label: string; icon: string; cls: string }> = {
  constatee: { label: 'Correspondance constatée', icon: 'check_circle', cls: 'bg-success-50 text-success-600' },
  complementaire: { label: 'Vérification complémentaire nécessaire', icon: 'help', cls: 'bg-warning-50 text-warning-600' },
  aucune: { label: 'Aucune correspondance', icon: 'remove_circle', cls: 'bg-[#eef2f5] text-body' },
}

export interface Signalement {
  /** « SIG-00452 » */
  id: string
  /** Numéro chronologique (1 = le plus ancien). */
  num: number
  region: string
  locality: string
  type: DangerType
  /** Statut initial (les modifications faites dans la page sont locales). */
  statut: SigStatut
  /** Indice dans SERIES_DATES (0 = plus ancien, 89 = dernier jour). */
  day: number
  /** Minute de la journée (0–1439). */
  minute: number
  lat: number
  lng: number
  conducteurId: string
  /** Boîtier du conducteur, s'il en a un. */
  boitierId: string | null
  description: string
}

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

const rnd = mulberry32(20261007)
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

/** Répartit `total` selon `weights` en entiers dont la somme vaut exactement `total`. */
function distribute(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0)
  if (sum === 0) return weights.map(() => 0)
  const raw = weights.map((w) => (total * w) / sum)
  const floors = raw.map(Math.floor)
  let remainder = total - floors.reduce((a, b) => a + b, 0)
  const order = raw.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac)
  for (let k = 0; remainder > 0; k = (k + 1) % order.length, remainder--) floors[order[k].i] += 1
  return floors
}

/** Poids des types (proportions de la maquette). */
const TYPE_WEIGHT: Record<DangerType, number> = {
  nid_de_poule: 238,
  chaussee_degradee: 176,
  signalisation_absente: 92,
  chaussee_inondee: 64,
  obstacle: 58,
  autre: 36,
}

/** Les conducteurs signalent plutôt en journée. */
const HOUR_WEIGHT = [0, 0, 0, 0, 0, 1, 3, 6, 8, 8, 8, 7, 7, 6, 6, 7, 8, 9, 8, 6, 4, 2, 1, 0]

const DESCRIPTIONS: Record<DangerType, string[]> = {
  nid_de_poule: [
    "Gros nid-de-poule au milieu de la voie, dangereux surtout pour les deux-roues.",
    "Plusieurs nids-de-poule successifs, les véhicules doivent zigzaguer pour les éviter.",
    "Nid-de-poule profond après les dernières pluies, j'ai failli abîmer ma roue.",
  ],
  chaussee_degradee: [
    "Revêtement très abîmé sur plusieurs dizaines de mètres, la route se désagrège.",
    "Bord de chaussée effondré, la voie se rétrécit dangereusement.",
    "Chaussée fissurée et déformée, les secousses sont fortes à vitesse normale.",
  ],
  signalisation_absente: [
    "Panneau de limitation de vitesse arraché, plus aucune indication à cet endroit.",
    "Feu tricolore éteint au carrefour, la circulation devient dangereuse.",
    "Marquage au sol effacé au rond-point, les usagers ne savent plus qui est prioritaire.",
  ],
  chaussee_inondee: [
    "Chaussée envahie par l'eau après la pluie, visibilité très réduite.",
    "Grande flaque qui bloque une voie, certains conducteurs la contournent à contresens.",
    "Eau stagnante sur toute la largeur de la route, risque d'aquaplaning.",
  ],
  obstacle: [
    "Véhicule en panne laissé sur la voie sans signalisation.",
    "Gros objet tombé d'un camion au milieu de la chaussée.",
    "Étal de marché débordant sur la route, la voie est à moitié bloquée.",
  ],
  autre: [
    "Danger difficile à classer : circulation anarchique à cet endroit.",
    "Passage piéton très fréquenté sans aucune protection.",
    "Animaux errants sur la route à la tombée de la nuit.",
  ],
}

const REJECT_REASONS = ['Doublon d\'un signalement déjà traité', 'Informations insuffisantes pour confirmer le danger', 'Danger non constaté sur place']

const boitierOfDriver = new Map<string, string>()
for (const b of INITIAL_BOITIERS) if (b.conducteurId) boitierOfDriver.set(b.conducteurId, b.id)

function build(): Signalement[] {
  // 1. Un « stub » par signalement, selon les séries journalières du Dashboard.
  interface Stub {
    region: string
    day: number
    minute: number
    statut: SigStatut
  }
  const stubs: Stub[] = []
  for (const r of REGION_STATS) {
    const series = REGION_SERIES[r.slug].signalements
    for (let day = 0; day < SERIES_DAYS; day++) {
      for (let k = 0; k < series[day]; k++) {
        const hour = weighted(HOUR_WEIGHT.map((w, h) => ({ w, h })), (x) => x.w).h
        stubs.push({ region: r.slug, day, minute: hour * 60 + int(0, 59), statut: 'valide' })
      }
    }
  }

  // 2. Statuts des 30 derniers jours, région par région.
  const recentStart = SERIES_DAYS - RECENT_DAYS
  const recentByRegion = REGION_STATS.map((r) => stubs.filter((s) => s.region === r.slug && s.day >= recentStart).sort((a, b) => b.day - a.day || b.minute - a.minute))
  const EN_VERIFICATION_TOTAL = 58
  const VALIDES_TOTAL = 682
  const pend = REGION_STATS.map((r, i) => Math.min(r.signalementsEnAttente, recentByRegion[i].length))
  const enVerif = distribute(EN_VERIFICATION_TOTAL, recentByRegion.map((g, i) => g.length - pend[i]))
  const remaining = recentByRegion.map((g, i) => Math.max(0, g.length - pend[i] - enVerif[i]))
  const valides = distribute(Math.min(VALIDES_TOTAL, remaining.reduce((a, b) => a + b, 0)), remaining)
  recentByRegion.forEach((group, i) => {
    const rejetes = remaining[i] - valides[i]
    // Les rejets sont répartis au hasard parmi les signalements déjà traités.
    const resolved = group.slice(pend[i] + enVerif[i])
    const order = resolved.map((_, k) => k)
    for (let k = order.length - 1; k > 0; k--) {
      const j = Math.floor(rnd() * (k + 1))
      ;[order[k], order[j]] = [order[j], order[k]]
    }
    const rejected = new Set(order.slice(0, rejetes))
    group.forEach((s, k) => {
      if (k < pend[i]) s.statut = 'a_verifier'
      else if (k < pend[i] + enVerif[i]) s.statut = 'en_verification'
      else s.statut = rejected.has(k - pend[i] - enVerif[i]) ? 'rejete' : 'valide'
    })
  })
  // Avant : tout est déjà traité.
  for (const s of stubs) if (s.day < recentStart) s.statut = rnd() < 0.87 ? 'valide' : 'rejete'

  // 3. Ordre chronologique : le numéro de référence suit le temps.
  stubs.sort((a, b) => a.day - b.day || a.minute - b.minute)

  // 4. Détails : type, localité, conducteur de la région, position.
  const driversOf = new Map<string, typeof INITIAL_CONDUCTEURS>()
  for (const r of REGION_STATS) driversOf.set(r.slug, INITIAL_CONDUCTEURS.filter((c) => c.region === r.slug))

  return stubs.map((s, i): Signalement => {
    const type = weighted(DANGER_ORDER, (t) => TYPE_WEIGHT[t])
    const loc = weighted(LOCALITIES[s.region], (l) => l.w)
    const list = driversOf.get(s.region)!
    const driver = list[int(0, list.length - 1)]
    return {
      id: `SIG-${String(i + 1).padStart(5, '0')}`,
      num: i + 1,
      region: s.region,
      locality: loc.name,
      type,
      statut: s.statut,
      day: s.day,
      minute: s.minute,
      lat: Math.round((loc.lat + (rnd() - 0.5) * 0.024) * 1e5) / 1e5,
      lng: Math.round((loc.lng + (rnd() - 0.5) * 0.024) * 1e5) / 1e5,
      conducteurId: driver.id,
      boitierId: boitierOfDriver.get(driver.id) ?? null,
      description: DESCRIPTIONS[type][i % 3],
    }
  })
}

export const INITIAL_SIGNALEMENTS: Signalement[] = build()

/* ------------------------------------------------------------------ */
/* Aides d'affichage                                                   */
/* ------------------------------------------------------------------ */

const p2 = (n: number) => String(n).padStart(2, '0')

/** JJ/MM/AAAA */
export const sigDate = (s: Pick<Signalement, 'day'>) => {
  const iso = SERIES_DATES[s.day]
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

/** HH:mm */
export const sigTime = (s: Pick<Signalement, 'minute'>) => `${p2(Math.floor(s.minute / 60))}:${p2(s.minute % 60)}`

/* ------------------------------------------------------------------ */
/* Événements à proximité (vrais incidents de la page Incidents)        */
/* ------------------------------------------------------------------ */

export const NEARBY_RADIUS_M = 400
export const NEARBY_DAYS = 2

export interface NearbyIncident {
  incident: Incident
  distanceM: number
}

const incidentsByRegion = new Map<string, Incident[]>()
for (const i of INITIAL_INCIDENTS) {
  const list = incidentsByRegion.get(i.region)
  if (list) list.push(i)
  else incidentsByRegion.set(i.region, [i])
}

function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

const nearbyCache = new Map<string, NearbyIncident[]>()

/** Incidents de la même région, à ±NEARBY_DAYS jours et à moins de NEARBY_RADIUS_M mètres, du plus proche au plus éloigné. */
export function nearbyIncidents(s: Signalement): NearbyIncident[] {
  const hit = nearbyCache.get(s.id)
  if (hit) return hit
  const out: NearbyIncident[] = []
  for (const i of incidentsByRegion.get(s.region) ?? []) {
    if (Math.abs(i.day - s.day) > NEARBY_DAYS) continue
    const d = distanceM(s.lat, s.lng, i.lat, i.lng)
    if (d <= NEARBY_RADIUS_M) out.push({ incident: i, distanceM: Math.round(d) })
  }
  out.sort((a, b) => a.distanceM - b.distanceM)
  nearbyCache.set(s.id, out)
  return out
}

/** Types d'incidents qui confirment plutôt un type de danger signalé. */
const RELATED: Record<DangerType, string[]> = {
  nid_de_poule: ['Nid-de-poule', 'Secousse dangereuse'],
  chaussee_degradee: ['Route dégradée', 'Secousse dangereuse'],
  chaussee_inondee: ['Route dégradée', "Freinage d'urgence"],
  signalisation_absente: ["Freinage d'urgence", 'Choc détecté', 'Excès de vitesse'],
  obstacle: ["Freinage d'urgence", 'Choc détecté', 'Secousse dangereuse'],
  autre: [],
}

export function correspondanceOf(s: Signalement): Correspondance {
  const near = nearbyIncidents(s)
  if (near.some((n) => RELATED[s.type].includes(n.incident.type))) return 'constatee'
  return near.length > 0 ? 'complementaire' : 'aucune'
}

/* ------------------------------------------------------------------ */
/* Historique                                                          */
/* ------------------------------------------------------------------ */

export interface SigHistoryItem {
  /** HH:mm (ou JJ/MM HH:mm si un autre jour que le signalement). */
  at: string
  text: string
}

/** Chronologie initiale d'un signalement, selon son statut d'origine. */
export function baseHistory(s: Signalement): SigHistoryItem[] {
  const stamp = (offsetMin: number) => {
    const total = s.minute + offsetMin
    const dayShift = Math.floor(total / 1440)
    const m = total % 1440
    const hhmm = `${p2(Math.floor(m / 60))}:${p2(m % 60)}`
    if (dayShift === 0) return hhmm
    const d = SERIES_DATES[Math.min(s.day + dayShift, SERIES_DAYS - 1)]
    return `${d.slice(8, 10)}/${d.slice(5, 7)} ${hhmm}`
  }
  const o1 = 25 + (s.num % 90)
  const o2 = o1 + 15 + (s.num % 40)
  const items: SigHistoryItem[] = [{ at: stamp(0), text: "Signalement déclaré depuis l'espace conducteur" }]
  if (s.statut === 'a_verifier') return items
  items.push({ at: stamp(o1), text: "Pris en charge par l'administrateur régional" }, { at: stamp(o1 + 1), text: 'Statut → En vérification' })
  if (s.statut === 'en_verification') return items
  if (s.statut === 'valide') items.push({ at: stamp(o2), text: 'Événements à proximité consultés' }, { at: stamp(o2 + 6), text: 'Statut → Validé' })
  else items.push({ at: stamp(o2), text: `Motif : ${REJECT_REASONS[s.num % REJECT_REASONS.length]}` }, { at: stamp(o2 + 2), text: 'Statut → Rejeté' })
  return items
}
