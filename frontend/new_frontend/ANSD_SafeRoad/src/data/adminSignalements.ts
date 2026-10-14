import type { SignalementApi, StatutSignalementApi } from '@/lib/api'

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

export type DangerType = 'nid_de_poule' | 'chaussee_inondee' | 'signalisation_absente' | 'chaussee_degradee' | 'obstacle' | 'autre'
export type StatutSignalement = 'en_attente' | 'en_verification' | 'valide' | 'rejete'
export type Correspondance = 'constatee' | 'aucune' | 'complementaire' | null

export const DANGER_META: Record<DangerType, { label: string; icon: string; tint: string; soft: string }> = {
  nid_de_poule: { label: 'Nid-de-poule', icon: 'construction', tint: '#e8940c', soft: '#fdf4e6' },
  chaussee_inondee: { label: 'Chaussée inondée', icon: 'water_drop', tint: '#2b6cb0', soft: '#e8f0f9' },
  signalisation_absente: { label: 'Signalisation absente', icon: 'no_crash', tint: '#7c3aed', soft: '#f1eafe' },
  chaussee_degradee: { label: 'Chaussée dégradée', icon: 'warning', tint: '#dc3a2f', soft: '#fdeeec' },
  obstacle: { label: 'Obstacle', icon: 'block', tint: '#b4590a', soft: '#fdf1e6' },
  autre: { label: 'Autre', icon: 'help', tint: '#64748b', soft: '#f1f5f9' },
}

export const STATUT_META: Record<StatutSignalement, { label: string; icon: string; soft: string; text: string }> = {
  en_attente: { label: 'En attente', icon: 'schedule', soft: '#fdf4e6', text: '#e8940c' },
  en_verification: { label: 'En vérification', icon: 'search', soft: '#e8f0f9', text: '#2b6cb0' },
  valide: { label: 'Validé techniquement', icon: 'check_circle', soft: '#e9f6ee', text: '#1f9d55' },
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
  /** Identifiant backend (pour les appels API). */
  apiId: number
  lat: number
  lng: number
  precision: number | null
  photoUrl: string | null
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

const STATUT_DEPUIS_API: Record<StatutSignalementApi, StatutSignalement> = {
  a_verifier: 'en_attente',
  en_verification: 'en_verification',
  valide: 'valide',
  rejete: 'rejete',
}

export const STATUT_VERS_API: Record<StatutSignalement, StatutSignalementApi> = {
  en_attente: 'a_verifier',
  en_verification: 'en_verification',
  valide: 'valide',
  rejete: 'rejete',
}

const p2 = (n: number) => String(n).padStart(2, '0')

/** Signalement du backend -> ligne de la page (les incidents proches et l'historique se chargent à l'ouverture). */
export function signalementDepuisApi(a: SignalementApi): Signalement {
  const t = new Date(a.date_creation)
  return {
    id: `SG-${p2(a.id)}`,
    apiId: a.id,
    type: a.type_danger,
    localite: a.localite || a.region_libelle,
    lieu: a.localite || 'Non précisé',
    offset: [0, 0],
    lat: a.latitude,
    lng: a.longitude,
    precision: a.precision_metres,
    photoUrl: a.photo_url,
    conducteur: a.conducteur_nom ?? 'Compte supprimé',
    telephone: a.conducteur_telephone || 'Non renseigné',
    vehicule: a.immatriculation || undefined,
    boitier: a.boitier ? `SR-${a.boitier.slice(0, 8).toUpperCase()}` : undefined,
    date: `${p2(t.getDate())}/${p2(t.getMonth() + 1)}/${t.getFullYear()}`,
    heure: `${p2(t.getHours())}:${p2(t.getMinutes())}`,
    ts: a.date_creation,
    statut: STATUT_DEPUIS_API[a.statut],
    description: a.description,
    evenementsProches: [],
    evenementsSimilaires: 0,
    correspondance: null,
    historique: [],
  }
}

/** Nombre de signalements reçus chacun des 7 derniers jours (courbes des cartes KPI). */
export function tendance7j(liste: Signalement[], filtre: (s: Signalement) => boolean = () => true): number[] {
  const jours = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - 6 + i)
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
  })
  return jours.map((jour) =>
    liste.filter((s) => {
      const t = new Date(s.ts)
      return filtre(s) && `${t.getFullYear()}-${p2(t.getMonth() + 1)}-${p2(t.getDate())}` === jour
    }).length,
  )
}
