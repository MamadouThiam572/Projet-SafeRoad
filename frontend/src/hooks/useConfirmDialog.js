import { useCallback, useRef, useState } from 'react'

// API impérative pour une confirmation destructrice : `demanderConfirmation({...})`
// renvoie une Promise<boolean>, résolue par le clic Confirmer/Annuler dans <ConfirmDialog>.
// Voir l'étude de correction : les actions irréversibles (régénérer une clé boîtier,
// rejeter une zone) ne doivent jamais s'exécuter au premier clic.
export function useConfirmDialog() {
  const [etatConfirmation, setEtatConfirmation] = useState(null)
  const resolveRef = useRef(null)

  const demanderConfirmation = useCallback((options) => {
    setEtatConfirmation(options)
    return new Promise((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  const repondre = useCallback((valeur) => {
    resolveRef.current?.(valeur)
    resolveRef.current = null
    setEtatConfirmation(null)
  }, [])

  return {
    etatConfirmation,
    demanderConfirmation,
    confirmer: () => repondre(true),
    annuler: () => repondre(false),
  }
}
