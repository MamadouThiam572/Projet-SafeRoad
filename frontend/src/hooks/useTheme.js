import { useCallback, useState } from 'react'

// Miroir React de styles/theme-init.js : lit/écrit la même classe `.dark` sur <html>
// et la même clé localStorage, pour que le bouton de bascule reste synchronisé avec
// l'état posé avant le premier rendu.
export function useTheme() {
  const [sombre, setSombre] = useState(() => document.documentElement.classList.contains('dark'))

  const basculerTheme = useCallback(() => {
    setSombre((actuel) => {
      const nouveau = !actuel
      document.documentElement.classList.toggle('dark', nouveau)
      localStorage.setItem('saferoad-theme', nouveau ? 'sombre' : 'clair')
      return nouveau
    })
  }, [])

  return { sombre, basculerTheme }
}
