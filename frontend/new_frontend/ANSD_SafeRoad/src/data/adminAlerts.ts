import { ilYa, type RiskLevel } from '@/data/adminHome'
import type { AlerteApi } from '@/lib/api'

export type AlertSource = 'zone' | 'vehicule' | 'boitier'
export type AlertStatus = 'nouvelle' | 'en_cours' | 'traitee'

export interface AdminAlert {
  id: string
  source: AlertSource
  level: RiskLevel
  status: AlertStatus
  icon: string
  title: string
  desc: string
  place: string
  ago: string
  /** Info complémentaire : véhicule concerné, identifiant du boîtier, etc. */
  meta?: string
}

const ICONE_SOURCE: Record<AlertSource, string> = { zone: 'crisis_alert', vehicule: 'report', boitier: 'wifi_off' }

/** Alerte du backend -> carte du fil d'alertes. */
export function alerteDepuisApi(a: AlerteApi, maintenant: number): AdminAlert {
  const v = a.vehicule
  const meta = v
    ? [v.immatriculation, v.conducteur].filter(Boolean).join(' · ') || `Boîtier SR-${v.boitier.slice(0, 8).toUpperCase()}`
    : undefined
  const ago = ilYa(a.date_creation, maintenant)
  return {
    id: String(a.id),
    source: a.source,
    level: a.niveau,
    status: a.statut,
    icon: ICONE_SOURCE[a.source],
    title: a.titre,
    desc: a.description,
    place: a.lieu ?? 'Lieu inconnu',
    ago: ago.charAt(0).toUpperCase() + ago.slice(1),
    meta,
  }
}

export const ALERT_STATUS_META: Record<AlertStatus, { label: string; color: string; soft: string; text: string }> = {
  nouvelle: { label: 'Nouvelle', color: '#dc3a2f', soft: '#fdeeec', text: '#dc3a2f' },
  en_cours: { label: 'En cours', color: '#e8940c', soft: '#fdf4e6', text: '#e8940c' },
  traitee: { label: 'Traitée', color: '#1f9d55', soft: '#e9f6ee', text: '#1f9d55' },
}

export const ALERT_SOURCE_LABEL: Record<AlertSource, string> = {
  zone: 'Zone',
  vehicule: 'Véhicule',
  boitier: 'Boîtier',
}
