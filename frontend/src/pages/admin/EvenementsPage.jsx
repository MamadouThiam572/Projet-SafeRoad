import { Fragment, useState } from 'react'
import { Badge } from '../../components/communs/Badge'
import { EmptyState } from '../../components/communs/EmptyState'
import { ErrorState } from '../../components/communs/ErrorState'
import { Icone } from '../../components/communs/Icone'
import { PageHeader } from '../../components/communs/PageHeader'
import { Pagination } from '../../components/communs/Pagination'
import { SkeletonLignes } from '../../components/communs/Skeleton'
import { useRequete } from '../../hooks/useRequete'
import { listerBoitiers } from '../../services/boitiersService'
import { listerIncidents } from '../../services/incidentsService'
import { listerZones } from '../../services/zonesService'

// Capteurs bruts remontés avec chaque événement — tous nullable côté modèle (le boîtier
// n'a pas forcément tous les capteurs raccordés). Unités : km/h et m/s² alignées sur les
// seuils de ConfigurationPage ; °/s pour le gyroscope et cm pour le HC-SR04 (conventions
// standard de ces capteurs).
const CHAMPS_CAPTEURS = [
  { champ: 'vitesse_radar', label: 'Vitesse radar', unite: 'km/h' },
  { champ: 'acceleration_x', label: 'Accélération X', unite: 'm/s²' },
  { champ: 'acceleration_y', label: 'Accélération Y', unite: 'm/s²' },
  { champ: 'acceleration_z', label: 'Accélération Z', unite: 'm/s²' },
  { champ: 'gyro_x', label: 'Gyroscope X', unite: '°/s' },
  { champ: 'gyro_y', label: 'Gyroscope Y', unite: '°/s' },
  { champ: 'gyro_z', label: 'Gyroscope Z', unite: '°/s' },
  { champ: 'distance_hcsr04', label: 'Distance (HC-SR04)', unite: 'cm' },
  { champ: 'altitude', label: 'Altitude', unite: 'm' },
]

function formaterPosition(incident) {
  return `${incident.latitude.toFixed(4)}°, ${incident.longitude.toFixed(4)}°`
}

function lienOpenStreetMap(incident) {
  return `https://www.openstreetmap.org/?mlat=${incident.latitude}&mlon=${incident.longitude}#map=17/${incident.latitude}/${incident.longitude}`
}

