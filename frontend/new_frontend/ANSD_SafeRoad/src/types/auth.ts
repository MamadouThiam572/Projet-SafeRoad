export type UserRole = 'conducteur' | 'sous_admin' | 'super_admin' | 'anaser'

export interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  region?: string
}
