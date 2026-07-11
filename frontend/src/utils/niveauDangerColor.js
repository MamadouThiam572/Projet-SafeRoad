// Alignées sur les tokens sémantiques de src/styles/tokens.css (--danger-*)
const COULEURS = {
  normale: '#2f9e5b',
  vigilance: '#c98420',
  critique: '#b23a2e',
}

const LIBELLES = {
  normale: 'Normale',
  vigilance: 'Vigilance',
  critique: 'Critique',
}

export function couleurNiveauDanger(niveau) {
  return COULEURS[niveau] || '#4a5a75'
}

export function libelleNiveauDanger(niveau) {
  return LIBELLES[niveau] || niveau
}
