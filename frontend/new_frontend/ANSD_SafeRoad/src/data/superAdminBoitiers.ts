/**
 * Données de la page Super Admin → Boîtiers (gestion ADMINISTRATIVE des boîtiers :
 * enregistrement, affectation conducteur/véhicule, statut administratif).
 *
 * Cette page ne porte AUCUNE donnée technique (connexion, dernière communication,
 * réseau, anomalies) : elles appartiennent à la page Monitoring IoT.
 *
 * Les 156 boîtiers sont générés de façon déterministe (pas de hasard à
 * l'exécution) à partir des chiffres par région du Dashboard national
 * (REGION_STATS : `boitiers` et `affectes`). Les totaux de la page recoupent
 * donc exactement ceux du dashboard : 156 boîtiers, 130 affectés, 8 inactifs.
 *
 * TODO backend : remplacer par la liste paginée des boîtiers (filtres région /
 * affectation / statut / conducteur), la liste des conducteurs équipés sans
 * boîtier, et les endpoints d'enregistrement, de modification, d'affectation,
 * d'activation/désactivation et de réinitialisation de la clé API.
 */

import { REGION_STATS } from '@/data/superAdminHome'
import { INITIAL_STAFF_USERS } from '@/data/superAdminUsers'
import { REGION_PLATE_PREFIX } from '@/lib/regions'

export type BoitierStatus = 'actif' | 'inactif'
export type HistoryKind = 'enregistre' | 'affecte' | 'desaffecte'

/** Conducteur équipé : son véhicule est enregistré avec son compte. */
export interface Conducteur {
  id: string
  name: string
  /** Slug de région. */
  region: string
  /** Plaque complète, préfixe de la région inclus (ex. « DK-4521-AA »). */
  plate: string
}

export interface HistoryEntry {
  id: string
  kind: HistoryKind
  /** AAAA-MM-JJ */
  date: string
  label: string
  actor: string
}

export interface Boitier {
  /** Identifiant lisible, ex. « SR-BOX-001 ». */
  id: string
  uuid: string
  apiKey: string
  /** Slug de région. */
  region: string
  status: BoitierStatus
  /** AAAA-MM-JJ */
  registeredAt: string
  conducteurId: string | null
  /** AAAA-MM-JJ — date de l'affectation courante. */
  assignedAt: string | null
  /** Du plus récent au plus ancien. */
  history: HistoryEntry[]
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

const rnd = mulberry32(20260930)
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1))
const hex = (n: number) => Array.from({ length: n }, () => Math.floor(rnd() * 16).toString(16)).join('')

const makeUuid = () => `${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[int(0, 3)]}${hex(3)}-${hex(12)}`
const makeApiKey = () => `srk_${hex(32)}`

const FIRST_NAMES = [
  'Mamadou', 'Aïssatou', 'Ibrahima', 'Fatou', 'Cheikh', 'Awa', 'Moussa', 'Khady', 'Ousmane', 'Mariama', 'Abdoulaye', 'Ndèye',
  'Pape', 'Seynabou', 'Modou', 'Rokhaya', 'Babacar', 'Astou', 'Samba', 'Coumba', 'Alioune', 'Dior', 'Mbaye', 'Bineta',
]
const LAST_NAMES = [
  'Sané', 'Diop', 'Fall', 'Ndiaye', 'Ba', 'Sow', 'Gueye', 'Faye', 'Sy', 'Camara', 'Diallo', 'Mbaye',
  'Thiam', 'Cissé', 'Sarr', 'Seck', 'Ndao', 'Badji', 'Diouf', 'Lô', 'Tine', 'Kane', 'Sène', 'Diatta',
]

/** Noms de conducteurs, tous distincts : toutes les combinaisons prénom × nom, mélangées. */
const NAME_POOL: string[] = (() => {
  const all = FIRST_NAMES.flatMap((f) => LAST_NAMES.map((l) => `${f} ${l}`))
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[all[i], all[j]] = [all[j], all[i]]
  }
  return all
})()
let nameCursor = 0
const nextName = () => NAME_POOL[nameCursor++]

const usedPlates = new Set<string>()
function makePlate(region: string): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  for (;;) {
    const plate = `${REGION_PLATE_PREFIX[region] ?? 'DK'}-${String(int(1000, 9999))}-${letters[int(0, 25)]}${letters[int(0, 25)]}`
    if (!usedPlates.has(plate)) {
      usedPlates.add(plate)
      return plate
    }
  }
}

