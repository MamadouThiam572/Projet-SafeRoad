import { useContext } from 'react'
import { CompteursAnaserContext } from '../context/CompteursAnaserContext'

export function useCompteursAnaser() {
  const contexte = useContext(CompteursAnaserContext)
  if (!contexte) {
    throw new Error('useCompteursAnaser doit être utilisé à l\'intérieur de <CompteursAnaserProvider>')
  }
  return contexte
}
