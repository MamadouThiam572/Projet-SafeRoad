import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useAuth } from '@/context/AuthContext'
import { REGION_STATS, SERIES_DATES, SERIES_DAYS } from '@/data/superAdminHome'
import { GRAVITE_META, GRAVITE_ORDER, incidentDate, incidentTime } from '@/data/superAdminIncidents'
import { DANGER_META, sigDate, sigTime } from '@/data/superAdminSignalements'
import {
  INITIAL_ZONES,
  RISK_META,
  RISK_ORDER,
  ZONE_MIN_EVENTS,
  ZONE_RADIUS_M,
  ZONE_WINDOW_DAYS,
  ZSTATUT_META,
  ZSTATUT_ORDER,
  identifyingEvents,
  zoneAnalysis,
  zoneBaseHistory,
  zoneCounts,
  zoneDate,
  type Zone,
  type ZoneAnalysis,
  type ZoneHistoryItem,
  type ZoneRisk,
  type ZoneStatut,
} from '@/data/superAdminZones'
import { REGION_CENTERS } from '@/lib/regions'
import { PATHS } from '@/routes/paths'

/**
 * Super Admin → Zones accidentogènes : vue nationale des secteurs routiers où
 * des événements se répètent. Une zone n'est ni un incident (détecté par un
 * boîtier), ni un signalement (déclaré par un conducteur) : c'est le RÉSULTAT
 * d'une analyse de plusieurs d'entre eux. Chaque zone s'ouvre sur les données qui
 * ont conduit à son identification (de vrais incidents et signalements) et sur
 * ses statistiques. Le Super Admin peut intervenir sur la décision (valider,
 * rejeter avec motif, renvoyer en analyse).
 *
 * Données de démonstration ; les changements de statut sont locaux
 * (// TODO backend).
 */

type Periode = 'aujourdhui' | '7j' | '30j' | '3m' | 'perso'
type IdentFilter = 'tous' | '7j' | '30j' | '3m'
type Tab = 'general' | 'identification' | 'analyse'
type SortKey = 'zone' | 'risque' | 'incidents' | 'signalements'

const PERIODE_LABELS: Record<Periode, string> = {
  aujourdhui: "Aujourd'hui",
  '7j': '7 derniers jours',
  '30j': '30 derniers jours',
  '3m': '3 derniers mois',
  perso: 'Personnalisée',
}

const IDENT_DAYS: Record<Exclude<IdentFilter, 'tous'>, number> = { '7j': 7, '30j': 30, '3m': 90 }

const PAGE_SIZE = 8

const NATIONAL_FOCUS = { center: [14.45, -14.6] as [number, number], zoom: 7 }
type Focus = { center: [number, number]; zoom: number }

const nf = new Intl.NumberFormat('fr-FR')
const fmt = (n: number) => nf.format(n).replace(/\s/g, ' ')

const regionName = (slug: string) => REGION_STATS.find((r) => r.slug === slug)?.label ?? slug

const p2 = (n: number) => String(n).padStart(2, '0')

function formatNow(): string {
  const d = new Date()
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}

/** Horodatage court d'une action faite maintenant dans la page : JJ/MM HH:mm. */
function stampNow(): string {
  const d = new Date()
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

const fieldCls =
  'w-full rounded-[9px] border-[1.5px] border-line-field bg-field px-3 py-2 text-[12.5px] font-medium text-ink outline-none placeholder:text-faint focus:border-brand-600'

const plural = (n: number, one: string, many = `${one}s`) => `${fmt(n)} ${n > 1 ? many : one}`

/** Couleurs des deux séries du graphique (validées : séparées même en daltonisme, contraste ≥ 3:1). */
const SERIES_INCIDENTS = '#2b6cb0'
const SERIES_SIGNALEMENTS = '#b86e00'

/* ------------------------------------------------------------------ */
/* Pastilles                                                           */
/* ------------------------------------------------------------------ */

function RiskBadge({ risk }: { risk: ZoneRisk }) {
  const m = RISK_META[risk]
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: m.soft, color: m.text }}>
      <span className="ic text-[14px]">{m.icon}</span>
      {m.label}
    </span>
  )
}

function StatutBadge({ statut }: { statut: ZoneStatut }) {
  const m = ZSTATUT_META[statut]
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: m.soft, color: m.text }}>
      <span className="ic text-[14px]">{m.icon}</span>
      {m.label}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Carte                                                               */
/* ------------------------------------------------------------------ */

function FlyTo({ focus }: { focus: Focus }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(focus.center, focus.zoom, { duration: 0.8 })
  }, [focus, map])
  return null
}

/* ------------------------------------------------------------------ */
/* Graphiques (HTML/CSS, sans bibliothèque)                            */
/* ------------------------------------------------------------------ */