export function EvenementsPage() {
  const [curseur, setCurseur] = useState(undefined)
  const [idOuvert, setIdOuvert] = useState(null)
  const { donnees: page, chargement, erreur, rafraichir } = useRequete(() => listerIncidents(curseur), [curseur])
  const { donnees: boitiers, erreur: erreurBoitiers } = useRequete(listerBoitiers)
  const { donnees: zones, erreur: erreurZones } = useRequete(listerZones)
  // Ces deux appels sont secondaires (identification boîtier/zone) : un échec ne doit pas
  // bloquer l'affichage des événements eux-mêmes, juste être signalé — sans ça, la page
  // dégraderait silencieusement vers des ID bruts sans que l'utilisateur sache pourquoi.
  const infosAssocieesIndisponibles = Boolean(erreurBoitiers || erreurZones)

  const incidents = page?.results ?? []
  const boitierParId = new Map((boitiers ?? []).map((b) => [b.id, b]))
  const zoneParId = new Map((zones ?? []).map((z) => [z.id, z]))

  function nomBoitier(id) {
    const boitier = boitierParId.get(id)
    if (!boitier) return `Boîtier ${id.slice(0, 8)}`
    return boitier.numero_immatriculation || `Boîtier ${id.slice(0, 8)}`
  }

  function basculerDetail(id) {
    setIdOuvert((actuel) => (actuel === id ? null : id))
  }

  return (
    <>
      <PageHeader
        titre="Événements"
        icone="incidents"
        description="Événements bruts remontés par les boîtiers embarqués, avec le détail des capteurs disponibles."
      />

      {erreur && !chargement && <ErrorState onReessayer={rafraichir} />}

      {!erreur && infosAssocieesIndisponibles && (
        <div className="alert alert-warning mb-3" role="alert">
          Certaines informations associées (identifiant boîtier et/ou zone) sont momentanément
          indisponibles. Les événements ci-dessous restent à jour, mais peuvent afficher un
          identifiant brut à la place du nom du boîtier ou de la zone.
        </div>
      )}

      {!erreur && !chargement && incidents.length === 0 && (
        <div className="surface-card">
          <EmptyState
            icone="incidents"
            titre="Aucun événement"
            message="Aucun événement n'a encore été remonté par un boîtier."
          />
        </div>
      )}

      {!erreur && (chargement || incidents.length > 0) && (
        <div className="surface-card overflow-hidden">
          <div style={{ overflowX: 'auto' }}>
            <table className="table table-striped mb-0">
              <caption className="visually-hidden">Événements remontés par les boîtiers, du plus récent au plus ancien</caption>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Boîtier</th>
                  <th>Position GPS</th>
                  <th>Gravité</th>
                  <th>Date / heure</th>
                  <th><span className="visually-hidden">Détail</span></th>
                </tr>
              </thead>
              <tbody>
                {chargement ? (
                  <SkeletonLignes colonnes={6} lignes={5} />
                ) : (
                  incidents.map((incident) => (
                    <Fragment key={incident.id}>
                      <tr>
                        <td>{incident.type_incident_libelle ?? incident.type_incident}</td>
                        <td className="font-mono">{nomBoitier(incident.boitier)}</td>
                        <td className="font-mono">{formaterPosition(incident)}</td>
                        <td><Badge valeur={incident.niveau_gravite} libelle={incident.niveau_gravite_libelle} /></td>
                        <td className="font-mono">{new Date(incident.horodatage).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => basculerDetail(incident.id)}
                            aria-expanded={idOuvert === incident.id}
                            aria-label={`${idOuvert === incident.id ? 'Masquer' : 'Afficher'} le détail de l'événement du ${new Date(incident.horodatage).toLocaleString('fr-FR')}`}
                          >
                            Détails
                            <Icone nom="fleche" taille={12} className={idOuvert === incident.id ? '-rotate-90' : 'rotate-90'} />
                          </button>
                        </td>
                      </tr>
                      {idOuvert === incident.id && (
                        <tr>
                          <td colSpan={6}>
                            <DetailEvenement incident={incident} zone={incident.zone ? zoneParId.get(incident.zone) : null} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!chargement && <Pagination pagination={page} onNaviguer={setCurseur} />}
        </div>
      )}
    </>
  )
}

function DetailEvenement({ incident, zone }) {
  const capteursDisponibles = CHAMPS_CAPTEURS.filter((c) => incident[c.champ] != null)

  return (
    <div className="evenement-detail">
      <div className="evenement-detail__section">
        <h3 className="evenement-detail__titre">Données capteurs</h3>
        {capteursDisponibles.length === 0 ? (
          <p className="text-sm text-ink-soft">Aucune donnée capteur disponible pour cet événement.</p>
        ) : (
          <dl className="evenement-detail__grille">
            {capteursDisponibles.map((c) => (
              <div key={c.champ} className="evenement-detail__champ">
                <dt>{c.label}</dt>
                <dd className="font-mono">{incident[c.champ]} {c.unite}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="evenement-detail__section">
        <h3 className="evenement-detail__titre">Contexte</h3>
        <dl className="evenement-detail__grille">
          <div className="evenement-detail__champ">
            <dt>Position</dt>
            <dd>
              <a href={lienOpenStreetMap(incident)} target="_blank" rel="noreferrer" className="font-mono">
                {formaterPosition(incident)} <Icone nom="lien-externe" taille={12} />
              </a>
            </dd>
          </div>
          {zone && (
            <div className="evenement-detail__champ">
              <dt>Zone</dt>
              <dd><Badge valeur={zone.niveau_danger} libelle={zone.niveau_danger_libelle} /> {zone.nom || `Zone #${zone.id}`}</dd>
            </div>
          )}
          <div className="evenement-detail__champ">
            <dt>Reçu le</dt>
            <dd className="font-mono">{new Date(incident.recu_le).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</dd>
          </div>
          <div className="evenement-detail__champ">
            <dt>Mode de réception</dt>
            <dd>{incident.synced ? 'Temps réel' : 'Synchronisation différée'}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
