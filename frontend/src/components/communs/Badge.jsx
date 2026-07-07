const CLASSES = {
  faible: 'badge-danger-faible',
  moyen: 'badge-danger-moyen',
  eleve: 'badge-danger-eleve',
  critique: 'badge-danger-critique',
  en_attente: 'badge-statut-neutre',
  validee: 'badge-danger-faible',
  rejetee: 'badge-danger-critique',
  nouvelle: 'badge-danger-critique',
  vue: 'badge-danger-moyen',
  traitee: 'badge-danger-faible',
}

export function Badge({ valeur }) {
  const classe = CLASSES[valeur] || 'badge-statut-neutre'
  return <span className={`badge ${classe}`}>{valeur}</span>
}
