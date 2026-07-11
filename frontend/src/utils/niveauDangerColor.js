// Alignées sur les tokens sémantiques de src/styles/tokens.css (--danger-*)
const COULEURS = {
  faible: '#2f9e5b',
  moyen: '#c98420',
  eleve: '#c05a1f',
  critique: '#b23a2e',
}

const LIBELLES = {
  faible: 'Faible',
  moyen: 'Moyen',
  eleve: 'Élevé',
  critique: 'Critique',
}

export function couleurNiveauDanger(niveau) {
  return COULEURS[niveau] || '#4a5a75'
}

export function libelleNiveauDanger(niveau) {
  return LIBELLES[niveau] || niveau
}
