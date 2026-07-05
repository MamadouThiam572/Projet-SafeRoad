import { useContext } from 'react'
import { AuthContext } from '../context/AuthContext'

export function useAuth() {
  const contexte = useContext(AuthContext)
  if (!contexte) {
    throw new Error('useAuth doit être utilisé à l\'intérieur de <AuthProvider>')
  }
  return contexte
}
