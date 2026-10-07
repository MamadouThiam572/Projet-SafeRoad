/**
 * Comptes administratifs que le Super Admin peut administrer (page Super Admin →
 * Utilisateurs) : Administrateurs régionaux (rôle `sous_admin` côté API) et ANASER.
 *
 * Ne figurent PAS dans cette liste :
 *  - le Super Admin connecté (déjà représenté dans l'en-tête ; il ne peut pas
 *    modifier ni désactiver son propre compte depuis cette page) ;
 *  - les conducteurs (leurs comptes se gèrent via l'inscription et la page Boîtiers).
 *
 * Les comptes ANASER ont une portée NATIONALE : leur région est toujours `null`.
 *
 * Données de démonstration — tous les totaux de la page (actifs, inactifs,
 * régions administrées…) sont calculés à partir de cette liste.
 * TODO backend : remplacer par la liste paginée des utilisateurs (filtres rôle /
 * région / statut / date) et par les endpoints de création, modification,
 * activation/désactivation et réinitialisation de mot de passe.
 */

export type StaffRole = 'sous_admin' | 'anaser'
export type UserStatus = 'actif' | 'inactif'

export interface StaffUser {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  role: StaffRole
  /** Slug de région (voir src/lib/regions.ts). `null` = « Toutes les régions » : toujours le cas des comptes ANASER. */
  region: string | null
  status: UserStatus
  /** AAAA-MM-JJTHH:mm (heure locale). */
  createdAt: string
  lastLogin?: string
}

export const ROLE_ORDER: StaffRole[] = ['sous_admin', 'anaser']

export const ROLE_META: Record<StaffRole, { label: string; icon: string; fg: string; bg: string }> = {
  sous_admin: { label: 'Administrateur régional', icon: 'badge', fg: '#7c3aed', bg: '#f1eafe' },
  anaser: { label: 'ANASER', icon: 'account_balance', fg: '#e8940c', bg: '#fdf4e6' },
}

type Seed = [string, string, string, string, StaffRole, string | null, UserStatus, string, string?]

const SEEDS: Seed[] = [
  // prénom, nom, email, téléphone, rôle, région, statut, création, dernière connexion
  ['Aminata', 'Diop', 'aminata.diop@saferoad.sn', '+221 77 210 45 18', 'sous_admin', 'dakar', 'actif', '2025-06-18T14:32', '2026-10-04T09:41'],
  ['Moussa', 'Sy', 'moussa.sy@saferoad.sn', '+221 78 311 02 67', 'sous_admin', 'thies', 'actif', '2025-06-25T09:17', '2026-10-03T16:20'],
  ['Fatou', 'Ndiaye', 'fatou.ndiaye@saferoad.sn', '+221 76 402 91 55', 'anaser', null, 'actif', '2025-07-02T16:03', '2026-10-02T11:08'],
  ['Ibrahima', 'Lô', 'ibrahima.lo@saferoad.sn', '+221 77 520 33 41', 'sous_admin', 'diourbel', 'actif', '2025-07-10T11:45', '2026-10-04T08:15'],
  ['Coumba', 'Mbacké', 'coumba.mbacke@saferoad.sn', '+221 70 631 12 09', 'sous_admin', 'saint_louis', 'inactif', '2025-07-15T08:22', '2026-08-19T10:30'],
  ['Ousmane', 'Ba', 'ousmane.ba@saferoad.sn', '+221 77 742 58 30', 'anaser', null, 'actif', '2025-07-21T13:07', '2026-10-01T15:47'],
  ['Ndeye', 'Tine', 'ndeye.tine@saferoad.sn', '+221 78 853 76 24', 'sous_admin', 'ziguinchor', 'actif', '2025-07-28T15:39', '2026-10-03T12:05'],
  ['Pape', 'Thiam', 'pape.thiam@saferoad.sn', '+221 77 964 10 82', 'sous_admin', 'kaolack', 'actif', '2025-08-04T09:50', '2026-10-04T07:58'],
  ['Awa', 'Gueye', 'awa.gueye@saferoad.sn', '+221 76 175 29 63', 'sous_admin', 'louga', 'actif', '2025-08-11T10:12', '2026-10-02T17:33'],
  ['Samba', 'Ndao', 'samba.ndao@saferoad.sn', '+221 77 286 47 90', 'sous_admin', 'tambacounda', 'actif', '2025-08-19T14:26', '2026-10-01T09:12'],
  ['Mariama', 'Faye', 'mariama.faye@saferoad.sn', '+221 78 397 58 01', 'sous_admin', 'fatick', 'actif', '2025-09-02T11:03', '2026-09-30T14:40'],
  ['Abdou', 'Sow', 'abdou.sow@saferoad.sn', '+221 77 408 69 12', 'sous_admin', 'kaffrine', 'actif', '2025-09-15T08:48', '2026-10-03T10:21'],
  ['Seynabou', 'Cissé', 'seynabou.cisse@saferoad.sn', '+221 70 519 70 23', 'sous_admin', 'kedougou', 'actif', '2025-10-06T16:15', '2026-09-28T13:09'],
  ['Alioune', 'Badji', 'alioune.badji@saferoad.sn', '+221 77 620 81 34', 'sous_admin', 'kolda', 'actif', '2025-10-20T09:37', '2026-10-02T08:44'],
  ['Ramatoulaye', 'Ba', 'ramatoulaye.ba@saferoad.sn', '+221 76 731 92 45', 'sous_admin', 'matam', 'actif', '2025-11-12T13:58', '2026-10-01T16:02'],
  ['Mamadou', 'Sané', 'mamadou.sane@saferoad.sn', '+221 78 842 03 56', 'sous_admin', 'sedhiou', 'actif', '2025-12-03T10:29', '2026-09-29T11:36'],
  ['Serigne', 'Mbaye', 'serigne.mbaye@saferoad.sn', '+221 77 953 14 67', 'anaser', null, 'inactif', '2026-01-14T15:11', '2026-05-22T09:18'],
  ['Khady', 'Seck', 'khady.seck@saferoad.sn', '+221 70 064 25 78', 'anaser', null, 'actif', '2026-03-09T12:44', '2026-10-03T18:27'],
]

export const INITIAL_STAFF_USERS: StaffUser[] = SEEDS.map(
  ([firstName, lastName, email, phone, role, region, status, createdAt, lastLogin], i) => ({
    id: `usr-${String(i + 1).padStart(3, '0')}`,
    firstName,
    lastName,
    email,
    phone,
    role,
    region,
    status,
    createdAt,
    lastLogin,
  }),
)

/**
 * Régions dont l'administrateur régional a un compte inactif : le Dashboard
 * national les signale comme « nécessitant une action ».
 */
export const REGIONS_WITH_INACTIVE_ADMIN: ReadonlySet<string> = new Set(
  INITIAL_STAFF_USERS.filter((u) => u.role === 'sous_admin' && u.status === 'inactif' && u.region).map((u) => u.region as string),
)
