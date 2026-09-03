// Mini-tendance pour une stat-tile : ligne neutre pour l'historique, dernier segment et
// point final dans la couleur d'accent de la card — seule la période la plus récente
// attire l'œil, le reste ne fait que donner la forme de la tendance.
export function Sparkline({ valeurs, couleur = 'var(--primary)', largeur = 100, hauteur = 30 }) {
  if (!valeurs || valeurs.length < 2) return null

  const min = Math.min(...valeurs)
  const max = Math.max(...valeurs)
  const amplitude = max - min
  const paddingY = 3

  const points = valeurs.map((valeur, i) => {
    const x = (i / (valeurs.length - 1)) * largeur
    const y =
      amplitude === 0
        ? hauteur / 2
        : hauteur - paddingY - ((valeur - min) / amplitude) * (hauteur - paddingY * 2)
    return [x, y]
  })

  const [xFin, yFin] = points[points.length - 1]
  const [xAvantFin, yAvantFin] = points[points.length - 2]

  return (
    <svg
      className="sparkline"
      width="100%"
      height={hauteur}
      viewBox={`0 0 ${largeur} ${hauteur}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <polyline
        points={points.map(([x, y]) => `${x},${y}`).join(' ')}
        fill="none"
        stroke="var(--ink-soft)"
        strokeOpacity="0.45"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1={xAvantFin} y1={yAvantFin} x2={xFin} y2={yFin} stroke={couleur} strokeWidth="2" strokeLinecap="round" />
      <circle cx={xFin} cy={yFin} r="4" fill={couleur} stroke="var(--surface)" strokeWidth="2" />
    </svg>
  )
}
