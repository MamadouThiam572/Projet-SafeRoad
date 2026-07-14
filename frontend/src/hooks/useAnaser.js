import { useContext } from 'react'
import { AnaserContext } from '../context/AnaserContext'

export function useAnaser() {
  const contexte = useContext(AnaserContext)
  if (!contexte) {
    throw new Error('useAnaser doit être utilisé à l\'intérieur de <AnaserProvider>')
  }
  return contexte
}