const DAY = 86_400_000
const BASE = Date.UTC(2026, 1, 10) // 10/02/2026
const isoDay = (offsetDays: number) => new Date(BASE + offsetDays * DAY).toISOString().slice(0, 10)

/** AAAA-MM-JJ → JJ/MM/AAAA */
export const formatDay = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

/** « Administrateur régional : A. Diop » à partir de la page Utilisateurs (cohérence des noms). */
function regionalActor(region: string): string {
  const admin = INITIAL_STAFF_USERS.find((u) => u.role === 'sous_admin' && u.region === region)
  return admin ? `Administrateur régional : ${admin.firstName[0]}. ${admin.lastName}` : 'Administrateur régional'
}

/** Indices (0-based) des 8 boîtiers inactifs : 148 actifs au total, comme la maquette. */
const INACTIVE_INDEXES = new Set([2, 10, 23, 36, 51, 77, 100, 132])

interface Stub {
  region: string
  hasDriver: boolean
}

function buildData(): { boitiers: Boitier[]; conducteurs: Conducteur[] } {
  // 1. Un « stub » par boîtier, selon les chiffres du Dashboard national.
  const queues = REGION_STATS.map((r) => ({
    region: r.slug,
    items: Array.from({ length: r.boitiers }, (_, i): Stub => ({ region: r.slug, hasDriver: i < r.affectes })),
  }))

  // 2. Ordre global : un boîtier par région à tour de rôle (les régions se mélangent dans la liste).
  const ordered: Stub[] = []
  while (queues.some((q) => q.items.length > 0)) {
    for (const q of queues) {
      const next = q.items.shift()
      if (next) ordered.push(next)
    }
  }

  const conducteurs: Conducteur[] = []
  const boitiers: Boitier[] = ordered.map((stub, i) => {
    const id = `SR-BOX-${String(i + 1).padStart(3, '0')}`
    const registeredOffset = Math.floor(i * 1.15) + int(0, 6)
    const registeredAt = isoDay(registeredOffset)
    const actor = regionalActor(stub.region)
    const history: HistoryEntry[] = []
    let conducteurId: string | null = null
    let assignedAt: string | null = null

    if (stub.hasDriver) {
      const driver: Conducteur = { id: `cnd-${String(conducteurs.length + 1).padStart(3, '0')}`, name: nextName(), region: stub.region, plate: makePlate(stub.region) }
      conducteurs.push(driver)
      conducteurId = driver.id

      const hadPrevious = i === 0 || rnd() < 0.3
      if (hadPrevious) {
        const prevName = nextName()
        const assignedOffset = registeredOffset + 4 + int(0, 6)
        assignedAt = isoDay(assignedOffset)
        history.push(
          { id: `${id}-h3`, kind: 'affecte', date: assignedAt, label: `Affecté à ${driver.name}`, actor },
          { id: `${id}-h2`, kind: 'desaffecte', date: isoDay(registeredOffset + 3), label: `Désaffecté de ${prevName}`, actor },
          { id: `${id}-h1`, kind: 'affecte', date: isoDay(registeredOffset + 1), label: `Affecté à ${prevName}`, actor },
        )
      } else {
        assignedAt = isoDay(registeredOffset + 1 + int(0, 8))
        history.push({ id: `${id}-h2`, kind: 'affecte', date: assignedAt, label: `Affecté à ${driver.name}`, actor })
      }
    }
    history.push({ id: `${id}-h0`, kind: 'enregistre', date: registeredAt, label: 'Boîtier enregistré', actor })

    return {
      id,
      uuid: makeUuid(),
      apiKey: makeApiKey(),
      region: stub.region,
      status: INACTIVE_INDEXES.has(i) ? 'inactif' : 'actif',
      registeredAt,
      conducteurId,
      assignedAt,
      history,
    }
  })

  // 3. Conducteurs équipés qui n'ont pas encore de boîtier (disponibles pour une affectation).
  for (const r of REGION_STATS) {
    for (let k = 0; k < 3; k++) {
      conducteurs.push({ id: `cnd-${String(conducteurs.length + 1).padStart(3, '0')}`, name: nextName(), region: r.slug, plate: makePlate(r.slug) })
    }
  }

  return { boitiers, conducteurs }
}

const GENERATED = buildData()

export const INITIAL_BOITIERS: Boitier[] = GENERATED.boitiers
export const INITIAL_CONDUCTEURS: Conducteur[] = GENERATED.conducteurs
