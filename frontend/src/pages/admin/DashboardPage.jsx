import { CarteBoitiers } from '../../components/carte/CarteBoitiers'
import { Badge } from '../../components/communs/Badge'
import { EmptyState } from '../../components/communs/EmptyState'
import { ErrorState } from '../../components/communs/ErrorState'
import { GraphiqueEvolution } from '../../components/communs/GraphiqueEvolution'
import { GraphiqueRepartition } from '../../components/communs/GraphiqueRepartition'
import { JaugeCirculaire } from '../../components/communs/JaugeCirculaire'
import { KpiCard } from '../../components/communs/KpiCard'
import { Panneau } from '../../components/communs/Panneau'
import { PageHeader } from '../../components/communs/PageHeader'
import { SkeletonKpiGrid } from '../../components/communs/Skeleton'
import { useRequete } from '../../hooks/useRequete'
import { listerAlertes } from '../../services/alertesService'
import { listerBoitiers } from '../../services/boitiersService'
import { statistiquesDashboard } from '../../services/statistiquesService'
import { listerZones } from '../../services/zonesService'
import { calculerTendance7Jours, couleurSeuil, historiqueChronologique } from '../../utils/kpi'

// Types d'incidents remontés par les boîtiers (voir Incident.TypeIncident côté backend) —
// libellés FR pour le graphique de répartition.
const LIBELLES_TYPE_INCIDENT = {
  freinage_brusque: 'Freinage brusque',
  choc_violent: 'Choc violent',
  collision: 'Collision',
  chute: 'Chute',
  autre: 'Autre',
}

function chargerDashboard() {
  return Promise.all([statistiquesDashboard(), listerZones(), listerAlertes(), listerBoitiers()]).then(
    ([statistiques, zones, alertes, boitiers]) => ({ statistiques, zones, alertes, boitiers }),
  )
}

export function DashboardPage() {
  const { donnees, chargement, erreur, rafraichir } = useRequete(chargerDashboard)

  return (
    <>
      {chargement && <SkeletonKpiGrid />}
      {erreur && !chargement && <ErrorState onReessayer={rafraichir} />}
      {donnees && !chargement && !erreur && <TableauDeBord donnees={donnees} />}
    </>
  )
}

