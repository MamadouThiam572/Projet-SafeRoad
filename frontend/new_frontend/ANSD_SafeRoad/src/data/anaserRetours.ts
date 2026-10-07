export type ActionPrevue = 'signalisation' | 'ralentisseur' | 'eclairage' | 'autre'
export type StatutRetour = 'nouveau' | 'en_cours' | 'traite'
export type CibleType = 'zone' | 'incident'

export interface RetourAnaser {
  id: string
  cibleType: CibleType
  cibleLabel: string
  actionPrevue: ActionPrevue
  commentaire: string
  statut: StatutRetour
  createdAt: string
}

export const ACTION_PREVUE_LABEL: Record<ActionPrevue, string> = {
  signalisation: 'Signalisation manquante',
  ralentisseur: 'Ralentisseur nécessaire',
  eclairage: 'Éclairage insuffisant',
  autre: 'Autre action',
}

export const STATUT_RETOUR_META: Record<StatutRetour, { label: string; color: string; soft: string; text: string }> = {
  nouveau: { label: 'Nouveau', color: '#dc3a2f', soft: '#fdeeec', text: '#dc3a2f' },
  en_cours: { label: 'En cours', color: '#e8940c', soft: '#fdf4e6', text: '#e8940c' },
  traite: { label: 'Traité', color: '#1f9d55', soft: '#e9f6ee', text: '#1f9d55' },
}

/**
 * Retours officiels ANASER (modèle AlerteAnaser côté backend — apps/anaser).
 * Mock local en attendant le branchement sur getAlertesAnaser / createAlerteAnaser
 * / updateAlerteAnaser / deleteAlerteAnaser (src/lib/api.ts) une fois l'endpoint
 * POST/GET/PUT/PATCH/DELETE /api/v1/alertes-anaser/ accessible depuis le frontend.
 */
export const ANASER_RETOURS: RetourAnaser[] = [
  {
    id: 'SR-001',
    cibleType: 'zone',
    cibleLabel: 'RN1 — Km 45 (Dakar)',
    actionPrevue: 'signalisation',
    commentaire: "Signalisation manquante à l'approche du carrefour.",
    statut: 'en_cours',
    createdAt: '09/09/2026',
  },
  {
    id: 'SR-002',
    cibleType: 'zone',
    cibleLabel: 'RN2 — Km 32 (Thiès)',
    actionPrevue: 'eclairage',
    commentaire: 'Éclairage public insuffisant sur ce tronçon la nuit.',
    statut: 'traite',
    createdAt: '08/09/2026',
  },
  {
    id: 'SR-003',
    cibleType: 'zone',
    cibleLabel: 'A1 (Dakar)',
    actionPrevue: 'ralentisseur',
    commentaire: 'Vitesses excessives constatées à répétition, ralentisseur recommandé.',
    statut: 'traite',
    createdAt: '06/09/2026',
  },
]
