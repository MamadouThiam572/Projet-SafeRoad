// Barres horizontales — une seule série sur des catégories nominales (les types
// d'incident n'ont pas d'ordre inhérent) : une seule couleur pour toutes les barres,
// jamais un dégradé (qui laisserait croire à un classement). Valeur directement au
// bout de chaque barre plutôt qu'un axe : plus lisible à cette échelle (5 catégories).
export function GraphiqueRepartition({ donnees }) {
  if (!donnees || donnees.length === 0) return null

  const total = donnees.reduce((acc, d) => acc + d.total, 0)
  const max = Math.max(1, ...donnees.map((d) => d.total))

  return (
    <div className="graphique-repartition" role="img" aria-label={`Répartition de ${total} incidents par type sur la période : ${donnees.map((d) => `${d.libelle} ${d.total}`).join(', ')}.`}>
      {donnees.map((d) => (
        <div className="graphique-repartition__ligne" key={d.type}>
          <span className="graphique-repartition__label">{d.libelle}</span>
          <span className="graphique-repartition__piste">
            <span
              className="graphique-repartition__barre"
              style={{ width: `${(d.total / max) * 100}%` }}
            />
          </span>
          <span className="graphique-repartition__valeur">{d.total}</span>
        </div>
      ))}
    </div>
  )
}
