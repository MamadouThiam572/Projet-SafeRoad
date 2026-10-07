export const DRIVER_PROFILE = {
  name: 'Fatou Hélène Diatta',
  initials: 'FD',
  role: 'Conducteur',
  email: 'fatouhelendiatta@gmail.com',
  plate: 'DK-5566-EE',
  boxId: 'SR-041',
}

export interface ProfileField {
  key: string
  label: string
  value: string
  readonly?: boolean
}

/**
 * Champs du formulaire « Informations personnelles ». `plate` et `box` sont
 * en lecture seule : ils sont liés au boîtier IoT installé sur le véhicule
 * et ne se modifient pas depuis ce formulaire.
 */
export const PROFILE_FIELDS: ProfileField[] = [
  { key: 'name', label: 'Nom complet', value: 'Fatou Hélène Diatta' },
  { key: 'phone', label: 'Téléphone', value: '+221 77 123 45 67' },
  { key: 'email', label: 'Email', value: 'fatouhelendiatta@gmail.com' },
  { key: 'address', label: 'Adresse', value: 'Parcelles Assainies, Dakar' },
  { key: 'plate', label: 'Plaque d’immatriculation', value: 'DK-5566-EE', readonly: true },
  { key: 'box', label: 'Numéro de boîtier', value: 'SR-041', readonly: true },
]

export interface PrefToggle {
  key: string
  label: string
  desc: string
  defaultOn: boolean
}

export const PREF_TOGGLES: PrefToggle[] = [
  {
    key: 'critique',
    label: 'Alertes zones critiques',
    desc: 'Toujours recommandé sur les axes nationaux.',
    defaultOn: true,
  },
  {
    key: 'vigilance',
    label: 'Alertes zones de vigilance',
    desc: 'Prévenir aussi sur les risques modérés.',
    defaultOn: true,
  },
  {
    key: 'vocal',
    label: 'Annonce vocale',
    desc: 'Énoncer l’alerte à voix haute en conduisant.',
    defaultOn: false,
  },
  {
    key: 'nuit',
    label: 'Sensibilité renforcée la nuit',
    desc: 'Abaisser les seuils entre 20 h et 6 h.',
    defaultOn: true,
  },
]
