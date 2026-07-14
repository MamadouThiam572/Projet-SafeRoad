import { useContext } from 'react'
import { AdminContext } from '../context/AdminContext'

export function useAdmin() {
  const contexte = useContext(AdminContext)
  if (!contexte) {
    throw new Error('useAdmin doit être utilisé à l\'intérieur de <AdminProvider>')
  }
  return contexte
}
