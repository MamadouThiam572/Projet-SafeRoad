import { getAlertesAnaser, type AlerteAnaser, type StatutRetourApi } from '@/lib/api'

export type ActionPrevue = 'signalisation' | 'ralentisseur' | 'eclairage' | 'autre' | 'aucune'
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
  /** Données réelles : identifiant backend, auteur (seul à pouvoir faire avancer le statut). */
  apiId?: number
  auteurId?: string
  auteurNom?: string
}

export const ACTION_PREVUE_LABEL: Record<ActionPrevue, string> = {
  signalisation: 'Signalisation manquante',
  ralentisseur: 'Ralentisseur nécessaire',
  eclairage: 'Éclairage insuffisant',
  autre: 'Autre action',
  aucune: 'Aucune action (information)',
}

export const STATUT_RETOUR_META: Record<StatutRetour, { label: string; color: string; soft: string; text: string }> = {
  nouveau: { label: 'Nouveau', color: '#dc3a2f', soft: '#fdeeec', text: '#dc3a2f' },
  en_cours: { label: 'En cours', color: '#e8940c', soft: '#fdf4e6', text: '#e8940c' },
  traite: { label: 'Traité', color: '#1f9d55', soft: '#e9f6ee', text: '#1f9d55' },
}

const STATUT_DEPUIS_API: Record<StatutRetourApi, StatutRetour> = { soumise: 'nouveau', en_cours: 'en_cours', realisee: 'traite' }
export const STATUT_VERS_API: Record<StatutRetour, StatutRetourApi> = { nouveau: 'soumise', en_cours: 'en_cours', traite: 'realisee' }

/** Retour du backend (AlerteAnaser) -> carte de la page, même forme que la démonstration. */
export function retourDepuisApi(a: AlerteAnaser): RetourAnaser {
  return {
    id: `SR-${String(a.id).padStart(3, '0')}`,
    apiId: a.id,
    cibleType: a.zone ? 'zone' : 'incident',
    cibleLabel: a.cible_libelle,
    actionPrevue: a.action_prevue,
    commentaire: a.commentaire,
    statut: STATUT_DEPUIS_API[a.statut],
    createdAt: new Date(a.date_creation).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    auteurId: String(a.auteur),
    auteurNom: a.auteur_nom,
  }
}

/** Retours officiels réels (chargement partagé : page Retours, tableau de bord, menu). */
export const chargerRetours = () => getAlertesAnaser().then((liste) => liste.map(retourDepuisApi))
