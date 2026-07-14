import { useCallback, useEffect, useState } from 'react'

// Standardise le cycle chargement / erreur / rafraîchissement d'un appel API.
// `requete` : fonction () => Promise. `dependances` : relance l'appel quand elles changent.
// Retourne { donnees, chargement, erreur, rafraichir, setDonnees }.
export function useRequete(requete, dependances = []) {
  const [donnees, setDonnees] = useState(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  // `requete` est recréée à chaque rendu : on mémoïse sur `dependances` fournies.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const executer = useCallback(requete, dependances)

  const rafraichir = useCallback(() => {
    setChargement(true)
    setErreur(null)
    return executer()
      .then((resultat) => {
        setDonnees(resultat)
        return resultat
      })
      .catch((e) => {
        setErreur(e)
        throw e
      })
      .finally(() => setChargement(false))
  }, [executer])

  useEffect(() => {
    rafraichir().catch(() => {})
  }, [rafraichir])

  return { donnees, chargement, erreur, rafraichir, setDonnees }
}