function TableauDeBord({ donnees }) {
  const { statistiques, zones, alertes, boitiers } = donnees

  const globales = statistiques.filter((s) => !s.zone && !s.type_incident)
  const totalIncidents = globales.reduce((acc, s) => acc + s.nombre_incidents, 0)
  const totalCritiques = globales.reduce((acc, s) => acc + (s.nombre_incidents_critiques ?? 0), 0)
  const zonesEnAttente = zones.filter((z) => z.statut_validation === 'en_attente')
  const alertesNouvelles = alertes.filter((a) => a.statut === 'nouvelle')

  const tauxIncidentsCritiques = totalIncidents > 0 ? (totalCritiques / totalIncidents) * 100 : 0
  const tauxZonesCritiques = zones.length > 0
    ? (zones.filter((z) => z.niveau_danger === 'critique').length / zones.length) * 100
    : 0
  const tauxAlertesTraitees = alertes.length > 0
    ? ((alertes.length - alertesNouvelles.length) / alertes.length) * 100
    : 100
  const boitiersPositionnes = boitiers.filter((b) => b.derniere_latitude != null && b.derniere_longitude != null)
  const boitiersActifs = boitiers.filter((b) => b.statut === 'actif').length
  const tauxBoitiersActifs = boitiers.length > 0 ? (boitiersActifs / boitiers.length) * 100 : 100

  // Indicateur simple de santé du réseau : au moins un boîtier actif et aucun cas
  // dégradé (inactif/maintenance) → opérationnel ; aucun actif → hors service ; sinon
  // partiellement opérationnel. Pas de calcul si le parc est vide (rien à superviser).
  const etatReseau = boitiers.length === 0
    ? null
    : boitiersActifs === 0
      ? { libelle: 'Hors service', couleur: 'var(--danger-critique)' }
      : boitiersActifs === boitiers.length
        ? { libelle: 'Opérationnel', couleur: 'var(--danger-faible)' }
        : { libelle: 'Partiellement opérationnel', couleur: 'var(--danger-moyen)' }

  // Évolution 30 jours : agrégats globaux (zone=null, type=null), du plus ancien au plus récent.
  const evolution30j = [...globales].reverse().slice(-30).map((s) => ({
    date: s.date,
    total: s.nombre_incidents,
    critiques: s.nombre_incidents_critiques ?? 0,
  }))

  // Répartition par type sur la même fenêtre de 30 jours (agrégats zone=null, type renseigné) —
  // même jeu de dates que la courbe ci-dessus pour que les deux graphiques racontent la même période.
  const datesRetenues = new Set(evolution30j.map((d) => d.date))
  const parType = statistiques.filter((s) => !s.zone && s.type_incident && datesRetenues.has(s.date))
  const repartitionParType = Object.entries(LIBELLES_TYPE_INCIDENT)
    .map(([type, libelle]) => ({
      type,
      libelle,
      total: parType.filter((s) => s.type_incident === type).reduce((acc, s) => acc + s.nombre_incidents, 0),
    }))
    .filter((d) => d.total > 0)
    .sort((a, b) => b.total - a.total)

  // Valeur la plus récente disponible (globales est trié du plus récent au plus ancien, cf. API).
  const zonesActives = globales[0]?.nombre_zones_actives ?? 0

  return (
    <>
      <div className="stat-grid">
        <KpiCard
          label="Incidents enregistrés"
          valeur={totalIncidents}
          sousLabel="30 derniers jours"
          icone="incidents"
          couleur="var(--primary)"
          tendance={{ valeurPct: calculerTendance7Jours(globales, 'nombre_incidents'), sensBon: 'baisse' }}
          historique={historiqueChronologique(globales, 'nombre_incidents')}
        />
        <KpiCard
          label="Incidents critiques"
          valeur={totalCritiques}
          sousLabel="Nécessitent une vigilance"
          icone="alerte"
          couleur="var(--danger-critique)"
          tendance={{ valeurPct: calculerTendance7Jours(globales, 'nombre_incidents_critiques'), sensBon: 'baisse' }}
          historique={historiqueChronologique(globales, 'nombre_incidents_critiques')}
        />
        <KpiCard
          label="Zones en attente"
          valeur={zonesEnAttente.length}
          sousLabel="En attente de vérification"
          icone="zone"
          couleur="var(--danger-moyen)"
          urgent
          lien={{ to: '/admin/zones', libelle: 'Valider les zones' }}
        />
        <KpiCard
          label="Alertes nouvelles"
          valeur={alertesNouvelles.length}
          sousLabel="Incidents critiques non traités"
          icone="alerte"
          couleur="var(--danger-critique)"
          urgent
          lien={{ to: '/admin/alertes', libelle: 'Traiter les alertes' }}
        />
        <KpiCard
          label="Boîtiers actifs"
          valeur={`${boitiersActifs}/${boitiers.length}`}
          sousLabel="Boîtiers en ligne sur le parc total"
          icone="boitier"
          couleur={couleurSeuil(tauxBoitiersActifs, 'haut')}
          lien={{ to: '/admin/boitiers', libelle: 'Voir les boîtiers' }}
        />
      </div>

      <div className="mb-6">
        <Panneau icone="tableau" titre="Vue d'ensemble">
          <div className="jauges-grille">
            <JaugeCirculaire
              valeur={tauxIncidentsCritiques}
              libelle="Incidents critiques"
              couleur={couleurSeuil(tauxIncidentsCritiques, 'bas')}
            />
            <JaugeCirculaire
              valeur={tauxZonesCritiques}
              libelle="Zones critiques"
              couleur={couleurSeuil(tauxZonesCritiques, 'bas')}
            />
            <JaugeCirculaire
              valeur={tauxAlertesTraitees}
              libelle="Alertes traitées"
              couleur={couleurSeuil(tauxAlertesTraitees, 'haut')}
            />
          </div>
        </Panneau>
      </div>

      <div className="panneaux-grille mb-6">
        <Panneau
          icone="tendance-hausse"
          titre="Évolution des situations à risque"
          note={`${zonesActives} zone${zonesActives > 1 ? 's' : ''} active${zonesActives > 1 ? 's' : ''}`}
        >
          {evolution30j.length < 2 ? (
            <EmptyState
              icone="tendance-hausse"
              titre="Pas encore assez de données"
              message="L'évolution s'affichera dès que plusieurs jours de statistiques seront disponibles."
            />
          ) : (
            <GraphiqueEvolution donnees={evolution30j} />
          )}
        </Panneau>

        <Panneau icone="liste" titre="Répartition par type" compteur={repartitionParType.reduce((acc, d) => acc + d.total, 0)}>
          {repartitionParType.length === 0 ? (
            <EmptyState
              icone="liste"
              titre="Aucun incident sur la période"
              message="La répartition par type s'affichera dès qu'un incident sera enregistré."
            />
          ) : (
            <GraphiqueRepartition donnees={repartitionParType} />
          )}
        </Panneau>
      </div>

      <div className="panneaux-grille">
        <Panneau
          icone="boitier"
          titre="Supervision des boîtiers"
          lien="/admin/boitiers"
          note={etatReseau && (
            <span className="etat-reseau" style={{ '--couleur-etat': etatReseau.couleur }}>
              <span className="etat-reseau__puce" aria-hidden="true" />
              {etatReseau.libelle}
            </span>
          )}
        >
          {boitiers.length === 0 ? (
            <EmptyState
              icone="boitier"
              titre="Aucun boîtier enregistré"
              message="Le parc de boîtiers apparaîtra ici une fois le premier boîtier créé."
            />
          ) : boitiersPositionnes.length === 0 && zones.length === 0 ? (
            <EmptyState
              icone="boitier"
              titre="Aucune position connue"
              message="Aucun boîtier n'a encore remonté de position GPS."
            />
          ) : (
            <div className="panneau__carte">
              <CarteBoitiers boitiers={boitiers} zones={zones} hauteur="200px" />
            </div>
          )}
        </Panneau>

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
                  <span className="inline-flex items-center gap-2">
                    <span className="liste-compacte__meta font-mono">{zone.nombre_incidents} incid.</span>
                    <Badge valeur={zone.niveau_danger} libelle={zone.niveau_danger_libelle} />
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
                  <span className="inline-flex items-center gap-2">
                    <span className="liste-compacte__meta font-mono">
                      {new Date(alerte.date_creation).toLocaleDateString('fr-FR')}
                    </span>
                    <Badge valeur={alerte.statut} libelle={alerte.statut_libelle} />
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
