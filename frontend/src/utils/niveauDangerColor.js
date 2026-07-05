const COULEURS = {
  faible: '#28a745',
  moyen: '#ffc107',
  eleve: '#fd7e14',
  critique: '#dc3545',
}

export function couleurNiveauDanger(niveau) {
  return COULEURS[niveau] || '#6c757d'
}
