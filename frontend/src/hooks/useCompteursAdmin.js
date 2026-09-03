import { useContext } from 'react'
import { CompteursAdminContext } from '../context/CompteursAdminContext'

export function useCompteursAdmin() {
  const contexte = useContext(CompteursAdminContext)
  if (!contexte) {
    throw new Error('useCompteursAdmin doit être utilisé à l\'intérieur de <CompteursAdminProvider>')
  }
  return contexte
}
