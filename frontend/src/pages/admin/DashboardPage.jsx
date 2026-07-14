import { Badge } from '../../components/communs/Badge'
import { EmptyState } from '../../components/communs/EmptyState'
import { ErrorState } from '../../components/communs/ErrorState'
import { Loader } from '../../components/communs/Loader'
import { Panneau } from '../../components/communs/Panneau'
import { PageHeader } from '../../components/communs/PageHeader'
import { StatTile } from '../../components/communs/StatTile'
import { useRequete } from '../../hooks/useRequete'
import { listerAlertes } from '../../services/alertesService'
import { statistiquesDashboard } from '../../services/statistiquesService'
import { listerZones } from '../../services/zonesService'

function chargerDashboard() {
  return Promise.all([statistiquesDashboard(), listerZones(), listerAlertes()]).then(
    ([statistiques, zones, alertes]) => ({ statistiques, zones, alertes }),
  )
}

export function DashboardPage() {
  const { donnees, chargement, erreur, rafraichir } = useRequete(chargerDashboard)

  return (
    <>
      <PageHeader
        titre="Tableau de bord"
        icone="tableau"
        description="Vue d'ensemble de l'activité SafeRoad : incidents enregistrés, zones à valider et alertes à traiter."
      />
      {chargement && <Loader />}
      {erreur && !chargement && <ErrorState onReessayer={rafraichir} />}
      {donnees && !chargement && !erreur && <TableauDeBord donnees={donnees} />}
    </>
  )
}

function TableauDeBord({ donnees }) {
  const { statistiques, zones, alertes } = donnees

  const globales = statistiques.filter((s) => !s.zone && !s.type_incident)
  const totalIncidents = globales.reduce((acc, s) => acc + s.nombre_incidents, 0)
  const totalCritiques = globales.reduce((acc, s) => acc + (s.nombre_incidents_critiques ?? 0), 0)
  const zonesEnAttente = zones.filter((z) => z.statut_validation === 'en_attente')
  const alertesNouvelles = alertes.filter((a) => a.statut === 'nouvelle')

  return (
    <>
      <div className="stat-grid">
        <StatTile label="Incidents enregistrés" valeur={totalIncidents} icone="incidents" stripe="var(--ink)" />
        <StatTile
          label="Incidents critiques"
          valeur={totalCritiques}
          icone="alerte"
          stripe="var(--danger-critique)"
        />
        <StatTile
          label="Zones en attente"
          valeur={zonesEnAttente.length}
          icone="zone"
          stripe="var(--danger-moyen)"
          lien={{ to: '/admin/zones', libelle: 'Valider les zones' }}
        />
        <StatTile
          label="Alertes nouvelles"
          valeur={alertesNouvelles.length}
          icone="alerte"
          stripe="var(--danger-critique)"
          lien={{ to: '/admin/alertes', libelle: 'Traiter les alertes' }}
        />
      </div>

      <div className="panneaux-grille">
        <Panneau
          icone="zone"
          titre="Zones en attente de validation"
          compteur={zonesEnAttente.length}
          lien="/admin/zones"
        >
          {zonesEnAttente.length === 0 ? (
            <EmptyState
              icone="zone"
              titre="Aucune zone en attente"
              message="Toutes les zones détectées ont été traitées."
            />
          ) : (
            <ul className="liste-compacte">
              {zonesEnAttente.slice(0, 5).map((zone) => (
                <li key={zone.id}>
                  <span className="liste-compacte__nom">{zone.nom || `Zone #${zone.id}`}</span>
                  <span className="d-inline-flex align-items-center gap-2">
                    <span className="liste-compacte__meta font-mono">{zone.nombre_incidents} incid.</span>
                    <Badge valeur={zone.niveau_danger} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panneau>

        <Panneau
          icone="alerte"
          titre="Alertes nouvelles"
          compteur={alertesNouvelles.length}
          lien="/admin/alertes"
        >
          {alertesNouvelles.length === 0 ? (
            <EmptyState
              icone="alerte"
              titre="Aucune alerte nouvelle"
              message="Aucune alerte critique n'est en attente de traitement."
            />
          ) : (
            <ul className="liste-compacte">
              {alertesNouvelles.slice(0, 5).map((alerte) => (
                <li key={alerte.id}>
                  <span className="liste-compacte__nom font-mono">Incident #{alerte.incident}</span>
                  <span className="d-inline-flex align-items-center gap-2">
                    <span className="liste-compacte__meta font-mono">
                      {new Date(alerte.date_creation).toLocaleDateString('fr-FR')}
                    </span>
                    <Badge valeur={alerte.statut} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panneau>
      </div>
    </>
  )
}
