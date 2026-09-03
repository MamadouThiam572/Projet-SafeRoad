import { useEffect, useState } from 'react'
import { ErrorState } from '../../components/communs/ErrorState'
import { Loader } from '../../components/communs/Loader'
import { StatTile } from '../../components/communs/StatTile'
import { useMetaPage } from '../../hooks/useMetaPage'
import { statistiquesPubliques } from '../../services/statistiquesService'

export function StatistiquesPubliquesPage() {
  useMetaPage({
    titre: 'Statistiques publiques',
    description: "Incidents, zones actives et tendances des 30 derniers jours — données agrégées et anonymisées.",
    chemin: '/statistiques',
  })
  const [statistiques, setStatistiques] = useState(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  function charger() {
    setChargement(true)
    setErreur(null)
    statistiquesPubliques()
      .then(setStatistiques)
      .catch(() => setErreur("Impossible de charger les statistiques. Vérifiez votre connexion et réessayez."))
      .finally(() => setChargement(false))
  }

  useEffect(charger, [])

  if (chargement) return <Loader />

  const totalIncidents = statistiques?.reduce((acc, s) => acc + s.nombre_incidents, 0) ?? 0
  const totalCritiques = statistiques?.reduce((acc, s) => acc + s.nombre_incidents_critiques, 0) ?? 0
  const dernieresZonesActives = statistiques?.length ? statistiques[statistiques.length - 1].nombre_zones_actives : 0

  return (
    <div className="container py-4">
      <h1 className="h4 mb-1">Statistiques publiques</h1>
      <p style={{ color: 'var(--ink-soft)' }}>30 derniers jours, données agrégées et anonymisées</p>
      {statistiques && statistiques.length > 0 && (
        <p className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--ink-soft)' }}>
          Dernière journée disponible : {statistiques[statistiques.length - 1].date}
        </p>
      )}

      {erreur && <ErrorState message={erreur} onReessayer={charger} />}

      {!erreur && statistiques?.length === 0 && (
        <p style={{ color: 'var(--ink-soft)' }}>Aucune statistique disponible pour le moment.</p>
      )}

      {!erreur && statistiques && statistiques.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-3 mb-4 md:grid-cols-3">
            <StatTile label="Incidents sur la période" valeur={totalIncidents} icone="incidents" stripe="var(--ink)" />
            <StatTile label="Dont critiques" valeur={totalCritiques} icone="alerte" stripe="var(--danger-critique)" />
            <StatTile label="Zones actives (dernier jour)" valeur={dernieresZonesActives} icone="zone" stripe="var(--danger-moyen)" />
          </div>

          <div className="surface-card p-3" style={{ overflowX: 'auto' }}>
            <table className="table table-striped mb-0">
              <caption className="visually-hidden">Statistiques quotidiennes des 30 derniers jours</caption>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Incidents</th>
                  <th>Incidents critiques</th>
                  <th>Zones actives</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {statistiques.map((stat) => (
                  <tr key={stat.id}>
                    <td>{stat.date}</td>
                    <td>{stat.nombre_incidents}</td>
                    <td>{stat.nombre_incidents_critiques}</td>
                    <td>{stat.nombre_zones_actives}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
