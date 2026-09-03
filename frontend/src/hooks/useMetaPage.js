import { useEffect } from 'react'

const SUFFIXE = ' · SafeRoad'
const SITE_URL = import.meta.env.VITE_SITE_URL ?? ''

function definirBalise(selecteur, creer) {
  let balise = document.querySelector(selecteur)
  if (!balise) {
    balise = creer()
    document.head.appendChild(balise)
  }
  return balise
}

// Titre d'onglet + meta description par page (SEO et lisibilité multi-onglets) : sans
// ça, les 3 pages publiques partageaient toutes le même <title> statique de index.html.
// `chemin` sert à tenir la balise canonical à jour (une URL canonique par route, pas
// une seule pour tout le site).
export function useMetaPage({ titre, description, chemin }) {
  useEffect(() => {
    document.title = titre ? `${titre}${SUFFIXE}` : 'SafeRoad'

    if (description) {
      const balise = definirBalise('meta[name="description"]', () => {
        const el = document.createElement('meta')
        el.setAttribute('name', 'description')
        return el
      })
      balise.setAttribute('content', description)

      const ogDescription = document.querySelector('meta[property="og:description"]')
      if (ogDescription) ogDescription.setAttribute('content', description)
    }

    if (titre) {
      const ogTitre = document.querySelector('meta[property="og:title"]')
      if (ogTitre) ogTitre.setAttribute('content', `${titre}${SUFFIXE}`)
    }

    if (chemin && SITE_URL) {
      const canonical = definirBalise('link[rel="canonical"]', () => {
        const el = document.createElement('link')
        el.setAttribute('rel', 'canonical')
        return el
      })
      canonical.setAttribute('href', `${SITE_URL}${chemin}`)

      const ogUrl = document.querySelector('meta[property="og:url"]')
      if (ogUrl) ogUrl.setAttribute('content', `${SITE_URL}${chemin}`)
    }
  }, [titre, description, chemin])
}
