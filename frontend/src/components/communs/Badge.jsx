const VARIANTES = {
  faible: 'success',
  moyen: 'warning',
  eleve: 'dark',
  critique: 'danger',
  en_attente: 'secondary',
  validee: 'success',
  rejetee: 'danger',
  nouvelle: 'danger',
  vue: 'warning',
  traitee: 'success',
}

export function Badge({ valeur }) {
  const variante = VARIANTES[valeur] || 'secondary'
  return <span className={`badge bg-${variante}`}>{valeur}</span>
}
