import { Link } from 'react-router-dom'
import { Badge } from '../../components/communs/Badge'
import { CarteZones } from '../../components/carte/CarteZones'
import { EmptyState } from '../../components/communs/EmptyState'
import { ErrorState } from '../../components/communs/ErrorState'
import { PageHeader } from '../../components/communs/PageHeader'
import { SkeletonLignes } from '../../components/communs/Skeleton'
import { useRequete } from '../../hooks/useRequete'
import { listerZones } from '../../services/zonesService'

export function AnaserZonesPage() {
  const { donnees: zones, chargement, erreur, rafraichir } = useRequete(listerZones)

  return (
    <>
      <PageHeader
        titre="Zones accidentogènes"
        icone="zone"
        description="Zones à risque détectées à partir des incidents, triées par score de danger décroissant."
      />

      {erreur && !chargement && <ErrorState onReessayer={rafraichir} />}

      {!erreur && !chargement && zones && zones.length === 0 && (
        <div className="surface-card">
          <EmptyState
            icone="zone"
            titre="Aucune zone détectée"
            message="Aucune zone accidentogène n'a encore été identifiée."
          />
        </div>
      )}

      {!erreur && (chargement || (zones && zones.length > 0)) && (
        <>
          {!chargement && (
            <div className="surface-card p-2 mb-4" style={{ overflow: 'hidden' }}>
              <CarteZones zones={zones} />
            </div>
          )}
          <div className="surface-card overflow-hidden">
            <div style={{ overflowX: 'auto' }}>
              <table className="table table-striped mb-0">
                <caption className="visually-hidden">Zones accidentogènes identifiées</caption>
                <thead>
                  <tr>
                    <th>Zone</th>
                    <th>Niveau de danger</th>
                    <th>Incidents</th>
                    <th>Statut</th>
                    <th><span className="visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {chargement ? <SkeletonLignes colonnes={5} lignes={4} /> : zones.map((zone) => {
                    const nom = zone.nom || `Zone #${zone.id}`
                    return (
                      <tr key={zone.id}>
                        <td>{nom}</td>
                        <td><Badge valeur={zone.niveau_danger} libelle={zone.niveau_danger_libelle} /></td>
                        <td className="font-mono">{zone.nombre_incidents}</td>
                        <td><Badge valeur={zone.statut_validation} libelle={zone.statut_validation_libelle} /></td>
                        <td>
                          <Link
                            className="btn btn-sm btn-outline-secondary"
                            to={`/anaser/feedback?zone=${zone.id}`}
                            aria-label={`Proposer une action pour ${nom}`}
                          >
                            Proposer une action
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  )
}
