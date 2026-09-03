import { Link } from 'react-router-dom'
import { Icone } from './Icone'
import { Sparkline } from './Sparkline'

// KPI d'un dashboard de gestion (admin/ANASER) — un chiffre = la réponse à trois
// questions : combien ?, dans quel état ?, pourquoi cliquer ? Jamais plus d'un chiffre
// et d'un libellé : les détails vont dans le tableau, pas dans la carte (voir le guide
// de structure fourni pour ce périmètre).
//
// - `tendance` : { valeurPct, sensBon } — variation vs. période précédente (optionnel).
// - `urgent` : true si un point pulsant doit signaler que cette valeur réclame une action
//   (seulement quand valeur > 0 — un KPI à 0 n'est jamais « urgent »).
export function KpiCard({ label, valeur, sousLabel, icone, couleur = 'var(--primary)', lien, tendance, urgent, historique }) {
  const estUrgent = urgent && Number(valeur) > 0
  const Conteneur = lien ? Link : 'div'

  return (
    <Conteneur
      {...(lien ? { to: lien.to } : {})}
      className={[
        'group relative flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface p-5 shadow-sm',
        'border-b-4 transition-all duration-150',
        lien ? 'hover:-translate-y-0.5 hover:border-b-primary hover:shadow-md' : '',
      ].join(' ')}
      style={{ borderBottomColor: couleur }}
    >
      <Icone
        nom={icone}
        taille={72}
        className="pointer-events-none absolute -right-3 -top-3 text-ink opacity-[0.06]"
      />

      <div className="relative flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
          {estUrgent && (
            <span className="relative flex h-2 w-2 flex-none" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger-critique opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-danger-critique" />
            </span>
          )}
          {label}
        </span>
        <span
          className="flex h-9 w-9 flex-none items-center justify-center rounded-lg"
          style={{ background: 'var(--paper)', color: couleur }}
        >
          <Icone nom={icone} taille={18} />
        </span>
      </div>

      <div className="relative mt-3 font-mono text-4xl font-black leading-none text-ink tabular-nums">
        {valeur}
      </div>

      {historique && historique.length >= 2 && (
        <div className="relative mt-2">
          <Sparkline valeurs={historique} couleur={couleur} />
        </div>
      )}

      <div className="relative mt-2 flex flex-1 items-end justify-between gap-2">
        {sousLabel ? <p className="text-xs text-ink-soft">{sousLabel}</p> : <span />}
        {tendance && <TendanceBadge {...tendance} />}
      </div>

      {lien && (
        <span className="relative mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
          {lien.libelle} <Icone nom="fleche" taille={13} />
        </span>
      )}
    </Conteneur>
  )
}

function TendanceBadge({ valeurPct, sensBon = 'baisse' }) {
  if (valeurPct === null || valeurPct === undefined || Number.isNaN(valeurPct)) return null
  const hausse = valeurPct > 0
  const stable = Math.abs(valeurPct) < 0.5
  const estBonneNouvelle = stable ? null : hausse ? sensBon === 'hausse' : sensBon === 'baisse'

  const classeTon = stable
    ? 'bg-statut-neutre-bg text-statut-neutre'
    : estBonneNouvelle
      ? 'bg-danger-faible-bg text-danger-faible'
      : 'bg-danger-critique-bg text-danger-critique'

  return (
    <span className={`inline-flex flex-none items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold font-mono ${classeTon}`}>
      {!stable && <Icone nom={hausse ? 'tendance-hausse' : 'tendance-baisse'} taille={11} />}
      {stable ? '—' : `${hausse ? '+' : ''}${valeurPct.toFixed(0)}%`}
    </span>
  )
}
