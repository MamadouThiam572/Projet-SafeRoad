const CLASSES = {
  normale: 'badge-danger-normale',
  vigilance: 'badge-danger-vigilance',
  critique: 'badge-danger-critique',
  faible: 'badge-danger-normale',
  moyen: 'badge-danger-vigilance',
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

// `libelle` : texte humain à afficher (ex. zone.niveau_danger_libelle, exposé par le
// backend via get_*_display() sur les TextChoices). À défaut, on retombe sur la valeur
// brute — utile pour les rares valeurs encore sans libellé côté API.
export function Badge({ valeur, libelle }) {
  const classe = CLASSES[valeur] || 'badge-statut-neutre'
  return <span className={`badge ${classe}`}>{libelle ?? valeur}</span>
}
