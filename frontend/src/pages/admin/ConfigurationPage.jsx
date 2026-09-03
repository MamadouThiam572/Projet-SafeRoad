import { useState } from 'react'
import { ErrorState } from '../../components/communs/ErrorState'
import { Loader } from '../../components/communs/Loader'
import { PageHeader } from '../../components/communs/PageHeader'
import { useRequete } from '../../hooks/useRequete'
import { useToast } from '../../hooks/useToast'
import { mettreAJourConfiguration, obtenirConfiguration } from '../../services/configurationService'

const CHAMPS = [
  { nom: 'seuil_acceleration_critique', label: 'Seuil accélération critique (m/s²)' },
  { nom: 'seuil_vitesse_choc', label: 'Seuil vitesse de choc (km/h)' },
  { nom: 'rayon_clustering_metres', label: 'Rayon de clustering (mètres)' },
  { nom: 'min_incidents_pour_zone', label: "Nombre minimum d'incidents pour créer une zone" },
  { nom: 'rayon_alerte_proximite_metres', label: "Rayon d'alerte de proximité (mètres)" },
  { nom: 'intervalle_sync_secondes', label: 'Intervalle de synchronisation (secondes)' },
  { nom: 'cooldown_alerte_proximite_minutes', label: 'Cooldown alerte de proximité (minutes)' },
  { nom: 'duree_grace_regeneration_cle_heures', label: 'Fenêtre de grâce après régénération de clé boîtier (heures)' },
]

export function ConfigurationPage() {
  const { donnees: configuration, chargement, erreur, rafraichir, setDonnees } = useRequete(obtenirConfiguration)
  const { succes } = useToast()
  const [enregistrement, setEnregistrement] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setEnregistrement(true)
    try {
      const misAJour = await mettreAJourConfiguration(configuration)
      setDonnees(misAJour)
      succes('Configuration enregistrée.')
    } finally {
      setEnregistrement(false)
    }
  }

  return (
    <>
      <PageHeader
        titre="Configuration système"
        icone="configuration"
        description="Réglez les seuils de détection des incidents, le clustering des zones et les alertes de proximité."
      />

      {chargement && <Loader />}
      {erreur && !chargement && <ErrorState onReessayer={rafraichir} />}

      {configuration && !chargement && !erreur && (
        <form onSubmit={handleSubmit} className="surface-card p-4 form-etroit">
          {CHAMPS.map((champ) => (
            <div className="mb-3" key={champ.nom}>
              <label className="form-label" htmlFor={champ.nom}>{champ.label}</label>
              <input
                id={champ.nom}
                type="number"
                step="any"
                className="form-control"
                value={configuration[champ.nom]}
                onChange={(e) => setDonnees({ ...configuration, [champ.nom]: e.target.value })}
              />
            </div>
          ))}
          <button type="submit" className="btn btn-primary" disabled={enregistrement}>
            {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </form>
      )}
    </>
  )
}
