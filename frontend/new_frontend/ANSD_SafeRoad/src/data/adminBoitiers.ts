export type StatutAdmin = 'actif' | 'inactif'
export type Affectation = 'affecte' | 'non_affecte'

export const STATUT_META: Record<StatutAdmin, { label: string; className: string }> = {
  actif: { label: 'Actif', className: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200' },
  inactif: { label: 'Inactif', className: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200' },
}

export const AFFECTATION_META: Record<Affectation, { label: string; className: string }> = {
  affecte: { label: 'Affecté', className: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200' },
  non_affecte: { label: 'Non affecté', className: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200' },
}

export interface AffectationHistoryEntry {
  date: string // JJ/MM/AAAA
  heure: string
  texte: string
  administrateur: string
}

export interface Boitier {
  id: string // SR-BOX-001
  uuid: string
  apiKey: string
  statut: StatutAdmin
  dateEnregistrement: string // JJ/MM/AAAA
  conducteur?: string
  /**
   * Suffixe de la plaque, SANS le préfixe régional (ex. "1234-AA").
   * Le préfixe ("DL-", "DK-"…) dépend de la région du compte connecté et
   * est ajouté à l'affichage via regionPlatePrefix() — pour qu'un boîtier
   * affiché par un administrateur de Diourbel ne montre jamais une plaque
   * "DK-" (Dakar), quelle que soit la région réellement connectée.
   */
  vehicule?: string
  derniereAffectation?: string // JJ/MM/AAAA HH:mm
  derniereAffectationTs?: string // ISO, utilisé pour le tri
  historique: AffectationHistoryEntry[]
}

export function affectation(b: Boitier): Affectation {
  return b.conducteur ? 'affecte' : 'non_affecte'
}

export const BOITIERS: Boitier[] = [
  {
    id: 'SR-BOX-001',
    uuid: 'a8f3e2d4-1c7b-4f9a-9c2d-5e6f7a8b9c0d',
    apiKey: 'sr_live_7f2a9c3e8b1d4f6a0c5e2b9d7a3f1e8c',
    statut: 'actif',
    dateEnregistrement: '03/09/2026',
    conducteur: 'Aminata Diop',
    vehicule: '1234-AA',
    derniereAffectation: '03/10/2026 10:25',
    derniereAffectationTs: '2026-10-03T10:25:00',
    historique: [
      { date: '10/09/2026', heure: '09:45', texte: 'Boîtier enregistré', administrateur: 'A. Ndiaye' },
      { date: '20/09/2026', heure: '16:10', texte: 'Désaffecté de Mamadou Fall', administrateur: 'A. Ndiaye' },
      { date: '03/10/2026', heure: '10:25', texte: 'Affecté à Aminata Diop', administrateur: 'A. Ndiaye' },
    ],
  },
  {
    id: 'SR-BOX-002',
    uuid: 'b72c9e11-5d4a-4e2f-8b6c-1a9d3e7f5c2b',
    apiKey: 'sr_live_3b8d1a6c9e4f2b7a5d0c8e3b1f6a9c4d',
    statut: 'actif',
    dateEnregistrement: '05/09/2026',
    historique: [{ date: '05/09/2026', heure: '11:20', texte: 'Boîtier enregistré', administrateur: 'A. Ndiaye' }],
  },
  {
    id: 'SR-BOX-003',
    uuid: 'c91d4f32-8e6b-4a11-9d5c-7b2e8a4f1c9d',
    apiKey: 'sr_live_9e4c2a7d8b1f3e6a0c9d5b2f7a4e1c8b',
    statut: 'inactif',
    dateEnregistrement: '02/09/2026',
    conducteur: 'Mamadou Fall',
    vehicule: '5678-BB',
    derniereAffectation: '28/09/2026 16:40',
    derniereAffectationTs: '2026-09-28T16:40:00',
    historique: [
      { date: '02/09/2026', heure: '08:30', texte: 'Boîtier enregistré', administrateur: 'A. Ndiaye' },
      { date: '28/09/2026', heure: '16:40', texte: 'Affecté à Mamadou Fall', administrateur: 'A. Ndiaye' },
      { date: '30/09/2026', heure: '09:00', texte: 'Statut administratif passé à Inactif (anomalie technique)', administrateur: 'A. Ndiaye' },
    ],
  },
  {
    id: 'SR-BOX-004',
    uuid: 'd5e8a9c7-2f1e-4d98-8b3a-6c9e2d5f8a1c',
    apiKey: 'sr_live_1a6d9c3b7e2f4a8d0b5c9e3a7f1d4b6c',
    statut: 'actif',
    dateEnregistrement: '06/09/2026',
    conducteur: 'Fatou Ndiaye',
    vehicule: '9012-AA',
    derniereAffectation: '02/10/2026 09:18',
    derniereAffectationTs: '2026-10-02T09:18:00',
    historique: [
      { date: '06/09/2026', heure: '14:05', texte: 'Boîtier enregistré', administrateur: 'A. Ndiaye' },
      { date: '02/10/2026', heure: '09:18', texte: 'Affecté à Fatou Ndiaye', administrateur: 'A. Ndiaye' },
    ],
  },
  {
    id: 'SR-BOX-005',
    uuid: 'f3a7c6e2-9b4d-4f11-8c6a-2e9d5b7f3a1c',
    apiKey: 'sr_live_5c2e8b4a9d1f6c3e7a0b9d4f2c8e5a1b',
    statut: 'actif',
    dateEnregistrement: '07/09/2026',
    historique: [{ date: '07/09/2026', heure: '10:00', texte: 'Boîtier enregistré', administrateur: 'A. Ndiaye' }],
  },
  {
    id: 'SR-BOX-006',
    uuid: 'e19d2a77-6c5f-4e3b-9a2d-8c5e1b4f7a9d',
    apiKey: 'sr_live_8b3f6a9c2e7d4b1a5c8e0d3f9a6b2c7e',
    statut: 'actif',
    dateEnregistrement: '04/09/2026',
    conducteur: 'Ousmane Ba',
    vehicule: '3456-CC',
    derniereAffectation: '01/10/2026 14:52',
    derniereAffectationTs: '2026-10-01T14:52:00',
    historique: [
      { date: '04/09/2026', heure: '09:12', texte: 'Boîtier enregistré', administrateur: 'A. Ndiaye' },
      { date: '01/10/2026', heure: '14:52', texte: 'Affecté à Ousmane Ba', administrateur: 'A. Ndiaye' },
    ],
  },
  {
    id: 'SR-BOX-007',
    uuid: 'a7f9d3c1-8b2e-4f0a-9d6c-3e8a5b1f7c9d',
    apiKey: 'sr_live_4e9a1c6d8b3f2e7a5c0d9b4f1a8e6c3b',
    statut: 'actif',
    dateEnregistrement: '08/09/2026',
    historique: [{ date: '08/09/2026', heure: '15:40', texte: 'Boîtier enregistré', administrateur: 'A. Ndiaye' }],
  },
  {
    id: 'SR-BOX-008',
    uuid: 'c3e6b5d9-7a1f-4d6e-8b9c-5a2d8f3e1c7b',
    apiKey: 'sr_live_6d1b8a3e9c4f7a2d0b6e5c9a3f8d1b4c',
    statut: 'inactif',
    dateEnregistrement: '03/09/2026',
    conducteur: 'Pape Diop',
    vehicule: '7788-EE',
    derniereAffectation: '20/09/2026 11:07',
    derniereAffectationTs: '2026-09-20T11:07:00',
    historique: [
      { date: '03/09/2026', heure: '08:50', texte: 'Boîtier enregistré', administrateur: 'A. Ndiaye' },
      { date: '20/09/2026', heure: '11:07', texte: 'Affecté à Pape Diop', administrateur: 'A. Ndiaye' },
      { date: '22/09/2026', heure: '17:30', texte: 'Statut administratif passé à Inactif (batterie défectueuse)', administrateur: 'A. Ndiaye' },
    ],
  },
  {
    id: 'SR-BOX-009',
    uuid: 'd8b7e0f3-5c4a-4f92-8d1c-9b6e3a7f2d5c',
    apiKey: 'sr_live_2f7c9a4e1b8d6c3a0e5b9d2f7c4a8e1b',
    statut: 'actif',
    dateEnregistrement: '09/09/2026',
    historique: [{ date: '09/09/2026', heure: '12:15', texte: 'Boîtier enregistré', administrateur: 'A. Ndiaye' }],
  },
  {
    id: 'SR-BOX-010',
    uuid: 'f6c1a4b2-3e9d-4a73-8e5c-1d9b6a2f8c4e',
    apiKey: 'sr_live_0b5d8c2a6e9f3b1d7a4c0e8b5d2f9a6c',
    statut: 'actif',
    dateEnregistrement: '05/09/2026',
    conducteur: 'Aïssatou Diallo',
    vehicule: '6622-DD',
    derniereAffectation: '03/10/2026 08:45',
    derniereAffectationTs: '2026-10-03T08:45:00',
    historique: [
      { date: '05/09/2026', heure: '10:30', texte: 'Boîtier enregistré', administrateur: 'A. Ndiaye' },
      { date: '03/10/2026', heure: '08:45', texte: 'Affecté à Aïssatou Diallo', administrateur: 'A. Ndiaye' },
    ],
  },
  {
    id: 'SR-BOX-011',
    uuid: 'b4f8e2a6-9c3d-4b71-8e5a-2f9c6b3e8a1d',
    apiKey: 'sr_live_7a1e4c8b2d9f6a3c0e7b5d1f9a4c8e2b',
    statut: 'actif',
    dateEnregistrement: '11/09/2026',
    conducteur: 'Cheikh Fall',
    vehicule: '2803-IJ',
    derniereAffectation: '29/09/2026 13:10',
    derniereAffectationTs: '2026-09-29T13:10:00',
    historique: [
      { date: '11/09/2026', heure: '09:00', texte: 'Boîtier enregistré', administrateur: 'A. Ndiaye' },
      { date: '29/09/2026', heure: '13:10', texte: 'Affecté à Cheikh Fall', administrateur: 'A. Ndiaye' },
    ],
  },
  {
    id: 'SR-BOX-012',
    uuid: 'e2a9f5c8-6b3e-4d0a-9f2c-8b5e1a4d7c9f',
    apiKey: 'sr_live_3d9b6a1e8c4f2d7a0b5e9c3a6f1d8b4e',
    statut: 'actif',
    dateEnregistrement: '12/09/2026',
    historique: [{ date: '12/09/2026', heure: '16:20', texte: 'Boîtier enregistré', administrateur: 'A. Ndiaye' }],
  },
  {
    id: 'SR-BOX-013',
    uuid: 'c7b4e9a2-3f8d-4c61-9a5e-7d2b8f4c1e6a',
    apiKey: 'sr_live_9c2e7a4d1b8f6c3e0a5d9b2f4a7c1e8b',
    statut: 'inactif',
    dateEnregistrement: '13/09/2026',
    conducteur: 'Moussa Diop',
    vehicule: '4471-EF',
    derniereAffectation: '25/09/2026 10:30',
    derniereAffectationTs: '2026-09-25T10:30:00',
    historique: [
      { date: '13/09/2026', heure: '11:45', texte: 'Boîtier enregistré', administrateur: 'A. Ndiaye' },
      { date: '25/09/2026', heure: '10:30', texte: 'Affecté à Moussa Diop', administrateur: 'A. Ndiaye' },
      { date: '27/09/2026', heure: '14:00', texte: 'Statut administratif passé à Inactif (hors service)', administrateur: 'A. Ndiaye' },
    ],
  },
  {
    id: 'SR-BOX-014',
    uuid: 'a9d2c6e4-7b1f-4a83-8c6d-3e9f2b5a8c1d',
    apiKey: 'sr_live_1f8a5c2e9b6d3f0a7c4e1b9d6a3f8c5e',
    statut: 'actif',
    dateEnregistrement: '14/09/2026',
    conducteur: 'Ibrahima Sarr',
    vehicule: '2145-AB',
    derniereAffectation: '30/09/2026 17:05',
    derniereAffectationTs: '2026-09-30T17:05:00',
    historique: [
      { date: '14/09/2026', heure: '08:15', texte: 'Boîtier enregistré', administrateur: 'A. Ndiaye' },
      { date: '30/09/2026', heure: '17:05', texte: 'Affecté à Ibrahima Sarr', administrateur: 'A. Ndiaye' },
    ],
  },
]

export const KPI_TRENDS = {
  total: [10, 10, 11, 11, 12, 13, 14],
  affectes: [5, 6, 6, 7, 7, 8, 9],
  nonAffectes: [5, 4, 5, 4, 5, 5, 5],
  actifs: [8, 8, 9, 9, 10, 11, 11],
}
