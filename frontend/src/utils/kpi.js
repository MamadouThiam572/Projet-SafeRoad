// Dérive tendance/sparkline à partir des lignes « globales » de StatistiquesQuotidiennes
// (zone=null, type_incident=null), telles que renvoyées par /statistiques/dashboard/ —
// triées du plus récent au plus ancien par l'API.

export function calculerTendance7Jours(globalesRecentDabord, champ) {
  const chrono = [...globalesRecentDabord].reverse() // plus ancien → plus récent
  const dernieres7 = chrono.slice(-7)
  const precedentes7 = chrono.slice(-14, -7)
  if (dernieres7.length === 0 || precedentes7.length === 0) return null

  const sommeDernieres = dernieres7.reduce((acc, s) => acc + (s[champ] ?? 0), 0)
  const sommePrecedentes = precedentes7.reduce((acc, s) => acc + (s[champ] ?? 0), 0)
  if (sommePrecedentes === 0) return sommeDernieres === 0 ? 0 : null // pas de base de comparaison valable

  return ((sommeDernieres - sommePrecedentes) / sommePrecedentes) * 100
}

export function historiqueChronologique(globalesRecentDabord, champ, jours = 14) {
  return [...globalesRecentDabord].reverse().slice(-jours).map((s) => s[champ] ?? 0)
}

// Couleur de sévérité d'un pourcentage (jauges du dashboard) : `sensBon` indique si
// un pourcentage haut est une bonne (« haut ») ou mauvaise (« bas ») nouvelle.
export function couleurSeuil(pourcentage, sensBon = 'bas') {
  const bon = sensBon === 'bas' ? pourcentage < 34 : pourcentage >= 67
  const mauvais = sensBon === 'bas' ? pourcentage >= 67 : pourcentage < 34
  if (bon) return 'var(--danger-faible)'
  if (mauvais) return 'var(--danger-critique)'
  return 'var(--danger-moyen)'
}
