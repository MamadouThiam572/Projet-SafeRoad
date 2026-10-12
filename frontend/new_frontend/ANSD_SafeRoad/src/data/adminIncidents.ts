import type { IncidentApi, StatutIncidentApi } from '@/lib/api'

/**
 * Données de la page /admin/incidents (« Gestion des incidents » de
 * l'administrateur régional). Données de démonstration en attendant
 * l'endpoint réel (probablement apps/incidents côté backend) — pas d'appel
 * API pour l'instant.
 *
 * Comme pour /admin/zones, chaque incident porte un "offset" (delta en
 * degrés) appliqué au centre de la région réellement connectée (voir
 * src/lib/regions.ts), pas de coordonnées absolues : la carte doit
 * s'afficher sur la région de l'administrateur (Diourbel, Thiès…), pas
 * toujours sur Dakar.
 */

export type Gravite = 'critique' | 'elevee' | 'moyenne' | 'faible' | 'autre'
export type StatutIncident = StatutIncidentApi
export type SourceIncident = 'boitier' | 'manuel'

export interface Incident {
  id: string
  /** Incident du backend (fiche détaillée, décisions). */
  api: IncidentApi
  lat: number
  lng: number
  date: string
  heure: string
  /** Horodatage triable (ISO) dérivé de date+heure, pour trier/paginer sans reparser des chaînes françaises. */
  ts: string
  localite: string
  lieu: string
  offset: [number, number]
  type: string
  gravite: Gravite
  source: SourceIncident
  boitier?: string
  statut: StatutIncident
}

export const GRAVITE_META: Record<Gravite, { label: string; color: string; soft: string; text: string }> = {
  critique: { label: 'Critique', color: '#dc3a2f', soft: '#fdeeec', text: '#dc3a2f' },
  elevee: { label: 'Élevée', color: '#e8940c', soft: '#fdf4e6', text: '#e8940c' },
  moyenne: { label: 'Moyenne', color: '#d9a40c', soft: '#fdf8e6', text: '#8a6d02' },
  faible: { label: 'Faible', color: '#1f9d55', soft: '#e9f6ee', text: '#1f9d55' },
  autre: { label: 'Autre', color: '#2b6cb0', soft: '#e8f0f9', text: '#2b6cb0' },
}

export const STATUT_META: Record<StatutIncident, { label: string; soft: string; text: string }> = {
  nouveau: { label: 'À examiner', soft: '#fdf4e6', text: '#e8940c' },
  en_cours: { label: 'En cours', soft: '#e8f0f9', text: '#2b6cb0' },
  valide: { label: 'Validé techniquement', soft: '#f1eafe', text: '#7c3aed' },
  cloture: { label: 'Clôturé', soft: '#e9f6ee', text: '#1f9d55' },
  rejete: { label: 'Rejeté (faux positif)', soft: '#f1f5f9', text: '#64748b' },
}

export const SOURCE_META: Record<SourceIncident, { label: string; icon: string }> = {
  boitier: { label: 'Boîtier', icon: 'memory' },
  manuel: { label: 'Manuel', icon: 'edit_note' },
}

const GRAVITE_DEPUIS_API: Record<IncidentApi['niveau_gravite'], Gravite> = {
  critique: 'critique',
  moyen: 'moyenne',
  faible: 'faible',
}

const p2 = (n: number) => String(n).padStart(2, '0')

/** Incident du backend -> ligne de la page (position réelle, boîtier, statut de traitement). */
export function incidentDepuisApi(a: IncidentApi, centre: [number, number]): Incident {
  const t = new Date(a.horodatage)
  return {
    id: `INC-${a.id}`,
    api: a,
    lat: a.latitude,
    lng: a.longitude,
    date: `${p2(t.getDate())}/${p2(t.getMonth() + 1)}/${t.getFullYear()}`,
    heure: `${p2(t.getHours())}:${p2(t.getMinutes())}`,
    ts: a.horodatage,
    localite: a.zone ? `Zone Z-${a.zone}` : 'Hors zone connue',
    lieu: a.position_fiable ? 'Position GPS' : 'Position GPS douteuse',
    offset: [a.latitude - centre[0], a.longitude - centre[1]],
    type: a.type_incident_libelle,
    gravite: GRAVITE_DEPUIS_API[a.niveau_gravite],
    source: 'boitier',
    boitier: `SR-${a.boitier.slice(0, 8).toUpperCase()}`,
    statut: a.statut as StatutIncident,
  }
}

/** Nombre d'incidents de chacun des 7 derniers jours (courbes des cartes KPI). */
export function tendance7j(liste: Incident[], filtre: (i: Incident) => boolean = () => true): number[] {
  return Array.from({ length: 7 }, (_, k) => {
    const d = new Date()
    d.setDate(d.getDate() - 6 + k)
    const jour = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
    return liste.filter((i) => {
      const t = new Date(i.ts)
      return filtre(i) && `${t.getFullYear()}-${p2(t.getMonth() + 1)}-${p2(t.getDate())}` === jour
    }).length
  })
}
