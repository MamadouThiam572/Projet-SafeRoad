import { createContext, useEffect, useState } from 'react'
import { jwtDecode } from 'jwt-decode'
import * as authService from '../services/authService'
import { chargerRefreshTokenStocke, definirTokens, effacerTokens } from '../services/api'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [utilisateur, setUtilisateur] = useState(null)
  const [chargementInitial, setChargementInitial] = useState(true)

  useEffect(() => {
    const refresh = chargerRefreshTokenStocke()
    if (!refresh) {
      setChargementInitial(false)
      return
    }
    authService
      .rafraichirToken(refresh)
      .then((data) => {
        definirTokens({ access: data.access, refresh })
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

  function deconnecter() {
    effacerTokens()
    setUtilisateur(null)
  }

  return (
    <AuthContext.Provider
      value={{
        utilisateur,
        estAuthentifie: !!utilisateur,
        chargementInitial,
        connecter,
        deconnecter,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
