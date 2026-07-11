import { useEffect, useState } from 'react'
import { Loader } from '../../components/communs/Loader'
import { mettreAJourConfiguration, obtenirConfiguration } from '../../services/configurationService'

const CHAMPS = [
  { nom: 'seuil_acceleration_critique', label: 'Seuil accélération critique (m/s²)' },
  { nom: 'seuil_vitesse_choc', label: 'Seuil vitesse de choc (km/h)' },
  { nom: 'rayon_clustering_metres', label: 'Rayon de clustering (mètres)' },
  { nom: 'min_incidents_pour_zone', label: "Nombre minimum d'incidents pour créer une zone" },
  { nom: 'rayon_alerte_proximite_metres', label: 'Rayon d\'alerte de proximité (mètres)' },
  { nom: 'intervalle_sync_secondes', label: 'Intervalle de synchronisation (secondes)' },
  { nom: 'cooldown_alerte_proximite_minutes', label: 'Cooldown alerte de proximité (minutes)' },
]

export function ConfigurationPage() {
  const [configuration, setConfiguration] = useState(null)
  const [chargement, setChargement] = useState(true)
  const [enregistrement, setEnregistrement] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    obtenirConfiguration().then(setConfiguration).finally(() => setChargement(false))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setEnregistrement(true)
    setMessage(null)
    try {
      const misAJour = await mettreAJourConfiguration(configuration)
      setConfiguration(misAJour)
      setMessage('Configuration enregistrée.')
    } finally {
      setEnregistrement(false)
    }
  }

  if (chargement || !configuration) return <Loader />

  return (
    <div className="container py-4" style={{ maxWidth: 600 }}>
      <h1 className="h4 mb-4">Configuration système</h1>
      {message && <div className="alert alert-success">{message}</div>}
      <form onSubmit={handleSubmit} className="surface-card p-4">
        {CHAMPS.map((champ) => (
          <div className="mb-3" key={champ.nom}>
            <label className="form-label">{champ.label}</label>
            <input
              type="number"
              step="any"
              className="form-control"
              value={configuration[champ.nom]}
              onChange={(e) => setConfiguration({ ...configuration, [champ.nom]: e.target.value })}
            />
          </div>
        ))}
        <button type="submit" className="btn btn-primary" disabled={enregistrement}>
          {enregistrement ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </form>
    </div>
  )
}
