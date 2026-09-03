import { Badge } from '../../components/communs/Badge'
import { EmptyState } from '../../components/communs/EmptyState'
import { ErrorState } from '../../components/communs/ErrorState'
import { KpiCard } from '../../components/communs/KpiCard'
import { Panneau } from '../../components/communs/Panneau'
import { PageHeader } from '../../components/communs/PageHeader'
import { SkeletonKpiGrid } from '../../components/communs/Skeleton'
import { useRequete } from '../../hooks/useRequete'
import { listerFeedbacksAnaser } from '../../services/anaserService'
import { statistiquesDashboard } from '../../services/statistiquesService'
import { listerZones } from '../../services/zonesService'
import { calculerTendance7Jours, historiqueChronologique } from '../../utils/kpi'

function chargerDashboard() {
  return Promise.all([listerZones(), statistiquesDashboard(), listerFeedbacksAnaser()]).then(
    ([zones, statistiques, feedbacks]) => ({ zones, statistiques, feedbacks }),
  )
}

export function AnaserDashboardPage() {
  const { donnees, chargement, erreur, rafraichir } = useRequete(chargerDashboard)

  return (
    <>
      <PageHeader
        titre="Tableau de bord ANASER"
        icone="tableau"
        description="Vue d'ensemble pour prioriser vos interventions : zones les plus dangereuses à traiter en premier et suivi de vos feedbacks."
      />
      {chargement && <SkeletonKpiGrid />}
      {erreur && !chargement && <ErrorState onReessayer={rafraichir} />}
      {donnees && !chargement && !erreur && <TableauDeBordAnaser donnees={donnees} />}
    </>
  )
}

function TableauDeBordAnaser({ donnees }) {
  const { zones, statistiques, feedbacks } = donnees

  const zonesActives = zones.filter((z) => z.actif)
  const zonesCritiques = zonesActives.filter((z) => z.niveau_danger === 'critique')
  const zonesVigilance = zonesActives.filter((z) => z.niveau_danger === 'vigilance')
  const globales = statistiques.filter((s) => !s.zone && !s.type_incident)
  const totalIncidents = globales.reduce((acc, s) => acc + s.nombre_incidents, 0)
  const feedbacksEnAttente = feedbacks.filter((f) => f.statut !== 'realisee')
  const feedbacksRealises = feedbacks.filter((f) => f.statut === 'realisee')

  // Zones à traiter en priorité : déjà triées par score_danger décroissant côté API,
  // on ne garde que celles encore actives (une zone rejetée/désactivée n'a plus lieu d'être traitée).
  const zonesPrioritaires = zonesActives.slice(0, 5)
  const derniersFeedbacks = feedbacks.slice(0, 5)

  return (
    <>
      <div className="stat-grid">
        <KpiCard
          label="Zones critiques"
          valeur={zonesCritiques.length}
          sousLabel="Priorité d'intervention"
          icone="alerte"
          couleur="var(--danger-critique)"
          urgent
          lien={{ to: '/anaser/zones', libelle: 'Voir les zones' }}
        />
        <KpiCard
          label="Zones en vigilance"
          valeur={zonesVigilance.length}
          sousLabel="À surveiller"
          icone="zone"
          couleur="var(--danger-moyen)"
          lien={{ to: '/anaser/zones', libelle: 'Voir les zones' }}
        />
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
          label="Feedbacks en attente"
          valeur={feedbacksEnAttente.length}
          sousLabel={`${feedbacksRealises.length} déjà réalisé(s) au total`}
          icone="boite"
          couleur="var(--danger-moyen)"
          urgent
          lien={{ to: '/anaser/feedback', libelle: 'Voir les feedbacks' }}
        />
      </div>

      <div className="panneaux-grille">
        <Panneau
          icone="zone"
          titre="Zones prioritaires à traiter"
          compteur={zonesActives.length}
          lien="/anaser/zones"
        >
          {zonesPrioritaires.length === 0 ? (
            <EmptyState
              icone="zone"
              titre="Aucune zone identifiée"
              message="Aucune zone accidentogène n'a encore été détectée."
            />
          ) : (
            <ul className="liste-compacte">
              {zonesPrioritaires.map((zone) => (
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
          icone="boite"
          titre="Mes derniers feedbacks"
          compteur={feedbacks.length}
          lien="/anaser/feedback"
        >
          {derniersFeedbacks.length === 0 ? (
            <EmptyState
              icone="boite"
              titre="Aucun feedback"
              message="Proposez une action corrective depuis la page Feedback."
            />
          ) : (
            <ul className="liste-compacte">
              {derniersFeedbacks.map((f) => (
                <li key={f.id}>
                  <span className="liste-compacte__nom">
                    {f.zone ? `Zone #${f.zone}` : `Incident #${f.incident}`} — {f.action_prevue_libelle ?? f.action_prevue}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="liste-compacte__meta font-mono">
                      {new Date(f.date_creation).toLocaleDateString('fr-FR')}
                    </span>
                    <Badge valeur={f.statut} libelle={f.statut_libelle} />
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
