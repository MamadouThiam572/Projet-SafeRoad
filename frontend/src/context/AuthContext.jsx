import { createContext, useEffect, useState } from 'react'
import { jwtDecode } from 'jwt-decode'
import * as authService from '../services/authService'
import { chargerRefreshTokenStocke, definirTokens, effacerTokens, rafraichirSession } from '../services/api'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [utilisateur, setUtilisateur] = useState(null)
  const [chargementInitial, setChargementInitial] = useState(true)

  useEffect(() => {
    if (!chargerRefreshTokenStocke()) {
      setChargementInitial(false)
      return
    }
    // Passe par le même point d'entrée singleton que l'intercepteur 401 (voir services/api.js)
    // — le refresh token étant à usage unique, deux appels concurrents avec le même token
    // (React StrictMode qui double-invoque cet effet en dev, ou un simple second onglet)
    // feraient échouer l'un des deux et effaceraient la session que l'autre vient d'établir.
    rafraichirSession()
      .then((data) => {
        const decode = jwtDecode(data.access)
        setUtilisateur({ email: decode.email, role: decode.role, nom: decode.nom, prenom: decode.prenom })
      })
      .catch(() => effacerTokens())
      .finally(() => setChargementInitial(false))
  }, [])

  async function connecter(email, motDePasse) {
    const data = await authService.login(email, motDePasse)
    definirTokens({ access: data.access, refresh: data.refresh })
    setUtilisateur({ email: data.email, role: data.role, nom: data.nom, prenom: data.prenom })
    return data.role
  }

  // Après une modification du profil (voir ProfilPage) : évite un rechargement de page
  // pour que la topbar/sidebar reflètent immédiatement le nouveau nom/email affiché.
  function mettreAJourUtilisateur(partiel) {
    setUtilisateur((actuel) => (actuel ? { ...actuel, ...partiel } : actuel))
  }

  function deconnecter() {
    const refresh = chargerRefreshTokenStocke()
    effacerTokens()
    setUtilisateur(null)
    // Best-effort : la session locale est déjà effacée quoi qu'il arrive, on ne bloque
    // pas la déconnexion si l'appel réseau échoue (backend injoignable, token déjà expiré).
    if (refresh) authService.logout(refresh).catch(() => {})
  }

  return (
    <AuthContext.Provider
      value={{
        utilisateur,
        estAuthentifie: !!utilisateur,
        chargementInitial,
        connecter,
        deconnecter,
        mettreAJourUtilisateur,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
