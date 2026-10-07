export type ReportStatus = 'Validé' | 'En cours'

export interface ClientReport {
  id: string
  icon: string
  tint: string
  soft: string
  type: string
  desc: string
  place: string
  date: string
  status: ReportStatus
}

/**
 * Signalements de dangers envoyés par le conducteur — nid-de-poule,
 * signalisation absente, chaussée inondée, etc. `status` suit leur
 * traitement par l'ANASER : « En cours » = en cours d'examen, « Validé » =
 * confirmé et pris en compte.
 */
export const CLIENT_REPORTS: ClientReport[] = [
  {
    id: 'r1',
    icon: 'construction',
    tint: '#1f9d55',
    soft: '#e9f6ee',
    type: 'Nid-de-poule',
    desc: 'Cavité profonde sur la voie de droite, difficile à anticiper de nuit.',
    place: 'Route de Rufisque',
    date: '06/09/2026',
    status: 'Validé',
  },
  {
    id: 'r2',
    icon: 'no_crash',
    tint: '#e8940c',
    soft: '#fdf4e6',
    type: 'Signalisation absente',
    desc: 'Panneau de limitation de vitesse manquant après le rond-point.',
    place: 'RN2 — Km 12',
    date: '03/09/2026',
    status: 'En cours',
  },
  {
    id: 'r3',
    icon: 'water_drop',
    tint: '#1f9d55',
    soft: '#e9f6ee',
    type: 'Chaussée inondée',
    desc: 'Accumulation d’eau récurrente après les pluies, visibilité réduite.',
    place: 'Mbour centre',
    date: '28/08/2026',
    status: 'Validé',
  },
]
