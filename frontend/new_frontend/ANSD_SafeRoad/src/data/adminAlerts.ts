import type { RiskLevel } from '@/data/adminHome'

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

/** Fil d'alertes de la région de l'Admin Régional, toutes sources confondues. */
export const ADMIN_ALERTS: AdminAlert[] = [
  {
    id: 'aa1',
    source: 'zone',
    level: 'critique',
    status: 'nouvelle',
    icon: 'report',
    title: 'Accident signalé',
    desc: 'Un accident a été signalé sur la zone à risque cartographiée.',
    place: 'RN1 — Km 45 (Dakar)',
    ago: 'Il y a 12 min',
  },
  {
    id: 'aa2',
    source: 'vehicule',
    level: 'vigilance',
    status: 'en_cours',
    icon: 'speed',
    title: 'Freinage brusque détecté',
    desc: 'Le boîtier embarqué a détecté un freinage anormalement brusque.',
    place: 'Avenue Bourguiba (Dakar)',
    ago: 'Il y a 28 min',
    meta: 'DK-4471-EF · Moussa Diop',
  },
  {
    id: 'aa3',
    source: 'boitier',
    level: 'vigilance',
    status: 'nouvelle',
    icon: 'wifi_off',
    title: 'Boîtier hors ligne',
    desc: 'Aucune remontée de données depuis plus de 40 minutes.',
    place: 'Pikine (Dakar)',
    ago: 'Il y a 42 min',
    meta: 'Boîtier SR-03',
  },
  {
    id: 'aa4',
    source: 'vehicule',
    level: 'vigilance',
    status: 'nouvelle',
    icon: 'priority_high',
    title: 'Excès de vitesse détecté',
    desc: 'Vitesse relevée nettement supérieure à la moyenne du secteur.',
    place: 'Pikine — Route de Rufisque',
    ago: 'Il y a 8 min',
    meta: 'DK-1187-GH · Fatou Camara',
  },
  {
    id: 'aa5',
    source: 'boitier',
    level: 'critique',
    status: 'en_cours',
    icon: 'wifi_off',
    title: 'Boîtier hors ligne prolongé',
    desc: 'Coupure prolongée — véhicule associé injoignable.',
    place: 'Technopole (Dakar)',
    ago: 'Il y a 25 min',
    meta: 'DK-2803-IJ · Cheikh Fall',
  },
  {
    id: 'aa6',
    source: 'zone',
    level: 'vigilance',
    status: 'nouvelle',
    icon: 'crisis_alert',
    title: 'Nouvelle zone de vigilance détectée',
    desc: "Récurrence d'événements repérée par l'IA sur ce tronçon.",
    place: 'Parallèles Assainis',
    ago: 'Il y a 2 h',
  },
  {
    id: 'aa7',
    source: 'zone',
    level: 'normale',
    status: 'traitee',
    icon: 'check_circle',
    title: 'Retour à la normale',
    desc: 'La zone précédemment en alerte est de nouveau sous contrôle.',
    place: 'Zone de Fann (Dakar)',
    ago: 'Il y a 1 h',
  },
]

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
