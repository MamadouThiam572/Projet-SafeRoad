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
export type StatutIncident = 'a_examiner' | 'en_cours' | 'transmis' | 'cloture'
export type SourceIncident = 'boitier' | 'manuel'

export interface Incident {
  id: string
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
  a_examiner: { label: 'À examiner', soft: '#fdf4e6', text: '#e8940c' },
  en_cours: { label: 'En cours', soft: '#e8f0f9', text: '#2b6cb0' },
  transmis: { label: 'Transmis', soft: '#f1eafe', text: '#7c3aed' },
  cloture: { label: 'Clôturé', soft: '#e9f6ee', text: '#1f9d55' },
}

export const SOURCE_META: Record<SourceIncident, { label: string; icon: string }> = {
  boitier: { label: 'Boîtier', icon: 'memory' },
  manuel: { label: 'Manuel', icon: 'edit_note' },
}

export const INCIDENTS: Incident[] = [
  { id: 'INC-101', date: '01/10/2026', heure: '14:32', ts: '2026-10-01T14:32', localite: 'Centre-ville', lieu: 'RN3 – Km 12', offset: [0.023, 0.05], type: 'Accident signalé', gravite: 'critique', source: 'boitier', boitier: 'SR-01', statut: 'a_examiner' },
  { id: 'INC-102', date: '01/10/2026', heure: '10:15', ts: '2026-10-01T10:15', localite: 'Centre-ville', lieu: 'Avenue principale', offset: [0.001, -0.006], type: 'Freinage brusque', gravite: 'moyenne', source: 'boitier', boitier: 'SR-02', statut: 'en_cours' },
  { id: 'INC-103', date: '30/09/2026', heure: '18:47', ts: '2026-09-30T18:47', localite: 'Périphérie', lieu: 'Rond-point central', offset: [0.014, -0.026], type: 'Collision signalée', gravite: 'elevee', source: 'manuel', statut: 'transmis' },
  { id: 'INC-104', date: '30/09/2026', heure: '09:21', ts: '2026-09-30T09:21', localite: 'Périphérie ouest', lieu: 'Route de contournement', offset: [-0.033, -0.084], type: 'Incident matériel', gravite: 'faible', source: 'boitier', boitier: 'SR-03', statut: 'cloture' },
  { id: 'INC-105', date: '29/09/2026', heure: '21:03', ts: '2026-09-29T21:03', localite: 'Zone de la gare', lieu: 'Route de la gare', offset: [0.058, 0.09], type: 'Autre', gravite: 'autre', source: 'boitier', boitier: 'SR-04', statut: 'en_cours' },
  { id: 'INC-106', date: '29/09/2026', heure: '07:40', ts: '2026-09-29T07:40', localite: 'Centre-ville', lieu: 'Marché central', offset: [-0.008, 0.034], type: 'Accident signalé', gravite: 'critique', source: 'boitier', boitier: 'SR-02', statut: 'a_examiner' },
  { id: 'INC-107', date: '28/09/2026', heure: '16:12', ts: '2026-09-28T16:12', localite: 'Sortie nord', lieu: 'Sortie ville — RN4', offset: [0.088, 0.036], type: 'Excès de vitesse', gravite: 'elevee', source: 'manuel', statut: 'a_examiner' },
  { id: 'INC-108', date: '28/09/2026', heure: '11:55', ts: '2026-09-28T11:55', localite: 'Axe principal', lieu: 'RN3 – Km 18', offset: [0.031, 0.063], type: 'Freinage brusque', gravite: 'moyenne', source: 'boitier', boitier: 'SR-01', statut: 'cloture' },
  { id: 'INC-109', date: '27/09/2026', heure: '19:08', ts: '2026-09-27T19:08', localite: 'Zone résidentielle', lieu: 'Rue des manguiers', offset: [-0.051, 0.012], type: 'Incident matériel', gravite: 'faible', source: 'boitier', boitier: 'SR-05', statut: 'en_cours' },
  { id: 'INC-110', date: '27/09/2026', heure: '08:27', ts: '2026-09-27T08:27', localite: 'Centre-ville', lieu: 'Avenue principale', offset: [0.001, -0.006], type: 'Accident signalé', gravite: 'critique', source: 'boitier', boitier: 'SR-02', statut: 'cloture' },
  { id: 'INC-111', date: '26/09/2026', heure: '15:50', ts: '2026-09-26T15:50', localite: 'Zone est', lieu: 'Route de la gare', offset: [0.058, 0.09], type: 'Collision signalée', gravite: 'elevee', source: 'boitier', boitier: 'SR-04', statut: 'transmis' },
  { id: 'INC-112', date: '26/09/2026', heure: '12:03', ts: '2026-09-26T12:03', localite: 'Périphérie ouest', lieu: 'Route de contournement', offset: [-0.033, -0.084], type: 'Incident matériel', gravite: 'faible', source: 'manuel', statut: 'a_examiner' },
  { id: 'INC-113', date: '25/09/2026', heure: '17:36', ts: '2026-09-25T17:36', localite: 'Centre-ville', lieu: 'Rond-point central', offset: [0.014, -0.026], type: 'Freinage brusque', gravite: 'moyenne', source: 'boitier', boitier: 'SR-03', statut: 'en_cours' },
  { id: 'INC-114', date: '24/09/2026', heure: '20:14', ts: '2026-09-24T20:14', localite: 'Sortie nord', lieu: 'Sortie ville — RN4', offset: [0.088, 0.036], type: 'Autre', gravite: 'autre', source: 'boitier', boitier: 'SR-05', statut: 'cloture' },
  { id: 'INC-115', date: '24/09/2026', heure: '06:52', ts: '2026-09-24T06:52', localite: 'Axe principal', lieu: 'RN3 – Km 12', offset: [0.023, 0.05], type: 'Accident signalé', gravite: 'critique', source: 'boitier', boitier: 'SR-01', statut: 'a_examiner' },
  { id: 'INC-116', date: '23/09/2026', heure: '13:29', ts: '2026-09-23T13:29', localite: 'Centre-ville', lieu: 'Marché central', offset: [-0.008, 0.034], type: 'Excès de vitesse', gravite: 'elevee', source: 'boitier', boitier: 'SR-02', statut: 'cloture' },
]

/**
 * Tendances sur quelques périodes récentes, pour la petite courbe (sparkline)
 * de chaque carte KPI — un agrégat temporel qui ne se déduit pas de la seule
 * liste d'incidents ci-dessus (qui ne couvre qu'un instantané). Démonstration.
 */
export const KPI_TRENDS = {
  total: [19, 21, 24, 22, 26, 25, 28],
  aExaminer: [4, 6, 5, 7, 6, 8, 9],
  enCours: [5, 6, 7, 6, 7, 7, 8],
  clotures: [8, 7, 9, 10, 9, 10, 11],
}
