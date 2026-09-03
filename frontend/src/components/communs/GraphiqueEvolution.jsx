import { useRef, useState } from 'react'

const LARGEUR = 640
const HAUTEUR = 240
const MARGE = { haut: 16, bas: 28, gauche: 34, droite: 56 }
const LARGEUR_TRACE = LARGEUR - MARGE.gauche - MARGE.droite
const HAUTEUR_TRACE = HAUTEUR - MARGE.haut - MARGE.bas

function formaterDateCourte(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

// Courbe d'évolution (incidents totaux vs critiques) sur une fenêtre de jours — deux
// séries de même unité partagent donc UN seul axe (jamais de double axe). Légende requise
// dès 2 séries ; valeur directement au bout de chaque ligne plutôt qu'un point par jour.
export function GraphiqueEvolution({ donnees }) {
  const svgRef = useRef(null)
  const [survol, setSurvol] = useState(null)

  if (!donnees || donnees.length < 2) return null

  const maxValeur = Math.max(1, ...donnees.map((d) => d.total), ...donnees.map((d) => d.critiques))
  const n = donnees.length

  const x = (i) => MARGE.gauche + (i / (n - 1)) * LARGEUR_TRACE
  const y = (v) => MARGE.haut + HAUTEUR_TRACE - (v / maxValeur) * HAUTEUR_TRACE

  const pointsTotal = donnees.map((d, i) => [x(i), y(d.total)])
  const pointsCritiques = donnees.map((d, i) => [x(i), y(d.critiques)])
  const chemin = (points) => points.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px},${py}`).join(' ')
  const cheminAire = `${chemin(pointsTotal)} L${x(n - 1)},${MARGE.haut + HAUTEUR_TRACE} L${x(0)},${MARGE.haut + HAUTEUR_TRACE} Z`

  const ticksY = [0, Math.round(maxValeur / 2), maxValeur]

  function gererSurvol(e) {
    const rect = svgRef.current.getBoundingClientRect()
    const ratioX = (e.clientX - rect.left) / rect.width
    const posViewBox = ratioX * LARGEUR
    const index = Math.round(((posViewBox - MARGE.gauche) / LARGEUR_TRACE) * (n - 1))
    setSurvol(Math.min(n - 1, Math.max(0, index)))
  }

  const pointSurvol = survol !== null ? donnees[survol] : null

  return (
    <div className="graphique-evolution">
      <div className="graphique-evolution__legende">
        <span className="graphique-evolution__legende-item">
          <span className="graphique-evolution__pastille" style={{ background: 'var(--primary)' }} />
          Total
        </span>
        <span className="graphique-evolution__legende-item">
          <span className="graphique-evolution__pastille" style={{ background: 'var(--danger-critique)' }} />
          Critiques
        </span>
      </div>

      <div className="graphique-evolution__cadre">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}
          role="img"
          aria-label={`Évolution du nombre d'incidents sur ${n} jours, de ${formaterDateCourte(donnees[0].date)} à ${formaterDateCourte(donnees[n - 1].date)} : ${donnees[n - 1].total} incidents au total et ${donnees[n - 1].critiques} critiques au dernier jour.`}
          onMouseMove={gererSurvol}
          onMouseLeave={() => setSurvol(null)}
        >
          {ticksY.map((valeur) => (
            <g key={valeur}>
              <line
                x1={MARGE.gauche}
                x2={LARGEUR - MARGE.droite}
                y1={y(valeur)}
                y2={y(valeur)}
                stroke="var(--line)"
                strokeWidth="1"
              />
              <text x={MARGE.gauche - 8} y={y(valeur)} textAnchor="end" dominantBaseline="middle" className="graphique-evolution__tick">
                {valeur}
              </text>
            </g>
          ))}

          <text x={x(0)} y={HAUTEUR - 6} textAnchor="start" className="graphique-evolution__tick">
            {formaterDateCourte(donnees[0].date)}
          </text>
          <text x={x(n - 1)} y={HAUTEUR - 6} textAnchor="end" className="graphique-evolution__tick">
            {formaterDateCourte(donnees[n - 1].date)}
          </text>

          <path d={cheminAire} fill="var(--primary)" fillOpacity="0.1" stroke="none" />
          <path d={chemin(pointsTotal)} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d={chemin(pointsCritiques)} fill="none" stroke="var(--danger-critique)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

          <circle cx={x(n - 1)} cy={y(donnees[n - 1].total)} r="4" fill="var(--primary)" stroke="var(--surface)" strokeWidth="2" />
          <circle cx={x(n - 1)} cy={y(donnees[n - 1].critiques)} r="4" fill="var(--danger-critique)" stroke="var(--surface)" strokeWidth="2" />
          <text x={x(n - 1) + 8} y={y(donnees[n - 1].total)} dominantBaseline="middle" className="graphique-evolution__valeur-fin" fill="var(--primary)">
            {donnees[n - 1].total}
          </text>
          <text x={x(n - 1) + 8} y={y(donnees[n - 1].critiques)} dominantBaseline="middle" className="graphique-evolution__valeur-fin" fill="var(--danger-critique)">
            {donnees[n - 1].critiques}
          </text>

          {survol !== null && (
            <g>
              <line
                x1={x(survol)}
                x2={x(survol)}
                y1={MARGE.haut}
                y2={MARGE.haut + HAUTEUR_TRACE}
                stroke="var(--ink-soft)"
                strokeOpacity="0.35"
                strokeWidth="1"
              />
              <circle cx={x(survol)} cy={y(pointSurvol.total)} r="4" fill="var(--primary)" stroke="var(--surface)" strokeWidth="2" />
              <circle cx={x(survol)} cy={y(pointSurvol.critiques)} r="4" fill="var(--danger-critique)" stroke="var(--surface)" strokeWidth="2" />
            </g>
          )}

          <rect
            x={MARGE.gauche}
            y={MARGE.haut}
            width={LARGEUR_TRACE}
            height={HAUTEUR_TRACE}
            fill="transparent"
            onMouseMove={gererSurvol}
          />
        </svg>

        {pointSurvol && (
          <div
            className="graphique-evolution__infobulle"
            style={{
              left: `${(x(survol) / LARGEUR) * 100}%`,
              top: `${(Math.min(y(pointSurvol.total), y(pointSurvol.critiques)) / HAUTEUR) * 100}%`,
            }}
          >
            <div className="graphique-evolution__infobulle-date">{formaterDateCourte(pointSurvol.date)}</div>
            <div><span style={{ color: 'var(--primary)' }}>●</span> {pointSurvol.total} total</div>
            <div><span style={{ color: 'var(--danger-critique)' }}>●</span> {pointSurvol.critiques} critique{pointSurvol.critiques > 1 ? 's' : ''}</div>
          </div>
        )}
      </div>
    </div>
  )
}
