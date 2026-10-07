/**
 * Données de la page /admin/monitoring (« Monitoring IoT » de l'administrateur
 * régional). Données de démonstration en attendant l'endpoint réel
 * (probablement apps/boitiers côté backend) — pas d'appel API pour l'instant.
 *
 * Comme pour /admin/zones, /admin/carte et /admin/incidents, chaque boîtier
 * porte un "offset" (delta en degrés) appliqué au centre de la région
 * réellement connectée (voir src/lib/regions.ts), pas de coordonnées
 * absolues : la carte doit s'afficher sur la région de l'administrateur
 * (Diourbel, Thiès…), pas toujours sur Dakar.
 */

export type EtatConnexion = 'en_ligne' | 'hors_ligne'
export type EtatTechnique = 'normal' | 'anomalie' | 'maintenance'
export type Reseau = 'GSM' | 'WiFi'

export interface Boitier {
  id: string
  vehicule: string
  localite: string
  lieu: string
  offset: [number, number]
  connexion: EtatConnexion
  technique: EtatTechnique
  /** Date+heure lisible (JJ/MM/AAAA HH:mm). */
  derniereCommunication: string
  /** Même instant, au format ISO triable. */
  derniereCommunicationTs: string
  derniereDonnee: string
  batterie: number
  reseau: Reseau
}

export const CONNEXION_META: Record<EtatConnexion, { label: string; color: string; soft: string; text: string }> = {
  en_ligne: { label: 'En ligne', color: '#1f9d55', soft: '#e9f6ee', text: '#1f9d55' },
  hors_ligne: { label: 'Hors ligne', color: '#dc3a2f', soft: '#fdeeec', text: '#dc3a2f' },
}

export const TECHNIQUE_META: Record<EtatTechnique, { label: string; soft: string; text: string }> = {
  normal: { label: 'Normal', soft: '#e9f6ee', text: '#1f9d55' },
  anomalie: { label: 'Anomalie', soft: '#fdf4e6', text: '#e8940c' },
  maintenance: { label: 'Maintenance', soft: '#f1eafe', text: '#7c3aed' },
}

export const BOITIERS: Boitier[] = [
  { id: 'SR-01', vehicule: 'Véhicule 01', localite: 'Axe principal', lieu: 'RN3 – Km 12', offset: [0.0485, 0.0123], connexion: 'en_ligne', technique: 'normal', derniereCommunication: '01/10/2026 09:12', derniereCommunicationTs: '2026-10-01T09:12', derniereDonnee: '01/10/2026 09:12', batterie: 82, reseau: 'GSM' },
  { id: 'SR-02', vehicule: 'Véhicule 02', localite: 'Périphérie', lieu: 'Avenue principale', offset: [-0.0434, -0.0381], connexion: 'en_ligne', technique: 'normal', derniereCommunication: '01/10/2026 09:10', derniereCommunicationTs: '2026-10-01T09:10', derniereDonnee: '01/10/2026 09:10', batterie: 74, reseau: 'GSM' },
  { id: 'SR-03', vehicule: 'Véhicule 03', localite: 'Centre-ville', lieu: 'Rond-point central', offset: [-0.0152, -0.0559], connexion: 'hors_ligne', technique: 'normal', derniereCommunication: '30/09/2026 22:17', derniereCommunicationTs: '2026-09-30T22:17', derniereDonnee: '30/09/2026 22:17', batterie: 58, reseau: 'WiFi' },
  { id: 'SR-04', vehicule: 'Véhicule 04', localite: 'Périphérie ouest', lieu: 'Route de contournement', offset: [0.0389, 0.0097], connexion: 'en_ligne', technique: 'anomalie', derniereCommunication: '01/10/2026 08:55', derniereCommunicationTs: '2026-10-01T08:55', derniereDonnee: '01/10/2026 08:55', batterie: 41, reseau: 'GSM' },
  { id: 'SR-05', vehicule: 'Véhicule 05', localite: 'Zone de la gare', lieu: 'Route de la gare', offset: [0.058, 0.09], connexion: 'en_ligne', technique: 'maintenance', derniereCommunication: '01/10/2026 07:30', derniereCommunicationTs: '2026-10-01T07:30', derniereDonnee: '01/10/2026 07:30', batterie: 69, reseau: 'GSM' },
  { id: 'SR-06', vehicule: 'Véhicule 06', localite: 'Centre-ville', lieu: 'Marché central', offset: [-0.008, 0.034], connexion: 'hors_ligne', technique: 'anomalie', derniereCommunication: '29/09/2026 19:03', derniereCommunicationTs: '2026-09-29T19:03', derniereDonnee: '29/09/2026 19:03', batterie: 15, reseau: 'GSM' },
  { id: 'SR-07', vehicule: 'Véhicule 07', localite: 'Sortie nord', lieu: 'Sortie ville — RN4', offset: [0.088, 0.036], connexion: 'en_ligne', technique: 'normal', derniereCommunication: '01/10/2026 09:05', derniereCommunicationTs: '2026-10-01T09:05', derniereDonnee: '01/10/2026 09:05', batterie: 90, reseau: 'WiFi' },
  { id: 'SR-08', vehicule: 'Véhicule 08', localite: 'Zone technopole', lieu: 'Zone technopole', offset: [0.0085, -0.0644], connexion: 'en_ligne', technique: 'normal', derniereCommunication: '01/10/2026 08:40', derniereCommunicationTs: '2026-10-01T08:40', derniereDonnee: '01/10/2026 08:40', batterie: 77, reseau: 'WiFi' },
]

/**
 * Tendances sur quelques relevés récents, pour la petite courbe (sparkline)
 * de chaque carte KPI — un agrégat temporel qui ne se déduit pas de la seule
 * liste de boîtiers ci-dessus (qui ne couvre qu'un instantané). Démonstration.
 */
export const KPI_TRENDS = {
  total: [6, 6, 7, 7, 8, 8, 8],
  enLigne: [4, 5, 5, 6, 5, 6, 6],
  horsLigne: [2, 1, 2, 1, 3, 2, 2],
  enAnomalie: [1, 1, 2, 1, 1, 2, 2],
}