/** Colonnes hebdomadaires empilées : incidents + signalements. */
function WeeklyChart({ analysis }: { analysis: ZoneAnalysis }) {
  const [hover, setHover] = useState<number | null>(null)
  const [asTable, setAsTable] = useState(false)
  const { weekly, identWeek } = analysis
  const rawMax = Math.max(1, ...weekly.map((w) => w.incidents + w.signalements))
  const max = rawMax <= 4 ? rawMax : Math.ceil(rawMax / 2) * 2
  const H = 110
  const summary = `Évolution hebdomadaire sur 13 semaines : ${analysis.totalIncidents} incidents et ${analysis.totalSignalements} signalements.`

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-body">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES_INCIDENTS }} />
            Incidents
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES_SIGNALEMENTS }} />
            Signalements
          </span>
          <span className="flex items-center gap-1">
            <span className="ic text-sm text-navy-900">flag</span>
            Identification
          </span>
        </div>
        <button type="button" onClick={() => setAsTable((v) => !v)} className="text-[11px] font-bold text-info-600 hover:underline">
          {asTable ? 'Voir le graphique' : 'Voir en tableau'}
        </button>
      </div>

      {asTable ? (
        <div className="overflow-hidden rounded-lg border border-line-soft">
          <table className="w-full border-collapse text-left text-[11.5px]">
            <thead>
              <tr className="bg-page font-bold text-ink">
                <th className="px-2.5 py-1.5">Semaine du</th>
                <th className="px-2.5 py-1.5 text-right">Incidents</th>
                <th className="px-2.5 py-1.5 text-right">Signalements</th>
              </tr>
            </thead>
            <tbody>
              {weekly.map((w, i) => (
                <tr key={w.label} className="border-t border-line-soft">
                  <td className="px-2.5 py-1 font-medium text-ink">
                    {w.label}
                    {i === identWeek && <span className="ml-1.5 text-[10.5px] font-bold text-info-600">identification</span>}
                  </td>
                  <td className="px-2.5 py-1 text-right tabular-nums text-ink">{w.incidents}</td>
                  <td className="px-2.5 py-1 text-right tabular-nums text-ink">{w.signalements}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div role="img" aria-label={summary} className="relative">
          <div className="flex gap-1.5">
            <div className="flex w-5 flex-none flex-col justify-between text-right text-[10px] font-medium text-faint" style={{ height: H }}>
              <span>{max}</span>
              <span>0</span>
            </div>
            <div className="relative min-w-0 flex-1">
              <div className="absolute inset-x-0 top-0 h-px bg-line-soft" aria-hidden="true" />
              <div className="flex items-end gap-1" style={{ height: H }} onMouseLeave={() => setHover(null)}>
                {weekly.map((w, i) => {
                  const inc = (w.incidents / max) * H
                  const sig = (w.signalements / max) * H
                  return (
                    <div key={w.label} className="flex h-full min-w-0 flex-1 items-end justify-center" onMouseEnter={() => setHover(i)}>
                      <div className="flex w-full max-w-[24px] flex-col justify-end">
                        {w.signalements > 0 && <div className="rounded-t-[4px]" style={{ height: Math.max(3, sig), background: SERIES_SIGNALEMENTS, marginBottom: w.incidents > 0 ? 2 : 0 }} />}
                        {w.incidents > 0 && <div className={w.signalements > 0 ? '' : 'rounded-t-[4px]'} style={{ height: Math.max(3, inc), background: SERIES_INCIDENTS }} />}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="h-px bg-line" aria-hidden="true" />
              <div className="mt-1 flex gap-1">
                {weekly.map((w, i) => (
                  <div key={w.label} className="flex min-w-0 flex-1 flex-col items-center">
                    <span className="h-[12px] whitespace-nowrap text-[9.5px] font-medium leading-[12px] text-body">{i % 2 === 0 ? w.label : ''}</span>
                    <span className={`ic text-sm leading-none text-navy-900 ${i === identWeek ? '' : 'invisible'}`} aria-hidden={i !== identWeek}>
                      flag
                    </span>
                  </div>
                ))}
              </div>
              {hover !== null && (
                <div
                  className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-navy-900 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-xl"
                  style={{ left: `${((hover + 0.5) / weekly.length) * 100}%` }}
                >
                  Semaine du {weekly[hover].label}
                  <br />
                  {plural(weekly[hover].incidents, 'incident')} · {plural(weekly[hover].signalements, 'signalement')}
                  {hover === identWeek && (
                    <>
                      <br />
                      Semaine d'identification
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Barres horizontales : un libellé, une barre fine, la valeur au bout. */
function HBars({ rows, empty }: { rows: { label: string; count: number; color: string }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  if (rows.every((r) => r.count === 0)) return <p className="m-0 text-[12px] text-body">{empty}</p>
  return (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-2 text-[12px]">
          <span className="w-[8.2rem] flex-none truncate font-medium text-ink" title={r.label}>
            {r.label}
          </span>
          <span className="relative h-2 min-w-0 flex-1 rounded-full bg-page">
            <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(r.count / max) * 100}%`, background: r.color, minWidth: r.count > 0 ? 6 : 0 }} />
          </span>
          <span className="w-7 flex-none text-right text-[12px] font-bold tabular-nums text-ink">{r.count}</span>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* Volet de détail                                                     */
/* ------------------------------------------------------------------ */

function Section({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line-soft pt-3">
      <p className="m-0 mb-1.5 flex items-center gap-2 text-[13px] font-extrabold text-ink">
        <span className="ic text-xl text-info-600">{icon}</span>
        {title}
      </p>
      {children}
    </section>
  )
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="flex-none text-[12px] font-medium text-body">{label}</span>
      <span className="min-w-0 break-words text-right text-[12.5px] font-semibold text-ink">{children}</span>
    </div>
  )
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'general', label: 'Informations générales' },
  { key: 'identification', label: "Éléments d'identification" },
  { key: 'analyse', label: 'Analyse' },
]

interface DetailProps {
  z: Zone
  statut: ZoneStatut
  history: ZoneHistoryItem[]
  counts: { incidents: number; signalements: number }
  periodeLabel: string
  menuOpen: boolean
  onClose: () => void
  onMenu: (e: ReactMouseEvent<HTMLButtonElement>) => void
  onAction: (preset: ZoneStatut) => void
  onLocate: () => void
}

function DetailPanel({ z, statut, history, counts, periodeLabel, menuOpen, onClose, onMenu, onAction, onLocate }: DetailProps) {
  const [tab, setTab] = useState<Tab>('general')
  const [showAllInc, setShowAllInc] = useState(false)
  const [showAllSig, setShowAllSig] = useState(false)
  const analysis = zoneAnalysis(z)
  const ident = identifyingEvents(z)
  const nIdent = ident.incidents.length + ident.signalements.length
  const critInIdent = ident.incidents.filter((i) => i.gravite === 'critique' || i.gravite === 'elevee').length
  const risk = RISK_META[z.risk]

  const btn = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-bold hover:opacity-90'
  const outline = 'inline-flex items-center gap-1.5 rounded-lg border-[1.5px] border-line bg-white px-3 py-2 text-[12px] font-bold text-info-600 hover:bg-page'

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 text-[15px] font-extrabold text-ink">Détail de la zone</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onLocate} className="inline-flex items-center gap-1 rounded-lg border-[1.5px] border-line px-2.5 py-1.5 text-[11.5px] font-bold text-info-600 hover:bg-page">
            <span className="ic text-base">my_location</span>
            Voir sur la carte
          </button>
          <button type="button" onClick={onClose} aria-label="Fermer le détail" className="ic flex h-8 w-8 items-center justify-center rounded-lg text-xl text-body hover:bg-page 2xl:hidden">
            close
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full" style={{ background: risk.soft, color: risk.color }}>
          <span className="ic text-[24px]">{risk.icon}</span>
        </span>
        <span className="text-[16px] font-extrabold text-ink">{z.id}</span>
        <RiskBadge risk={z.risk} />
        <button
          type="button"
          data-row-menu
          onClick={onMenu}
          aria-label="Plus d'actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="ic ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-xl text-body hover:bg-page"
        >
          more_vert
        </button>
      </div>

      {/* Décision : le Super Admin peut intervenir */}
      <div className="flex flex-wrap gap-2">
        {(statut === 'a_valider' || statut === 'a_analyser') && (
          <>
            <button type="button" onClick={() => onAction('validee')} className={`${btn} bg-success-600 text-white`}>
              <span className="ic text-lg">check_circle</span>
              Valider
            </button>
            <button type="button" onClick={() => onAction('rejetee')} className={`${btn} border-[1.5px] border-danger-200 bg-white text-danger-600 hover:bg-danger-50`}>
              <span className="ic text-lg">cancel</span>
              Rejeter
            </button>
          </>
        )}
        {statut === 'a_valider' && (
          <button type="button" onClick={() => onAction('a_analyser')} className={outline}>
            <span className="ic text-lg">troubleshoot</span>
            Renvoyer en analyse
          </button>
        )}
        {statut === 'a_analyser' && (
          <button type="button" onClick={() => onAction('a_valider')} className={outline}>
            <span className="ic text-lg">schedule</span>
            Passer à valider
          </button>
        )}
        {(statut === 'validee' || statut === 'rejetee') && (
          <button type="button" onClick={() => onAction(statut)} className={outline}>
            <span className="ic text-lg">edit_note</span>
            Modifier le statut
          </button>
        )}
      </div>

      {/* Onglets */}
      <div role="tablist" aria-label="Sections du détail" className="flex border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px flex-1 border-b-2 px-1.5 py-2 text-[11.5px] font-bold leading-tight ${
              tab === t.key ? 'border-brand-600 text-brand-600' : 'border-transparent text-body hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <div role="tabpanel" className="flex flex-col gap-3">
          <div>
            <InfoRow label="Référence">{z.id}</InfoRow>
            <InfoRow label="Région">{regionName(z.region)}</InfoRow>
            <InfoRow label="Localité">{z.locality}</InfoRow>
            <InfoRow label="Coordonnées">
              <button type="button" onClick={onLocate} className="text-info-600 hover:underline" title="Voir sur la carte">
                {z.lat.toFixed(4)}, {z.lng.toFixed(4)}
              </button>
            </InfoRow>
            <InfoRow label="Statut">
              <StatutBadge statut={statut} />
            </InfoRow>
            <InfoRow label="Niveau de risque">
              <RiskBadge risk={z.risk} />
            </InfoRow>
          </div>

          {statut === 'rejetee' && z.rejectReason && (
            <p className="m-0 rounded-lg bg-danger-50 px-3 py-2.5 text-[12px] leading-snug text-ink">
              <span className="font-extrabold text-danger-700">Motif du rejet : </span>
              {z.rejectReason}
            </p>
          )}

          <Section icon="hub" title="Éléments associés">
            <InfoRow label="Incidents">
              <span>{fmt(counts.incidents)}</span> <span className="font-medium text-body">· {periodeLabel.toLowerCase()}</span>
              <br />
              <span className="text-[11.5px] font-medium text-body">{fmt(analysis.totalIncidents)} sur 90 jours</span>
            </InfoRow>
            <InfoRow label="Signalements">
              <span>{fmt(counts.signalements)}</span> <span className="font-medium text-body">· {periodeLabel.toLowerCase()}</span>
              <br />
              <span className="text-[11.5px] font-medium text-body">{fmt(analysis.totalSignalements)} sur 90 jours</span>
            </InfoRow>
            <InfoRow label="Période d'observation">
              {zoneDate(z.obsStartDay)} → {zoneDate(z.identDay)}
            </InfoRow>
            <InfoRow label="Date d'identification">{zoneDate(z.identDay)}</InfoRow>
          </Section>

          <Section icon="history" title="Historique de la zone">
            <ol className="m-0 list-none p-0">
              {history.map((h, i) => (
                <li key={i} className="relative flex gap-3 pb-2.5 last:pb-0">
                  {i < history.length - 1 && <span className="absolute left-[calc(3.1rem+2px)] top-3 h-full w-px bg-line" aria-hidden="true" />}
                  <span className="w-[3.1rem] flex-none text-right text-[11px] font-semibold leading-tight text-body">{h.at}</span>
                  <span className="relative z-10 mt-1 h-2 w-2 flex-none rounded-full border-2 border-info-600 bg-white" />
                  <span className="min-w-0 text-[12px] font-medium leading-snug text-ink">{h.text}</span>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      )}

      {tab === 'identification' && (
        <div role="tabpanel" className="flex flex-col gap-3">
          <div className="rounded-lg bg-info-50 px-3 py-2.5 text-[12px] leading-snug text-ink">
            <p className="m-0 font-extrabold">Pourquoi cette zone a été identifiée</p>
            <p className="m-0 mt-1">
              {plural(nIdent, 'événement')} dans un rayon de {ZONE_RADIUS_M} m entre le {zoneDate(z.obsStartDay)} et le {zoneDate(z.identDay)}, dont {plural(critInIdent, 'incident')} de gravité
              élevée ou critique. Règle : au moins {ZONE_MIN_EVENTS} événements dans le même secteur sur {ZONE_WINDOW_DAYS} jours.
            </p>
          </div>

          <Section icon="sensors" title={`Incidents détectés par les boîtiers (${ident.incidents.length})`}>
            {ident.incidents.length === 0 ? (
              <p className="m-0 text-[12px] text-body">Aucun incident dans la période d'observation.</p>
            ) : (
              <>
                <ul className="m-0 flex list-none flex-col p-0">
                  {(showAllInc ? ident.incidents : ident.incidents.slice(0, 5)).map((i) => (
                    <li key={i.id} className="flex items-center gap-2 border-t border-line-soft py-1.5 text-[12px] first:border-t-0">
                      <Link to={`${PATHS.superAdmin.incidents}?q=${i.id}`} className="flex-none font-extrabold text-info-600 hover:underline" title="Ouvrir dans Incidents">
                        {i.id}
                      </Link>
                      <span className="min-w-0 flex-1 truncate text-body">
                        {i.type} · {incidentDate(i)} {incidentTime(i)}
                      </span>
                      <span className="flex-none rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: GRAVITE_META[i.gravite].soft, color: GRAVITE_META[i.gravite].text }}>
                        {GRAVITE_META[i.gravite].label}
                      </span>
                    </li>
                  ))}
                </ul>
                {ident.incidents.length > 5 && (
                  <button type="button" onClick={() => setShowAllInc((v) => !v)} className="mt-1 text-[11.5px] font-bold text-info-600 hover:underline">
                    {showAllInc ? 'Réduire la liste' : `Voir les ${ident.incidents.length - 5} autres`}
                  </button>
                )}
              </>
            )}
          </Section>

          <Section icon="campaign" title={`Signalements des conducteurs (${ident.signalements.length})`}>
            {ident.signalements.length === 0 ? (
              <p className="m-0 text-[12px] text-body">Aucun signalement dans la période d'observation.</p>
            ) : (
              <>
                <ul className="m-0 flex list-none flex-col p-0">
                  {(showAllSig ? ident.signalements : ident.signalements.slice(0, 5)).map((s) => (
                    <li key={s.id} className="flex items-center gap-2 border-t border-line-soft py-1.5 text-[12px] first:border-t-0">
                      <Link to={`${PATHS.superAdmin.signalements}?q=${s.id}`} className="flex-none font-extrabold text-info-600 hover:underline" title="Ouvrir dans Signalements">
                        {s.id}
                      </Link>
                      <span className="min-w-0 flex-1 truncate text-body">
                        {DANGER_META[s.type].label} · {sigDate(s)} {sigTime(s)}
                      </span>
                    </li>
                  ))}
                </ul>
                {ident.signalements.length > 5 && (
                  <button type="button" onClick={() => setShowAllSig((v) => !v)} className="mt-1 text-[11.5px] font-bold text-info-600 hover:underline">
                    {showAllSig ? 'Réduire la liste' : `Voir les ${ident.signalements.length - 5} autres`}
                  </button>
                )}
              </>
            )}
          </Section>
        </div>
      )}

      {tab === 'analyse' && (
        <div role="tabpanel" className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-lg bg-page px-3 py-2.5">
              <p className="m-0 text-[10.5px] font-bold uppercase tracking-wide text-faint">Score de risque</p>
              <p className="m-0 mt-0.5 flex items-center gap-2 text-[20px] font-extrabold leading-none text-navy-900">
                {fmt(z.score)}
                <RiskBadge risk={z.risk} />
              </p>
            </div>
            <div className="rounded-lg bg-page px-3 py-2.5">
              <p className="m-0 text-[10.5px] font-bold uppercase tracking-wide text-faint">Tendance des incidents</p>
              <p className="m-0 mt-0.5 flex items-center gap-1.5 text-[20px] font-extrabold leading-none text-navy-900">
                {analysis.trendPct === null ? (
                  <span className="text-[14px]">{analysis.recent > 0 ? 'Nouvelle activité' : 'Aucune activité'}</span>
                ) : (
                  <>
                    <span className={`ic text-[22px] ${analysis.trendPct > 0 ? 'text-danger-600' : analysis.trendPct < 0 ? 'text-success-600' : 'text-body'}`}>
                      {analysis.trendPct > 0 ? 'trending_up' : analysis.trendPct < 0 ? 'trending_down' : 'trending_flat'}
                    </span>
                    {analysis.trendPct > 0 ? '+' : ''}
                    {analysis.trendPct} %
                  </>
                )}
              </p>
              <p className="m-0 mt-1 text-[10.5px] text-body">
                {analysis.recent} sur 30 j. · {analysis.previous} avant
              </p>
            </div>
          </div>

          <Section icon="monitoring" title="Évolution hebdomadaire (13 semaines)">
            <WeeklyChart analysis={analysis} />
          </Section>

          <Section icon="category" title="Incidents par type">
            <HBars rows={analysis.byType.map((t) => ({ label: t.label, count: t.count, color: SERIES_INCIDENTS }))} empty="Aucun incident dans cette zone." />
          </Section>

          <Section icon="priority_high" title="Incidents par gravité">
            <HBars rows={GRAVITE_ORDER.map((g) => ({ label: GRAVITE_META[g].label, count: analysis.byGravite[g], color: GRAVITE_META[g].color }))} empty="Aucun incident dans cette zone." />
          </Section>

          <Section icon="schedule" title="Moment de la journée">
            <HBars rows={analysis.byMoment.map((m) => ({ label: m.label, count: m.count, color: SERIES_INCIDENTS }))} empty="Aucun événement dans cette zone." />
            <p className="m-0 mt-2 text-[11.5px] text-body">Pic d'activité : {analysis.peak.toLowerCase()} (incidents et signalements).</p>
          </Section>

          <p className="m-0 flex items-start gap-1.5 text-[11px] leading-snug text-body">
            <span className="ic text-base text-faint">info</span>
            Score = somme pondérée des incidents (critique ×5, élevée ×3, moyenne ×2, faible ×1) et des signalements (×2) sur 90 jours.
          </p>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Modale de changement de statut                                      */
/* ------------------------------------------------------------------ */

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 px-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="m-0 text-[15px] font-extrabold text-ink">{title}</p>
          <button type="button" onClick={onClose} className="ic text-xl text-faint hover:text-ink" aria-label="Fermer">
            close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function StatusForm({
  z,
  current,
  preset,
  onSubmit,
  onClose,
}: {
  z: Zone
  current: ZoneStatut
  preset: ZoneStatut
  onSubmit: (statut: ZoneStatut, note: string) => void
  onClose: () => void
}) {
  const [statut, setStatut] = useState<ZoneStatut>(preset)
  const [note, setNote] = useState('')
  const changed = statut !== current
  const needsReason = statut === 'rejetee' && changed
  const canSave = needsReason ? note.trim().length > 0 : changed || note.trim().length > 0

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (canSave) onSubmit(statut, note.trim())
  }

  return (
    <ModalShell title={`Décision sur ${z.id}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div role="radiogroup" aria-label="Statut" className="flex flex-col gap-2">
          {ZSTATUT_ORDER.map((st) => {
            const m = ZSTATUT_META[st]
            const on = statut === st
            return (
              <label key={st} className={`flex cursor-pointer items-center gap-3 rounded-xl border-[1.5px] px-3 py-2.5 ${on ? 'border-brand-600 bg-brand-50' : 'border-line hover:bg-page'}`}>
                <input type="radio" name="statut" checked={on} onChange={() => setStatut(st)} className="h-4 w-4 accent-brand-600" />
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full" style={{ background: m.soft, color: m.text }}>
                  <span className="ic text-lg">{m.icon}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-extrabold text-ink">
                    {m.label}
                    {st === current && <span className="ml-1.5 text-[10.5px] font-semibold text-faint">(actuel)</span>}
                  </span>
                  <span className="block text-[11.5px] text-body">{m.hint}</span>
                </span>
              </label>
            )
          })}
        </div>
        <label className="block">
          <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-faint">{needsReason ? 'Motif du rejet (obligatoire)' : 'Observation (facultatif)'}</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 300))}
            rows={3}
            placeholder={needsReason ? "Pourquoi cette zone n'est-elle pas retenue ?" : "Ajouter une précision à l'historique de la zone…"}
            className={`${fieldCls} resize-none`}
          />
          <span className="mt-0.5 block text-right text-[10.5px] text-faint">{note.length}/300</span>
        </label>
        <div className="mt-1 flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className="rounded-lg border-[1.5px] border-line px-4 py-2 text-[12.5px] font-bold text-ink hover:bg-page">
            Annuler
          </button>
          <button type="submit" disabled={!canSave} className="rounded-lg bg-brand-600 px-4 py-2 text-[12.5px] font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
            Enregistrer
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface RowMenu {
  id: string
  top: number
  right: number
  up: boolean
}

interface Override {
  statut: ZoneStatut
  extra: ZoneHistoryItem[]
}

const riskRank = (r: ZoneRisk) => RISK_ORDER.length - RISK_ORDER.indexOf(r)

export function ZonesPage() {
  const { user } = useAuth()
  const zones = INITIAL_ZONES
  const [lastRefresh, setLastRefresh] = useState(() => formatNow())
  const [refreshing, setRefreshing] = useState(false)

  const [region, setRegion] = useState<'toutes' | string>('toutes')
  const [localite, setLocalite] = useState('tous')
  const [periode, setPeriode] = useState<Periode>('30j')
  const [customFrom, setCustomFrom] = useState(SERIES_DATES[SERIES_DAYS - 30])
  const [customTo, setCustomTo] = useState(SERIES_DATES[SERIES_DAYS - 1])
  const [search, setSearch] = useState('')
  const [risksOn, setRisksOn] = useState<Set<ZoneRisk>>(() => new Set(RISK_ORDER))
  const [statutsOn, setStatutsOn] = useState<Set<ZoneStatut>>(() => new Set(ZSTATUT_ORDER))
  const [identF, setIdentF] = useState<IdentFilter>('tous')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'risque', dir: 'desc' })
  const [page, setPage] = useState(1)

  const [overrides, setOverrides] = useState<Record<string, Override>>({})
  const [selectedId, setSelectedId] = useState<string | null>(() => [...zones].sort((a, b) => riskRank(b.risk) - riskRank(a.risk) || b.score - a.score)[0]?.id ?? null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [popupId, setPopupId] = useState<string | null>(null)
  const [focus, setFocus] = useState<Focus>(NATIONAL_FOCUS)
  const [menu, setMenu] = useState<RowMenu | null>(null)
  const [statusModal, setStatusModal] = useState<{ id: string; preset: ZoneStatut } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const mapRef = useRef<HTMLElement | null>(null)
  const popupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const actor = user ? `Super Admin : ${user.firstName[0] ?? ''}. ${user.lastName}` : 'Super Admin'

  const statutOf = (z: Zone): ZoneStatut => overrides[z.id]?.statut ?? z.statut

  const byId = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones])

  /* --- Données dérivées ------------------------------------------------ */

  /** Fenêtre [start, end[ dans les 90 jours de données, selon la période choisie. */
  const win = useMemo(() => {
    if (periode === 'aujourdhui') return { start: SERIES_DAYS - 1, end: SERIES_DAYS }
    if (periode === '7j') return { start: SERIES_DAYS - 7, end: SERIES_DAYS }
    if (periode === '30j') return { start: SERIES_DAYS - 30, end: SERIES_DAYS }
    if (periode === '3m') return { start: 0, end: SERIES_DAYS }
    if (!customFrom || !customTo) return { start: 0, end: SERIES_DAYS }
    const [from, to] = customFrom <= customTo ? [customFrom, customTo] : [customTo, customFrom]
    let start = SERIES_DATES.findIndex((d) => d >= from)
    if (start < 0) start = SERIES_DAYS - 1
    let last = -1
    SERIES_DATES.forEach((d, i) => {
      if (d <= to) last = i
    })
    const end = Math.max(last + 1, start + 1)
    return { start, end: Math.min(end, SERIES_DAYS) }
  }, [periode, customFrom, customTo])

  /** Incidents et signalements de chaque zone sur la période choisie. */
  const counts = useMemo(() => new Map(zones.map((z) => [z.id, zoneCounts(z, win.start, win.end)])), [zones, win])

  /** Zones actives sur la période (au moins un événement), dans la région / localité choisies : base des compteurs. */
  const scoped = useMemo(
    () =>
      zones.filter((z) => {
        const c = counts.get(z.id)
        if (!c || c.incidents + c.signalements === 0) return false
        if (region !== 'toutes' && z.region !== region) return false
        return localite === 'tous' || z.locality === localite
      }),
    [zones, counts, region, localite],
  )

  const localiteOptions = useMemo(
    () => [...new Set(zones.filter((z) => region === 'toutes' || z.region === region).map((z) => z.locality))].sort((a, b) => a.localeCompare(b, 'fr')),
    [zones, region],
  )

  const kpis = useMemo(() => {
    let aValider = 0
    let validees = 0
    let eleve = 0
    for (const z of scoped) {
      const st = overrides[z.id]?.statut ?? z.statut
      if (st === 'a_valider') aValider++
      if (st === 'validee') validees++
      if (z.risk === 'eleve' || z.risk === 'critique') eleve++
    }
    return { total: scoped.length, aValider, validees, eleve }
  }, [scoped, overrides])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const minIdent = identF === 'tous' ? 0 : SERIES_DAYS - IDENT_DAYS[identF]
    const rows = scoped.filter((z) => {
      const st = overrides[z.id]?.statut ?? z.statut
      if (!risksOn.has(z.risk) || !statutsOn.has(st) || z.identDay < minIdent) return false
      if (!q) return true
      return z.id.toLowerCase().includes(q) || z.locality.toLowerCase().includes(q) || regionName(z.region).toLowerCase().includes(q) || RISK_META[z.risk].label.toLowerCase().includes(q)
    })
    const value = (z: Zone): number => {
      const c = counts.get(z.id)
      if (sort.key === 'zone') return z.num
      if (sort.key === 'incidents') return c?.incidents ?? 0
      if (sort.key === 'signalements') return c?.signalements ?? 0
      return riskRank(z.risk) * 100000 + z.score
    }
    const dir = sort.dir === 'asc' ? 1 : -1
    return rows.sort((a, b) => dir * (value(a) - value(b)) || a.num - b.num)
  }, [scoped, overrides, search, risksOn, statutsOn, identF, sort, counts])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const firstShown = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const lastShown = Math.min(currentPage * PAGE_SIZE, filtered.length)
  const hasFilters =
    region !== 'toutes' || localite !== 'tous' || periode !== '30j' || !!search.trim() || risksOn.size < RISK_ORDER.length || statutsOn.size < ZSTATUT_ORDER.length || identF !== 'tous'

  const selected = selectedId ? (byId.get(selectedId) ?? null) : null
  const popupZone = popupId ? (byId.get(popupId) ?? null) : null
  const menuZone = menu ? (byId.get(menu.id) ?? null) : null
  const modalZone = statusModal ? (byId.get(statusModal.id) ?? null) : null

  const historyOf = (z: Zone): ZoneHistoryItem[] => [...zoneBaseHistory(z), ...(overrides[z.id]?.extra ?? [])]

  /* --- Effets ----------------------------------------------------------- */

  useEffect(() => {
    setPage(1)
  }, [region, localite, periode, customFrom, customTo, search, risksOn, statutsOn, identF, sort])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3400)
    return () => clearTimeout(id)
  }, [toast])

  useEffect(() => {
    if (!refreshing) return
    const id = setTimeout(() => setRefreshing(false), 700)
    return () => clearTimeout(id)
  }, [refreshing])

  useEffect(
    () => () => {
      if (popupTimer.current) clearTimeout(popupTimer.current)
    },
    [],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (statusModal) setStatusModal(null)
      else if (menu) setMenu(null)
      else if (drawerOpen) setDrawerOpen(false)
    }
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-row-menu]')) setMenu(null)
    }
    const close = () => setMenu(null)
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [statusModal, menu, drawerOpen])

  /* --- Actions ---------------------------------------------------------- */

  const changeRegion = (value: string) => {
    setRegion(value)
    setLocalite('tous')
    setPopupId(null)
    setFocus(value === 'toutes' ? { ...NATIONAL_FOCUS } : { center: REGION_CENTERS[value] ?? NATIONAL_FOCUS.center, zoom: 9 })
  }

  const resetFilters = () => {
    changeRegion('toutes')
    setPeriode('30j')
    setSearch('')
    setRisksOn(new Set(RISK_ORDER))
    setStatutsOn(new Set(ZSTATUT_ORDER))
    setIdentF('tous')
  }

  const openDetail = (id: string) => {
    setSelectedId(id)
    setDrawerOpen(true)
  }

  /** Centre la carte sur la zone et ouvre sa fiche (après le survol, sinon elle est mal cadrée). */
  const locate = (z: Zone, scroll: boolean) => {
    setDrawerOpen(false)
    setSelectedId(z.id)
    setPopupId(null)
    setFocus({ center: [z.lat, z.lng], zoom: 14 })
    if (scroll) mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (popupTimer.current) clearTimeout(popupTimer.current)
    popupTimer.current = setTimeout(() => setPopupId(z.id), 950)
  }

  const openMenu = (e: ReactMouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation()
    if (menu?.id === id) {
      setMenu(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setMenu({ id, top: rect.bottom + 4, right: window.innerWidth - rect.right, up: window.innerHeight - rect.bottom < 300 })
  }

  const copy = async (label: string, value: string) => {
    setToast((await copyText(value)) ? `${label} copiée.` : "Impossible de copier : le navigateur a refusé l'accès au presse-papiers.")
  }

  const refresh = () => {
    // TODO backend : recharger la liste, les compteurs et la carte
    setLastRefresh(formatNow())
    setRefreshing(true)
    setToast('Données actualisées.')
  }

  const saveStatus = (z: Zone, statut: ZoneStatut, note: string) => {
    // TODO backend : PATCH du statut de la zone + motif / observation, journalisé dans l'historique
    const current = overrides[z.id]?.statut ?? z.statut
    const extra: ZoneHistoryItem[] = []
    if (statut !== current) extra.push({ at: stampNow(), text: `Statut → ${ZSTATUT_META[statut].label} (${actor})` })
    if (note) extra.push({ at: stampNow(), text: `${statut === 'rejetee' && statut !== current ? 'Motif' : 'Observation'} : « ${note} » (${actor})` })
    setOverrides((prev) => ({ ...prev, [z.id]: { statut, extra: [...(prev[z.id]?.extra ?? []), ...extra] } }))
    setStatusModal(null)
    setToast(statut !== current ? `${z.id} : « ${ZSTATUT_META[statut].label} ».` : 'Observation ajoutée.')
  }

  /** Les cartes de synthèse servent aussi de raccourcis de filtre. */
  const applyKpi = (key: 'total' | 'a_valider' | 'validee' | 'eleve') => {
    if (key === 'total') {
      setStatutsOn(new Set(ZSTATUT_ORDER))
      setRisksOn(new Set(RISK_ORDER))
    } else if (key === 'eleve') {
      setStatutsOn(new Set(ZSTATUT_ORDER))
      setRisksOn(new Set<ZoneRisk>(['critique', 'eleve']))
    } else {
      setStatutsOn(new Set<ZoneStatut>([key]))
      setRisksOn(new Set(RISK_ORDER))
    }
  }

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'zone' ? 'asc' : 'desc' }))

  /** Export CSV (séparateur « ; » et BOM UTF-8 pour s'ouvrir correctement dans Excel). */
  const exportCsv = () => {
    // TODO backend : export côté serveur
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
    const head = ['Zone', 'Localité', 'Région', 'Niveau de risque', 'Score', 'Incidents (période)', 'Signalements (période)', 'Statut', "Date d'identification", 'Latitude', 'Longitude']
    const rows = filtered.map((z) => {
      const c = counts.get(z.id)
      return [z.id, z.locality, regionName(z.region), RISK_META[z.risk].label, String(z.score), String(c?.incidents ?? 0), String(c?.signalements ?? 0), ZSTATUT_META[statutOf(z)].label, zoneDate(z.identDay), String(z.lat), String(z.lng)]
    })
    const csv = '﻿' + [head, ...rows].map((r) => r.map(esc).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `zones-saferoad-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    setToast(`${fmt(filtered.length)} zone${filtered.length > 1 ? 's' : ''} exportée${filtered.length > 1 ? 's' : ''}.`)
  }

  /* --- Rendu ------------------------------------------------------------ */

  const card = 'min-w-0 rounded-xl border border-line bg-white shadow-card'
  const selectCls =
    'w-full cursor-pointer rounded-[9px] border-[1.5px] border-line-field bg-white px-2.5 py-2 text-[12.5px] font-medium text-ink outline-none focus:border-brand-600'
  const headCard = 'flex min-w-[190px] cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-white px-3.5 py-2.5 shadow-card'
  const headBtn =
    'inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-line bg-white px-5 py-3.5 text-[13px] font-bold text-ink shadow-card transition-colors hover:bg-page'

  const isHigh = risksOn.size === 2 && risksOn.has('critique') && risksOn.has('eleve')
  const riskSelectValue = risksOn.size === RISK_ORDER.length ? 'tous' : isHigh ? 'haut' : risksOn.size === 1 ? [...risksOn][0] : 'multi'
  const statutSelectValue = statutsOn.size === ZSTATUT_ORDER.length ? 'tous' : statutsOn.size === 1 ? [...statutsOn][0] : 'multi'
  const allStatuts = statutsOn.size === ZSTATUT_ORDER.length
  const allRisks = risksOn.size === RISK_ORDER.length

  const kpiCards = [
    { key: 'total' as const, icon: 'location_on', tint: '#2b6cb0', soft: '#e8f0f9', label: 'Zones identifiées', value: kpis.total, sub: 'Zones détectées', active: allStatuts && allRisks },
    { key: 'a_valider' as const, icon: 'schedule', tint: '#e8940c', soft: '#fdf4e6', label: 'Zones à valider', value: kpis.aValider, sub: 'En attente de décision', active: statutsOn.size === 1 && statutsOn.has('a_valider') && allRisks },
    { key: 'validee' as const, icon: 'check_circle', tint: '#1f9d55', soft: '#e9f6ee', label: 'Zones validées', value: kpis.validees, sub: 'Zones officiellement retenues', active: statutsOn.size === 1 && statutsOn.has('validee') && allRisks },
    { key: 'eleve' as const, icon: 'warning', tint: '#dc3a2f', soft: '#fdeeec', label: 'Zones à risque élevé', value: kpis.eleve, sub: 'Niveau de risque élevé ou critique', active: isHigh && allStatuts },
  ]

  const pageButtons: (number | '…')[] = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const set = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1])
    const nums = [...set].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b)
    const out: (number | '…')[] = []
    nums.forEach((n, i) => {
      if (i > 0 && n - nums[i - 1] > 1) out.push('…')
      out.push(n)
    })
    return out
  })()

  const detailProps = (z: Zone): DetailProps => ({
    z,
    statut: statutOf(z),
    history: historyOf(z),
    counts: counts.get(z.id) ?? zoneCounts(z, win.start, win.end),
    periodeLabel: PERIODE_LABELS[periode],
    menuOpen: menu?.id === z.id,
    onClose: () => setDrawerOpen(false),
    onMenu: (e) => openMenu(e, z.id),
    onAction: (preset) => setStatusModal({ id: z.id, preset }),
    onLocate: () => locate(z, true),
  })

  const sortHeader = (key: SortKey, label: string, align: 'left' | 'right' = 'left') => (
    <th className={`px-3 py-3 ${align === 'right' ? 'text-right' : ''}`} aria-sort={sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center gap-0.5 hover:text-brand-600">
        {label}
        <span className={`ic text-base ${sort.key === key ? '' : 'opacity-0'}`}>{sort.dir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>
      </button>
    </th>
  )

  return (
    <div className="pb-8">
      {/* En-tête */}
      <section className="mx-6 mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="ic flex-none text-[44px] text-info-600">location_on</span>
          <div className="min-w-0">
            <h1 className="text-[clamp(24px,2.8vw,32px)] font-extrabold leading-[1.1] tracking-[-0.026em] text-navy-900">Zones accidentogènes</h1>
            <p className="mt-1 text-[13.5px] leading-relaxed text-info-600">Identification, analyse et suivi des zones à risque routier à l'échelle nationale.</p>
          </div>
        </div>
        <div className="ml-auto flex flex-col items-end gap-1.5">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <label className={headCard}>
              <span className="ic text-[22px] text-navy-900">place</span>
              <select
                value={region}
                onChange={(e) => changeRegion(e.target.value)}
                aria-label="Région"
                className="min-w-0 flex-1 cursor-pointer bg-transparent text-[12.5px] font-semibold text-ink outline-none"
              >
                <option value="toutes">Toutes les régions</option>
                {REGION_STATS.map((r) => (
                  <option key={r.slug} value={r.slug}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={headCard}>
              <span className="ic text-[22px] text-navy-900">calendar_month</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[10.5px] font-bold leading-tight text-body">Période :</span>
                <select
                  value={periode}
                  onChange={(e) => setPeriode(e.target.value as Periode)}
                  aria-label="Période"
                  className="min-w-0 cursor-pointer bg-transparent text-[12.5px] font-semibold text-ink outline-none"
                >
                  {(Object.keys(PERIODE_LABELS) as Periode[]).map((p) => (
                    <option key={p} value={p}>
                      {PERIODE_LABELS[p]}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <button type="button" onClick={refresh} className={headBtn}>
              <span className={`ic text-xl text-info-600 ${refreshing ? 'animate-spin' : ''}`}>refresh</span>
              Actualiser
            </button>
            <button type="button" onClick={exportCsv} disabled={filtered.length === 0} className={`${headBtn} disabled:cursor-not-allowed disabled:opacity-50`}>
              <span className="ic text-xl text-info-600">download</span>
              Exporter
            </button>
          </div>
          {periode === 'perso' && (
            <div className="flex flex-wrap items-center justify-end gap-2 text-[12px] font-semibold text-body">
              Du
              <input
                type="date"
                value={customFrom}
                min={SERIES_DATES[0]}
                max={SERIES_DATES[SERIES_DAYS - 1]}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-[9px] border-[1.5px] border-line bg-white px-2 py-1.5 text-[12px] font-semibold text-ink outline-none"
              />
              au
              <input
                type="date"
                value={customTo}
                min={SERIES_DATES[0]}
                max={SERIES_DATES[SERIES_DAYS - 1]}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-[9px] border-[1.5px] border-line bg-white px-2 py-1.5 text-[12px] font-semibold text-ink outline-none"
              />
            </div>
          )}
          <p className="m-0 text-[10.5px] font-medium text-faint">Dernière mise à jour : {lastRefresh}</p>
        </div>
      </section>

      {/* Cartes de synthèse (cliquables : elles filtrent la carte et la liste) */}
      <section className="mx-6 mt-4.5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((k) => (
          <button
            key={k.key}
            type="button"
            onClick={() => applyKpi(k.key)}
            aria-pressed={k.active}
            className={`${card} flex items-center gap-3.5 p-4 text-left transition-colors hover:bg-page/60 ${k.active && k.key !== 'total' ? 'ring-2 ring-brand-600' : ''}`}
          >
            <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full" style={{ background: k.soft, color: k.tint }}>
              <span className="ic text-[26px]">{k.icon}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold leading-tight text-ink">{k.label}</span>
              <span className="mt-0.5 block text-[28px] font-extrabold leading-none tracking-tight text-navy-900">{fmt(k.value)}</span>
              <span className="mt-1.5 block text-[11.5px] font-medium leading-snug text-info-600">{k.sub}</span>
            </span>
          </button>
        ))}
      </section>

      {/* Filtres */}
      <section className={`${card} mx-6 mt-4.5 flex flex-wrap items-end gap-3.5 p-4`}>
        <label className="relative min-w-[170px] flex-[2_1_170px]">
          <span className="ic pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xl text-faint">search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une zone, une localité, une région…"
            className="w-full rounded-[9px] border-[1.5px] border-line-field bg-field py-2.5 pl-10 pr-3 text-[12.5px] font-medium text-ink outline-none placeholder:text-faint focus:border-brand-600"
          />
        </label>
        <label className="block min-w-[165px] flex-[1_1_165px]">
          <span className="mb-1 block text-[11px] font-bold text-ink">Région</span>
          <select value={region} onChange={(e) => changeRegion(e.target.value)} className={selectCls}>
            <option value="toutes">Toutes les régions</option>
            {REGION_STATS.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-[165px] flex-[1_1_165px]">
          <span className="mb-1 block text-[11px] font-bold text-ink">Localité</span>
          <select value={localite} onChange={(e) => setLocalite(e.target.value)} className={selectCls}>
            <option value="tous">Toutes les localités</option>
            {localiteOptions.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-[165px] flex-[1_1_165px]">
          <span className="mb-1 block text-[11px] font-bold text-ink">Niveau de risque</span>
          <select
            value={riskSelectValue}
            onChange={(e) => {
              const v = e.target.value
              setRisksOn(v === 'tous' ? new Set(RISK_ORDER) : v === 'haut' ? new Set<ZoneRisk>(['critique', 'eleve']) : new Set([v as ZoneRisk]))
            }}
            className={selectCls}
          >
            <option value="tous">Tous les niveaux</option>
            {riskSelectValue === 'multi' && <option value="multi">Plusieurs niveaux</option>}
            <option value="haut">Élevé ou critique</option>
            {RISK_ORDER.map((r) => (
              <option key={r} value={r}>
                {RISK_META[r].label}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-[150px] flex-[1_1_150px]">
          <span className="mb-1 block text-[11px] font-bold text-ink">Statut</span>
          <select
            value={statutSelectValue}
            onChange={(e) => setStatutsOn(e.target.value === 'tous' ? new Set(ZSTATUT_ORDER) : new Set([e.target.value as ZoneStatut]))}
            className={selectCls}
          >
            <option value="tous">Tous les statuts</option>
            {statutSelectValue === 'multi' && <option value="multi">Plusieurs statuts</option>}
            {ZSTATUT_ORDER.map((st) => (
              <option key={st} value={st}>
                {ZSTATUT_META[st].label}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-[150px] flex-[1_1_150px]">
          <span className="mb-1 block text-[11px] font-bold text-ink">Identifiée</span>
          <select value={identF} onChange={(e) => setIdentF(e.target.value as IdentFilter)} className={selectCls}>
            <option value="tous">Toutes les dates</option>
            <option value="7j">7 derniers jours</option>
            <option value="30j">30 derniers jours</option>
            <option value="3m">3 derniers mois</option>
          </select>
        </label>
        <button
          type="button"
          onClick={resetFilters}
          disabled={!hasFilters}
          className="inline-flex items-center gap-1.5 whitespace-nowrap px-1 pb-2.5 text-[12px] font-bold text-info-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="ic text-lg">restart_alt</span>
          Réinitialiser
        </button>
      </section>

      <div className="mx-6 mt-4 grid grid-cols-1 items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Carte */}
          <section ref={mapRef} className={`${card} p-4`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="m-0 text-[15px] font-extrabold text-ink">Localisation des zones accidentogènes</p>
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-body">
                {[...RISK_ORDER].reverse().map((r) => (
                  <span key={r} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: RISK_META[r].color }} />
                    Risque {RISK_META[r].label.toLowerCase()}
                  </span>
                ))}
              </div>
            </div>
            <div className="relative isolate h-[340px] w-full overflow-hidden rounded-lg">
              <MapContainer center={NATIONAL_FOCUS.center} zoom={NATIONAL_FOCUS.zoom} className="h-full w-full" scrollWheelZoom={false} preferCanvas>
                <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <FlyTo focus={focus} />
                {/* Rayon d'analyse de la zone sélectionnée (visible en zoomant) */}
                {selected && (
                  <Circle
                    key={`r-${selected.id}`}
                    center={[selected.lat, selected.lng]}
                    radius={ZONE_RADIUS_M}
                    pathOptions={{ color: RISK_META[selected.risk].color, weight: 2, fillColor: RISK_META[selected.risk].color, fillOpacity: 0.12 }}
                  />
                )}
                {/* Les zones les plus risquées sont dessinées en dernier, donc au-dessus */}
                {[...filtered]
                  .sort((a, b) => riskRank(a.risk) - riskRank(b.risk) || a.score - b.score)
                  .map((z) => {
                    const sel = z.id === selectedId
                    const st = statutOf(z)
                    return (
                      <CircleMarker
                        key={z.id}
                        center={[z.lat, z.lng]}
                        radius={sel ? RISK_META[z.risk].radius + 3 : RISK_META[z.risk].radius}
                        pathOptions={{
                          color: sel ? '#073B4C' : '#fff',
                          weight: sel ? 3 : 1.5,
                          fillColor: RISK_META[z.risk].color,
                          fillOpacity: st === 'rejetee' ? 0.4 : 0.92,
                        }}
                        eventHandlers={{
                          click: () => {
                            if (popupTimer.current) clearTimeout(popupTimer.current)
                            setPopupId(z.id)
                          },
                        }}
                      />
                    )
                  })}
                {popupZone && (
                  <Popup
                    key={popupZone.id}
                    position={[popupZone.lat, popupZone.lng]}
                    offset={[0, -6]}
                    eventHandlers={{ remove: () => setPopupId((cur) => (cur === popupZone.id ? null : cur)) }}
                  >
                    <div className="w-[220px]">
                      <p className="m-0 flex flex-wrap items-center gap-1.5 text-[13px] font-extrabold text-ink">
                        {popupZone.id}
                        <RiskBadge risk={popupZone.risk} />
                      </p>
                      <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0 text-[11.5px] text-ink">
                        <li className="flex items-center gap-1.5">
                          <span className="ic text-base text-info-600">location_on</span>
                          {popupZone.locality}, {regionName(popupZone.region)}
                        </li>
                        <li className="flex items-center gap-1.5">
                          <span className="ic text-base text-info-600">hub</span>
                          {plural(counts.get(popupZone.id)?.incidents ?? 0, 'incident')} · {plural(counts.get(popupZone.id)?.signalements ?? 0, 'signalement')}
                        </li>
                        <li className="flex items-center gap-1.5">
                          <span className="ic text-base text-info-600">flag</span>
                          Statut : <StatutBadge statut={statutOf(popupZone)} />
                        </li>
                      </ul>
                      <button
                        type="button"
                        onClick={() => openDetail(popupZone.id)}
                        className="mt-2.5 w-full rounded-lg bg-info-600 px-2.5 py-1.5 text-[11.5px] font-bold text-white hover:opacity-90"
                      >
                        Voir le détail
                      </button>
                    </div>
                  </Popup>
                )}
              </MapContainer>
              {filtered.length === 0 && (
                <p className="pointer-events-none absolute inset-x-0 top-3 z-[500] m-0 text-center text-[11.5px] font-bold text-body">Aucune zone à afficher avec ces filtres.</p>
              )}
            </div>
          </section>

          {/* Liste */}
          <section className={`${card} p-5`}>
            <p className="m-0 mb-3 text-[15px] font-extrabold text-ink">
              Liste des zones <span className="font-medium text-body">({fmt(filtered.length)})</span>
            </p>

            <div className="overflow-x-auto rounded-lg border border-line-soft">
              <table className="w-full min-w-[900px] border-collapse text-left text-[12.5px]">
                <thead>
                  <tr className="bg-page text-[11.5px] font-bold text-ink">
                    {sortHeader('zone', 'Zone')}
                    <th className="px-3 py-3">Localité</th>
                    <th className="px-3 py-3">Région</th>
                    {sortHeader('risque', 'Risque')}
                    {sortHeader('incidents', 'Incidents')}
                    {sortHeader('signalements', 'Signalements')}
                    <th className="px-3 py-3">Statut</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((z) => {
                    const c = counts.get(z.id)
                    return (
                      <tr key={z.id} className={`border-t border-line-soft hover:bg-page/60 ${selectedId === z.id ? 'bg-info-50/60' : ''}`}>
                        <td className="py-2.5 pl-4 pr-3">
                          <button type="button" onClick={() => openDetail(z.id)} className="text-left text-[12.5px] font-extrabold text-ink hover:text-brand-600">
                            {z.id}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 font-medium text-ink">{z.locality}</td>
                        <td className="px-3 py-2.5 font-medium text-ink">{regionName(z.region)}</td>
                        <td className="px-3 py-2.5">
                          <RiskBadge risk={z.risk} />
                        </td>
                        <td className="px-3 py-2.5 font-medium tabular-nums text-ink">{c?.incidents ?? 0}</td>
                        <td className="px-3 py-2.5 font-medium tabular-nums text-ink">{c?.signalements ?? 0}</td>
                        <td className="px-3 py-2.5">
                          <StatutBadge statut={statutOf(z)} />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openDetail(z.id)}
                              className="rounded-lg border-[1.5px] border-line px-3 py-1.5 text-[12px] font-bold text-info-600 transition-colors hover:bg-page"
                            >
                              Voir
                            </button>
                            <button
                              type="button"
                              data-row-menu
                              onClick={(e) => openMenu(e, z.id)}
                              aria-label={`Plus d'actions pour ${z.id}`}
                              aria-haspopup="menu"
                              aria-expanded={menu?.id === z.id}
                              className="ic flex h-8 w-8 items-center justify-center rounded-lg text-xl text-body hover:bg-page"
                            >
                              more_vert
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {pageRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center">
                        <span className="ic text-4xl text-faint">search_off</span>
                        <p className="m-0 mt-2 text-[13px] font-bold text-ink">Aucune zone ne correspond à ces critères.</p>
                        {hasFilters && (
                          <button type="button" onClick={resetFilters} className="mt-2 text-[12px] font-bold text-info-600 hover:underline">
                            Réinitialiser les filtres
                          </button>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="m-0 text-[12px] font-medium text-info-600">
                Affichage de {fmt(firstShown)} à {fmt(lastShown)} sur {fmt(filtered.length)} zone{filtered.length > 1 ? 's' : ''}
              </p>
              {totalPages > 1 && (
                <nav className="flex items-center gap-1.5" aria-label="Pagination">
                  <button
                    type="button"
                    onClick={() => setPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    aria-label="Page précédente"
                    className="ic flex h-8 w-8 items-center justify-center rounded-lg border border-line text-lg text-body hover:bg-page disabled:opacity-35"
                  >
                    chevron_left
                  </button>
                  {pageButtons.map((p, idx) =>
                    p === '…' ? (
                      <span key={`gap-${idx}`} className="px-1 text-faint">
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPage(p)}
                        aria-current={p === currentPage ? 'page' : undefined}
                        className={`h-8 min-w-8 rounded-lg border px-2 text-[12px] font-bold ${
                          p === currentPage ? 'border-info-600 bg-info-600 text-white' : 'border-line text-ink hover:bg-page'
                        }`}
                      >
                        {fmt(p)}
                      </button>
                    ),
                  )}
                  <button
                    type="button"
                    onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    aria-label="Page suivante"
                    className="ic flex h-8 w-8 items-center justify-center rounded-lg border border-line text-lg text-body hover:bg-page disabled:opacity-35"
                  >
                    chevron_right
                  </button>
                </nav>
              )}
            </div>
          </section>
        </div>

        {/* Détail : à droite sur grand écran, en volet sinon */}
        <aside className="hidden min-w-0 2xl:sticky 2xl:top-4 2xl:block 2xl:max-h-[calc(100vh-2rem)] 2xl:overflow-y-auto">
          {selected ? (
            <DetailPanel key={selected.id} {...detailProps(selected)} />
          ) : (
            <div className={`${card} flex flex-col items-center gap-2 px-6 py-14 text-center`}>
              <span className="ic text-4xl text-faint">location_on</span>
              <p className="m-0 text-[13px] font-bold text-ink">Aucune zone sélectionnée</p>
              <p className="m-0 text-[12px] text-body">Cliquez sur « Voir » dans la liste ou sur un point de la carte.</p>
            </div>
          )}
        </aside>
      </div>

      {drawerOpen && selected && (
        <div className="fixed inset-0 z-[1800] bg-black/30 2xl:hidden" onMouseDown={() => setDrawerOpen(false)}>
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={`Détail de ${selected.id}`}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 h-full w-full max-w-[440px] overflow-y-auto bg-page p-4 shadow-xl"
          >
            <DetailPanel key={selected.id} {...detailProps(selected)} />
          </aside>
        </div>
      )}

      {/* Menu d'actions d'une ligne (ou du volet de détail) */}
      {menu && menuZone && (
        <div
          data-row-menu
          role="menu"
          className="fixed z-[2400] w-60 rounded-xl border border-line bg-white py-1.5 shadow-xl"
          style={menu.up ? { bottom: window.innerHeight - menu.top + 40, right: menu.right } : { top: menu.top, right: menu.right }}
        >
          {[
            { icon: 'visibility', label: 'Voir le détail', run: () => openDetail(menuZone.id), show: true },
            { icon: 'check_circle', label: 'Valider', run: () => setStatusModal({ id: menuZone.id, preset: 'validee' }), show: statutOf(menuZone) === 'a_valider' || statutOf(menuZone) === 'a_analyser' },
            { icon: 'cancel', label: 'Rejeter', run: () => setStatusModal({ id: menuZone.id, preset: 'rejetee' }), show: statutOf(menuZone) === 'a_valider' || statutOf(menuZone) === 'a_analyser' },
            { icon: 'troubleshoot', label: 'Renvoyer en analyse', run: () => setStatusModal({ id: menuZone.id, preset: 'a_analyser' }), show: statutOf(menuZone) === 'a_valider' },
            { icon: 'edit_note', label: 'Modifier le statut', run: () => setStatusModal({ id: menuZone.id, preset: statutOf(menuZone) }), show: statutOf(menuZone) === 'validee' || statutOf(menuZone) === 'rejetee' },
            { icon: 'my_location', label: 'Voir sur la carte', run: () => locate(menuZone, true), show: true },
            { icon: 'content_copy', label: 'Copier la référence', run: () => copy('Référence', menuZone.id), show: true },
          ]
            .filter((item) => item.show)
            .map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(null)
                  item.run()
                }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[12.5px] font-semibold text-ink hover:bg-page"
              >
                <span className="ic text-lg">{item.icon}</span>
                {item.label}
              </button>
            ))}
        </div>
      )}

      {modalZone && statusModal && (
        <StatusForm key={modalZone.id + statusModal.preset} z={modalZone} current={statutOf(modalZone)} preset={statusModal.preset} onSubmit={(st, note) => saveStatus(modalZone, st, note)} onClose={() => setStatusModal(null)} />
      )}

      {toast && (
        <div role="status" className="fixed bottom-6 right-6 z-[3000] max-w-sm rounded-xl bg-navy-900 px-4 py-3 text-[12.5px] font-semibold text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  )
}
