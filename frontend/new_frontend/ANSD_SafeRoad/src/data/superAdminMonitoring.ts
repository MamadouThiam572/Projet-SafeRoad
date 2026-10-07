/**
 * Données de la page Super Admin → Monitoring IoT (supervision TECHNIQUE des
 * boîtiers : connexion, dernière communication, réseau, position reçue,
 * anomalies). Aucune donnée administrative ici (statut, affectation…) : elle
 * reste dans la page Boîtiers.
 *
 * Les 156 boîtiers sont les mêmes que ceux de la page Boîtiers
 * (SR-BOX-001…156, mêmes UUID, conducteurs et véhicules). Les chiffres
 * recoupent le Dashboard national :
 *   - 156 boîtiers supervisés ;
 *   - 5 boîtiers en anomalie, répartis par région comme `REGION_STATS.anomalies` ;
 *   - les 8 boîtiers désactivés administrativement ne communiquent plus.
 *
 * Tout est déterministe (pas de hasard à l'exécution). Les âges sont des
 * durées en secondes avant l'instant d'actualisation (« ancre ») choisi par la
 * page : un rafraîchissement re-ancre simplement les données.
 *
 * TODO backend : remplacer par l'endpoint de supervision (état de connexion,
 * dernier message reçu, réseau, dernières coordonnées, anomalies ouvertes),
 * idéalement en temps réel (WebSocket / SSE) plutôt qu'en interrogation.
 */

import { INITIAL_BOITIERS, INITIAL_CONDUCTEURS } from '@/data/superAdminBoitiers'
import { REGION_STATS } from '@/data/superAdminHome'
import { REGION_CENTERS } from '@/lib/regions'

export type Connexion = 'en_ligne' | 'hors_ligne'
export type Technique = 'normal' | 'anomalie'
export type Reseau = 'Wi-Fi' | 'GSM'
export type AnomalyKind = 'comm_intermittente' | 'donnees_retard' | 'batterie_faible' | 'gps_perdu' | 'alimentation'
export type AnomalyStatus = 'nouvelle' | 'en_cours'
export type SignalLevel = 'fort' | 'moyen' | 'faible'

export interface Anomaly {
  id: string
  boitierId: string
  kind: AnomalyKind
  status: AnomalyStatus
  /** Secondes écoulées depuis la détection (à l'ancre). */
  ageSec: number
}

export interface Monitored {
  id: string
  uuid: string
  /** Slug de région. */
  region: string
  /** Conducteur et véhicule rattachés (lecture seule : ils se gèrent dans Boîtiers). */
  conducteur: string | null
  plate: string | null
  connexion: Connexion
  technique: Technique
  reseau: Reseau
  /** Secondes depuis le dernier message reçu (à l'ancre). */
  ageSec: number
  lat: number
  lng: number
  /** km/h */
  vitesse: number
  evenement: string
  /** % */
  batterie: number
  /** dBm */
  signal: number
  /** Délai moyen de réception, en ms. */
  latenceMs: number
  /** Part des messages reçus sur 24 h, en %. */
  tauxReception: number
  /** Intervalle d'émission, en secondes. */
  intervalSec: number
  anomalies: Anomaly[]
}

export interface LogEntry {
  ageSec: number
  kind: 'recu' | 'retard' | 'coupure'
}

/** En dessous de ce délai sans message, un boîtier est considéré « en ligne ». */
export const ONLINE_THRESHOLD_SEC = 600

export const ANOMALY_META: Record<AnomalyKind, { label: string; icon: string; detail: string }> = {
  comm_intermittente: { label: 'Communication intermittente', icon: 'wifi_off', detail: 'Messages perdus par intermittence : signal instable.' },
  donnees_retard: { label: 'Données reçues avec retard', icon: 'schedule', detail: 'Les messages arrivent avec un délai anormal.' },
  batterie_faible: { label: 'Batterie faible', icon: 'battery_alert', detail: "Niveau de batterie critique : arrêt imminent ou déjà survenu." },
  gps_perdu: { label: 'Signal GPS perdu', icon: 'gps_off', detail: 'Plus de position valide : dernière position connue conservée.' },
  alimentation: { label: "Alimentation instable", icon: 'bolt', detail: "Variations de tension détectées sur l'alimentation du boîtier." },
}

