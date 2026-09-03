import { createContext, useCallback, useRef, useState } from 'react'

export const ToastContext = createContext(null)

const DUREE_MS = 4500

// File de notifications éphémères (succès/erreur) partagée par toute l'app — remplace
// les messages de succès locaux dupliqués page par page (validation de zone, feedback
// ANASER, configuration enregistrée...). `role="status"`/`role="alert"` posés dans
// ToastViewport pour l'annonce aux lecteurs d'écran.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const prochainId = useRef(0)

  const retirer = useCallback((id) => {
    setToasts((actuels) => actuels.filter((t) => t.id !== id))
  }, [])

  const notifier = useCallback((type, message) => {
    const id = prochainId.current++
    setToasts((actuels) => [...actuels, { id, type, message }])
    setTimeout(() => retirer(id), DUREE_MS)
  }, [retirer])

  const valeur = {
    toasts,
    retirer,
    succes: (message) => notifier('succes', message),
    erreur: (message) => notifier('erreur', message),
  }

  return <ToastContext.Provider value={valeur}>{children}</ToastContext.Provider>
}
