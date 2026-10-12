import type { StatutZone } from '@/lib/api'

/** Les 7 statuts du circuit de validation (miroir de Zone.StatutValidation côté backend). */
export const STATUT_ZONE_META: Record<StatutZone, { label: string; soft: string; text: string }> = {
  proposee: { label: 'Proposée', soft: '#eef2f7', text: '#475569' },
  en_verification: { label: 'En vérification', soft: '#fdf4e6', text: '#b4590a' },
  validee_technique: { label: 'Validée techniquement', soft: '#e8f0f9', text: '#2b6cb0' },
  soumise_anaser: { label: "Soumise à l'ANASER", soft: '#f1eafe', text: '#7c3aed' },
  reconnue: { label: "Reconnue par l'ANASER", soft: '#e9f6ee', text: '#1a8248' },
  rejetee: { label: 'Rejetée', soft: '#fdeeec', text: '#c4281d' },
  archivee: { label: 'Archivée', soft: '#f1f5f9', text: '#64748b' },
}

/** Statuts où la zone attend encore la validation technique d'un administrateur. */
export const STATUTS_A_VALIDER: StatutZone[] = ['proposee', 'en_verification', 'validee_technique']
