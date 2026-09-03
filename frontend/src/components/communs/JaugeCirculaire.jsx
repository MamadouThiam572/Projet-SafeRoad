// Jauge circulaire (anneau de progression) : la portion remplie porte la sévérité
// (accent -> avertissement -> danger, via `couleur`), l'anneau neutre le reste.
export function JaugeCirculaire({ valeur, libelle, couleur = 'var(--primary)', taille = 108, epaisseur = 10 }) {
  const rayon = (taille - epaisseur) / 2
  const circonference = 2 * Math.PI * rayon
  const pourcentage = Math.max(0, Math.min(100, valeur))
  const decalage = circonference * (1 - pourcentage / 100)
  const centre = taille / 2

  return (
    <div className="jauge-circulaire">
      <svg width={taille} height={taille} viewBox={`0 0 ${taille} ${taille}`} role="img" aria-label={`${libelle} : ${Math.round(pourcentage)}%`}>
        <circle cx={centre} cy={centre} r={rayon} fill="none" stroke="var(--line)" strokeWidth={epaisseur} />
        <circle
          cx={centre}
          cy={centre}
          r={rayon}
          fill="none"
          stroke={couleur}
          strokeWidth={epaisseur}
          strokeLinecap="round"
          strokeDasharray={circonference}
          strokeDashoffset={decalage}
          transform={`rotate(-90 ${centre} ${centre})`}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="jauge-circulaire__valeur">
          {Math.round(pourcentage)}%
        </text>
      </svg>
      <div className="jauge-circulaire__libelle">{libelle}</div>
    </div>
  )
}