export const ANOMALY_STATUS_META: Record<AnomalyStatus, { label: string }> = {
  nouvelle: { label: 'Nouvelle' },
  en_cours: { label: 'En cours' },
}

export function signalLevel(dbm: number): SignalLevel {
  if (dbm >= -70) return 'fort'
  if (dbm >= -85) return 'moyen'
  return 'faible'
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

const rnd = mulberry32(20261005)
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1))
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]
const round5 = (n: number) => Math.round(n * 1e5) / 1e5

/** Rayon (en degrés) autour du chef-lieu où les positions de démonstration sont tirées. */
function spread(region: string): number {
  if (region === 'dakar') return 0.04 // presqu'île : rester sur la terre ferme
  if (region === 'thies') return 0.09
  return 0.11
}

/**
 * Anomalies de démonstration, attribuées région par région dans l'ordre de
 * `REGION_STATS` (Dakar 2, Thiès 1, Diourbel 1, Kaolack 1…). Le total de
 * boîtiers en anomalie recoupe donc le Dashboard national.
 */
const ANOMALY_PLAN: { kind: AnomalyKind; ageMin: number; status: AnomalyStatus }[] = [
  { kind: 'comm_intermittente', ageMin: 12, status: 'nouvelle' },
  { kind: 'donnees_retard', ageMin: 47, status: 'en_cours' },
  { kind: 'batterie_faible', ageMin: 130, status: 'nouvelle' },
  { kind: 'gps_perdu', ageMin: 190, status: 'en_cours' },
  { kind: 'alimentation', ageMin: 310, status: 'en_cours' },
]

