const CLASSES = {
  normale: 'badge-danger-normale',
  vigilance: 'badge-danger-vigilance',
  critique: 'badge-danger-critique',
  en_attente: 'badge-statut-neutre',
  validee: 'badge-danger-normale',
  rejetee: 'badge-danger-critique',
  nouvelle: 'badge-danger-critique',
  vue: 'badge-danger-vigilance',
  traitee: 'badge-danger-normale',
  soumise: 'badge-statut-neutre',
  en_cours: 'badge-danger-vigilance',
  realisee: 'badge-danger-normale',
}

export function Badge({ valeur }) {
  const classe = CLASSES[valeur] || 'badge-statut-neutre'
  return <span className={`badge ${classe}`}>{valeur}</span>
}
