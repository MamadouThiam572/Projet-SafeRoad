import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/lib/api'

/**
 * Données du backend rechargées toutes les `intervalleMs` (supervision des boîtiers, incidents
 * en direct). `maj` = instant (ms) de la dernière réponse reçue : il sert d'ancre pour calculer
 * les « il y a … ». Une erreur réseau garde les dernières données affichées. `charger` doit être
 * une fonction stable (définie hors du composant, ex. getBoitiers).
 */
export function useEnDirect<T>(charger: () => Promise<T>, intervalleMs = 5000) {
  const [donnees, setDonnees] = useState<T | null>(null)
  const [erreur, setErreur] = useState('')
  const [maj, setMaj] = useState(() => Date.now())

  const recharger = useCallback(async () => {
    try {
      const resultat = await charger()
      setDonnees(resultat)
      setErreur('')
      setMaj(Date.now())
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Serveur injoignable : vérifiez que le backend est lancé.')
    }
  }, [charger])

  useEffect(() => {
    void recharger()
    const id = setInterval(() => void recharger(), intervalleMs)
    return () => clearInterval(id)
  }, [recharger, intervalleMs])

  return { donnees, erreur, maj, recharger }
}