function build(): Monitored[] {
  const driverById = new Map(INITIAL_CONDUCTEURS.map((c) => [c.id, c]))
  const first = INITIAL_BOITIERS[0].id // SR-BOX-001 : en ligne, normal (comme la maquette)

  // 1. Boîtiers en anomalie : 1 ou plusieurs par région selon le Dashboard.
  const anomalyOf = new Map<string, (typeof ANOMALY_PLAN)[number]>()
  let planIdx = 0
  for (const r of REGION_STATS) {
    const candidates = INITIAL_BOITIERS.filter((b) => b.region === r.slug && b.status === 'actif' && b.conducteurId && b.id !== first)
    const chosen = new Set<string>()
    for (let k = 0; k < r.anomalies && candidates.length > chosen.size; k++) {
      // Le premier boîtier de Thiès (SR-BOX-002) est celui de la maquette : hors ligne + anomalie.
      const b = r.slug === 'thies' && k === 0 ? candidates[0] : pick(candidates.filter((c) => !chosen.has(c.id)))
      chosen.add(b.id)
      anomalyOf.set(b.id, ANOMALY_PLAN[planIdx++ % ANOMALY_PLAN.length])
    }
  }

  // 2. Boîtiers hors ligne : les 8 désactivés + 18 autres (dont celui de Thiès en batterie faible) = 26.
  const offline = new Set<string>(INITIAL_BOITIERS.filter((b) => b.status === 'inactif').map((b) => b.id))
  for (const [id, plan] of anomalyOf) if (plan.kind === 'batterie_faible') offline.add(id)
  const pool = INITIAL_BOITIERS.filter((b) => b.status === 'actif' && b.id !== first && !anomalyOf.has(b.id) && !offline.has(b.id))
  while (offline.size < 26) {
    const b = pick(pool)
    offline.add(b.id)
    pool.splice(pool.indexOf(b), 1)
  }

  // 3. Télémétrie de chaque boîtier.
  return INITIAL_BOITIERS.map((b): Monitored => {
    const d = b.conducteurId ? driverById.get(b.conducteurId) : undefined
    const plan = anomalyOf.get(b.id)
    const isOffline = offline.has(b.id)
    const reseau: Reseau = b.id === first ? 'Wi-Fi' : rnd() < 0.3 ? 'Wi-Fi' : 'GSM'
    const center = REGION_CENTERS[b.region] ?? REGION_CENTERS.dakar
    const r = spread(b.region)
    const lat = round5(center[0] + (rnd() * 2 - 1) * r)
    const lng = round5(center[1] + (rnd() * 2 - 1) * r)

    // Dernier message reçu
    let ageSec: number
    if (b.id === first) ageSec = 17
    else if (!isOffline) ageSec = plan?.kind === 'donnees_retard' ? int(180, 420) : int(2, 240)
    else if (b.status === 'inactif') ageSec = int(3, 20) * 86_400 + int(0, 80_000)
    else if (plan?.kind === 'batterie_faible') ageSec = 2 * 3600 + 3 * 60
    else ageSec = int(25, 38 * 60) * 60

    // Qualité de réception
    let signal = reseau === 'Wi-Fi' ? -int(42, 66) : -int(62, 88)
    let latenceMs = int(90, 420)
    let tauxReception = int(97, 100)
    let batterie = int(55, 100)
    if (plan?.kind === 'comm_intermittente') {
      signal = -int(90, 95)
      tauxReception = int(70, 84)
      latenceMs = int(700, 1400)
    }
    if (plan?.kind === 'donnees_retard') {
      latenceMs = int(2400, 5200)
      tauxReception = int(88, 94)
    }
    if (plan?.kind === 'batterie_faible') batterie = int(6, 12)
    if (plan?.kind === 'alimentation') batterie = int(30, 45)
    if (isOffline) {
      tauxReception = b.status === 'inactif' ? int(0, 18) : int(35, 80)
      if (plan?.kind !== 'batterie_faible') batterie = int(18, 70)
    }

    const vitesse = !b.conducteurId || isOffline || plan?.kind === 'gps_perdu' || rnd() < 0.15 ? 0 : int(18, 92)
    const evenement = vitesse > 0 && rnd() < 0.14 ? pick(['Freinage brusque', 'Accélération brusque']) : 'Aucun'

    const anomalies: Anomaly[] = plan
      ? [{ id: `an-${b.id}`, boitierId: b.id, kind: plan.kind, status: plan.status, ageSec: plan.ageMin * 60 }]
      : []

    return {
      id: b.id,
      uuid: b.uuid,
      region: b.region,
      conducteur: d?.name ?? null,
      plate: d?.plate ?? null,
      connexion: isOffline ? 'hors_ligne' : 'en_ligne',
      technique: plan ? 'anomalie' : 'normal',
      reseau,
      ageSec,
      lat,
      lng,
      vitesse,
      evenement,
      batterie,
      signal,
      latenceMs,
      tauxReception,
      intervalSec: pick([10, 10, 15, 30]),
      anomalies,
    }
  })
}

export const INITIAL_MONITORED: Monitored[] = build()

/**
 * Journal des derniers messages d'un boîtier (du plus récent au plus ancien).
 * Un boîtier hors ligne affiche en tête la coupure, puis ses derniers messages.
 */
export function communicationLog(m: Monitored): LogEntry[] {
  const entries: LogEntry[] = []
  const late = m.anomalies.some((a) => a.kind === 'donnees_retard')
  for (let k = 0; k < 6; k++) {
    entries.push({ ageSec: m.ageSec + k * m.intervalSec, kind: late && k < 3 ? 'retard' : 'recu' })
  }
  if (m.connexion === 'hors_ligne') entries[0] = { ageSec: m.ageSec, kind: 'coupure' }
  return entries
}
