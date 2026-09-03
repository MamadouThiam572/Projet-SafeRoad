import { Link } from 'react-router-dom'
import { Icone } from './Icone'
import { Sparkline } from './Sparkline'

// `tendance` : { valeurPct, sensBon: 'baisse' | 'hausse' } — variation vs. la période
// précédente. `sensBon` indique si une hausse est une bonne ou une mauvaise nouvelle pour
// CETTE métrique (une hausse d'incidents est mauvaise, une hausse de zones traitées est
// bonne) : la couleur du delta en dépend, jamais fixée en dur sur le signe seul.
// `historique` : valeurs chronologiques (plus ancien → plus récent) pour la sparkline.
export function StatTile({ label, valeur, icone, stripe, lien, tendance, historique }) {
  return (
    <article className="stat-tile" style={{ '--stripe': stripe }}>
      <div className="stat-tile__haut">
        <span className="stat-tile__label">{label}</span>
        <span className="stat-tile__icone">
          <Icone nom={icone} taille={18} />
        </span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="stat-tile__valeur">{valeur}</div>
        {historique && historique.length > 1 && (
          <Sparkline valeurs={historique} couleur={stripe} className="mb-1 h-7 w-20 flex-none" />
        )}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        {tendance ? <TendanceChip {...tendance} /> : <span />}
        {lien && (
          <Link className="stat-tile__lien" to={lien.to}>
            {lien.libelle} <Icone nom="fleche" taille={14} />
          </Link>
        )}
      </div>
    </article>
  )
}

function TendanceChip({ valeurPct, sensBon = 'baisse' }) {
  if (valeurPct === null || valeurPct === undefined || Number.isNaN(valeurPct)) return <span />
  const hausse = valeurPct > 0
  const stable = Math.abs(valeurPct) < 0.5
  const estBonneNouvelle = stable ? null : (hausse ? sensBon === 'hausse' : sensBon === 'baisse')

  const classeTon = stable
    ? 'text-ink-soft'
    : estBonneNouvelle
      ? 'text-danger-faible'
      : 'text-danger-critique'

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold font-mono ${classeTon}`}>
      {!stable && <Icone nom={hausse ? 'tendance-hausse' : 'tendance-baisse'} taille={13} />}
      {stable ? 'Stable' : `${hausse ? '+' : ''}${valeurPct.toFixed(0)} %`}
      <span className="font-sans font-normal text-ink-soft">vs 7 j précédents</span>
    </span>
  )
}
