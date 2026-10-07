import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useAuth } from '@/context/AuthContext'
import { REGION_STATS, SERIES_DATES, SERIES_DAYS } from '@/data/superAdminHome'
import { driverById, driverExtras, incidentDate, incidentTime } from '@/data/superAdminIncidents'
import {
  CORRESPONDANCE_META,
  DANGER_META,
  DANGER_ORDER,
  INITIAL_SIGNALEMENTS,
  NEARBY_DAYS,
  NEARBY_RADIUS_M,
  SIG_STATUT_META,
  SIG_STATUT_ORDER,
  baseHistory,
  correspondanceOf,
  nearbyIncidents,
  sigDate,
  sigTime,
  type DangerType,
  type SigHistoryItem,
  type SigStatut,
  type Signalement,
} from '@/data/superAdminSignalements'
import { REGION_CENTERS } from '@/lib/regions'
import { PATHS } from '@/routes/paths'

/**
 * Super Admin → Signalements : dangers déclarés VOLONTAIREMENT par les
 * conducteurs depuis leur espace, reçus de toutes les régions, à vérifier puis
 * traiter. Ce n'est ni un incident (détecté automatiquement par le boîtier),
 * ni une zone (analyse de plusieurs événements), ni un problème technique
 * (Monitoring IoT) : un signalement n'est pas un danger confirmé tant qu'il n'a
 * pas été vérifié. Les événements « à proximité » sont de vrais incidents de la
 * page Incidents, qui servent à recouper la déclaration.
 *
 * Données de démonstration ; les changements de statut sont locaux
 * (// TODO backend).
 */

type Periode = 'aujourdhui' | '7j' | '30j' | '3m' | 'perso'
type DateFilter = 'tous' | 'aujourdhui' | '7j' | '30j'

const PERIODE_LABELS: Record<Periode, string> = {
  aujourdhui: "Aujourd'hui",
  '7j': '7 derniers jours',
  '30j': '30 derniers jours',
  '3m': '3 derniers mois',
  perso: 'Personnalisée',
}

const DATE_FILTER_DAYS: Record<Exclude<DateFilter, 'tous'>, number> = { aujourdhui: 1, '7j': 7, '30j': 30 }

const PAGE_SIZE = 7
/** Nombre maximal de points dessinés sur la carte. */
const MAP_LIMIT = 500

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

const eventsLabel = (n: number) => (n === 0 ? 'Aucun événement associé' : `${n} événement${n > 1 ? 's' : ''} à proximité`)

/* ------------------------------------------------------------------ */
/* Pastilles                                                           */
/* ------------------------------------------------------------------ */

function StatutBadge({ statut }: { statut: SigStatut }) {
  const m = SIG_STATUT_META[statut]
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
/* Panneau « Filtrer par région » (types et statuts)                   */
/* ------------------------------------------------------------------ */

interface FilterPanelProps {
  region: string
  onRegion: (v: string) => void
  showRegion: boolean
  typeCounts: Record<DangerType, number>
  typesOn: Set<DangerType>
  onToggleType: (t: DangerType) => void
  statutCounts: Record<SigStatut, number>
  statutsOn: Set<SigStatut>
  onToggleStatut: (s: SigStatut) => void
}

function FilterPanel({ region, onRegion, showRegion, typeCounts, typesOn, onToggleType, statutCounts, statutsOn, onToggleStatut }: FilterPanelProps) {
  const check = 'h-4 w-4 cursor-pointer accent-brand-600'
  return (
    <div className="min-w-0 rounded-xl border border-line bg-white p-4 shadow-card">
      {showRegion && (
        <>
          <p className="m-0 mb-2 text-[15px] font-extrabold text-ink">Filtrer par région</p>
          <select
            value={region}
            onChange={(e) => onRegion(e.target.value)}
            aria-label="Région"
            className="w-full cursor-pointer rounded-[9px] border-[1.5px] border-line-field bg-white px-2.5 py-2 text-[12.5px] font-medium text-ink outline-none focus:border-brand-600"
          >
            <option value="toutes">Toutes les régions</option>
            {REGION_STATS.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.label}
              </option>
            ))}
          </select>
        </>
      )}
      <div className={`grid gap-x-6 gap-y-4 ${showRegion ? 'mt-4 grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
        <div>
          <p className="m-0 mb-1.5 text-[13px] font-extrabold text-ink">Types de signalements</p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {DANGER_ORDER.map((t) => (
              <li key={t}>
                <label className="flex cursor-pointer items-center gap-2.5 py-0.5 text-[12.5px] font-medium text-ink">
                  <input type="checkbox" checked={typesOn.has(t)} onChange={() => onToggleType(t)} className={check} />
                  <span className="min-w-0 flex-1">{DANGER_META[t].label}</span>
                  <span className="text-[12px] font-semibold text-body">{fmt(typeCounts[t])}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="m-0 mb-1.5 text-[13px] font-extrabold text-ink">Statut</p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {SIG_STATUT_ORDER.map((s) => (
              <li key={s}>
                <label className="flex cursor-pointer items-center gap-2.5 py-0.5 text-[12.5px] font-medium text-ink">
                  <input type="checkbox" checked={statutsOn.has(s)} onChange={() => onToggleStatut(s)} className={check} />
                  <span className="min-w-0 flex-1">{SIG_STATUT_META[s].label}</span>
                  <span className="text-[12px] font-semibold text-body">{fmt(statutCounts[s])}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-info-50 px-3 py-3 text-[11.5px] leading-snug text-ink">
        <span className="ic mt-0.5 text-xl text-info-600">info</span>
        <p className="m-0">Un signalement n'est pas automatiquement considéré comme un danger confirmé. Il fait l'objet d'une vérification par nos équipes.</p>
      </div>
    </div>
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

function InfoRow({ icon, label, children }: { icon: string; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="flex flex-none items-center gap-2 text-[12px] font-medium text-body">
        <span className="ic text-base text-faint">{icon}</span>
        {label}
      </span>
      <span className="min-w-0 break-words text-right text-[12.5px] font-semibold text-ink">{children}</span>
    </div>
  )
}

interface DetailProps {
  s: Signalement
  statut: SigStatut
  history: SigHistoryItem[]
  menuOpen: boolean
  onClose: () => void
  onMenu: (e: ReactMouseEvent<HTMLButtonElement>) => void
  onAction: (preset: SigStatut) => void
  onLocate: () => void
}

function DetailPanel({ s, statut, history, menuOpen, onClose, onMenu, onAction, onLocate }: DetailProps) {
  const meta = DANGER_META[s.type]
  const driver = driverById.get(s.conducteurId)
  const extras = driverExtras(s.conducteurId)
  const near = nearbyIncidents(s)
  const corr = CORRESPONDANCE_META[correspondanceOf(s)]

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 text-[15px] font-extrabold text-ink">Détail du signalement</p>
        <button type="button" onClick={onClose} className="inline-flex items-center gap-1 text-[11.5px] font-bold text-info-600 hover:underline">
          <span className="ic text-base">arrow_back</span>
          Retour aux signalements
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full" style={{ background: meta.soft, color: meta.tint }}>
          <span className="ic text-xl">{meta.icon}</span>
        </span>
        <span className="text-[16px] font-extrabold text-ink">{s.id}</span>
        <StatutBadge statut={statut} />
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

      {/* Traitement */}
      <div className="flex flex-wrap gap-2">
        {statut === 'a_verifier' && (
          <button type="button" onClick={() => onAction('en_verification')} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-bold text-white hover:opacity-90" style={{ background: SIG_STATUT_META.en_verification.color }}>
            <span className="ic text-lg">search</span>
            Prendre en charge
          </button>
        )}
        {(statut === 'a_verifier' || statut === 'en_verification') && (
          <>
            <button type="button" onClick={() => onAction('valide')} className="inline-flex items-center gap-1.5 rounded-lg bg-success-600 px-3 py-2 text-[12px] font-bold text-white hover:opacity-90">
              <span className="ic text-lg">check_circle</span>
              Valider
            </button>
            <button type="button" onClick={() => onAction('rejete')} className="inline-flex items-center gap-1.5 rounded-lg border-[1.5px] border-danger-200 bg-white px-3 py-2 text-[12px] font-bold text-danger-600 hover:bg-danger-50">
              <span className="ic text-lg">cancel</span>
              Rejeter
            </button>
          </>
        )}
        <button type="button" onClick={() => onAction(statut)} className="inline-flex items-center gap-1.5 rounded-lg border-[1.5px] border-line bg-white px-3 py-2 text-[12px] font-bold text-info-600 hover:bg-page">
          <span className="ic text-lg">edit_note</span>
          Modifier le statut
        </button>
      </div>

      <figure className="m-0 rounded-lg bg-page px-3.5 py-3">
        <p className="m-0 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide text-faint">
          <span className="ic text-base">record_voice_over</span>
          Déclaré par le conducteur depuis son espace
        </p>
        <blockquote className="m-0 mt-1.5 text-[12.5px] italic leading-relaxed text-ink">« {s.description} »</blockquote>
      </figure>

      <Section icon="info" title="Informations générales">
        <InfoRow icon="category" label="Type de danger">
          {meta.label}
        </InfoRow>
        <InfoRow icon="event" label="Date">
          {sigDate(s)} {sigTime(s)}
        </InfoRow>
        <InfoRow icon="place" label="Région">
          {regionName(s.region)}
        </InfoRow>
        <InfoRow icon="location_on" label="Localisation">
          {s.locality}
        </InfoRow>
        <InfoRow icon="my_location" label="Position GPS">
          <button type="button" onClick={onLocate} className="text-info-600 hover:underline" title="Voir sur la carte">
            {s.lat.toFixed(4)} / {s.lng.toFixed(4)}
          </button>
        </InfoRow>
      </Section>

      <Section icon="person" title="Conducteur">
        <InfoRow icon="badge" label="Nom">
          {driver?.name ?? '—'}
        </InfoRow>
        <InfoRow icon="call" label="Téléphone">
          {extras.phone}
        </InfoRow>
        <InfoRow icon="directions_car" label="Véhicule">
          {driver?.plate ?? '—'} · {extras.model}
        </InfoRow>
        <InfoRow icon="memory" label="Boîtier">
          {s.boitierId ? (
            <Link to={`${PATHS.superAdmin.monitoring}?q=${s.boitierId}`} className="text-info-600 hover:underline" title="Voir son état dans Monitoring IoT">
              {s.boitierId}
            </Link>
          ) : (
            <span className="font-medium text-faint">Aucun boîtier</span>
          )}
        </InfoRow>
      </Section>

      <Section icon="fact_check" title="Vérification avec les données SafeRoad">
        <p className={`m-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold ${corr.cls}`}>
          <span className="ic text-base">{corr.icon}</span>
          {corr.label}
        </p>
        {near.length === 0 ? (
          <p className="m-0 mt-2 text-[12px] leading-snug text-body">
            Aucun incident détecté par un boîtier à moins de {NEARBY_RADIUS_M} m, à ±{NEARBY_DAYS} jours. Le danger n'a pas été constaté automatiquement.
          </p>
        ) : (
          <>
            <p className="m-0 mt-2 text-[11.5px] text-body">
              {eventsLabel(near.length)} (rayon {NEARBY_RADIUS_M} m, ±{NEARBY_DAYS} jours) :
            </p>
            <ul className="m-0 mt-1 flex list-none flex-col p-0">
              {near.slice(0, 5).map(({ incident: i, distanceM }) => (
                <li key={i.id} className="flex items-center gap-2 border-t border-line-soft py-1.5 text-[12px] first:border-t-0">
                  <Link to={`${PATHS.superAdmin.incidents}?q=${i.id}`} className="font-extrabold text-info-600 hover:underline" title="Ouvrir dans Incidents">
                    {i.id}
                  </Link>
                  <span className="min-w-0 flex-1 truncate text-body">
                    {i.type} · {incidentDate(i)} {incidentTime(i)}
                  </span>
                  <span className="flex-none text-[11.5px] font-semibold text-ink">{distanceM} m</span>
                </li>
              ))}
            </ul>
            {near.length > 5 && <p className="m-0 mt-1 text-[11.5px] text-body">+ {near.length - 5} autre{near.length - 5 > 1 ? 's' : ''} événement{near.length - 5 > 1 ? 's' : ''}.</p>}
          </>
        )}
      </Section>

      <Section icon="history" title="Historique du signalement">
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
  s,
  current,
  preset,
  onSubmit,
  onClose,
}: {
  s: Signalement
  current: SigStatut
  preset: SigStatut
  onSubmit: (statut: SigStatut, note: string) => void
  onClose: () => void
}) {
  const [statut, setStatut] = useState<SigStatut>(preset)
  const [note, setNote] = useState('')
  const changed = statut !== current
  const needsReason = statut === 'rejete' && changed
  const canSave = needsReason ? note.trim().length > 0 : changed || note.trim().length > 0

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (canSave) onSubmit(statut, note.trim())
  }

  return (
    <ModalShell title={`Traiter ${s.id}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div role="radiogroup" aria-label="Statut" className="flex flex-col gap-2">
          {SIG_STATUT_ORDER.map((st) => {
            const m = SIG_STATUT_META[st]
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
            placeholder={needsReason ? 'Pourquoi ce signalement n\'est-il pas retenu ?' : "Ajouter une précision à l'historique du signalement…"}
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
  statut: SigStatut
  extra: SigHistoryItem[]
}

export function SignalementsPage() {
  const { user } = useAuth()
  const signalements = INITIAL_SIGNALEMENTS
  const [lastRefresh, setLastRefresh] = useState(() => formatNow())
  const [refreshing, setRefreshing] = useState(false)

  const [region, setRegion] = useState<'toutes' | string>('toutes')
  const [periode, setPeriode] = useState<Periode>('30j')
  const [customFrom, setCustomFrom] = useState(SERIES_DATES[SERIES_DAYS - 30])
  const [customTo, setCustomTo] = useState(SERIES_DATES[SERIES_DAYS - 1])
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '')
  const [typesOn, setTypesOn] = useState<Set<DangerType>>(() => new Set(DANGER_ORDER))
  const [statutsOn, setStatutsOn] = useState<Set<SigStatut>>(() => new Set(SIG_STATUT_ORDER))
  const [dateF, setDateF] = useState<DateFilter>('tous')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)

  const [overrides, setOverrides] = useState<Record<string, Override>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [popupId, setPopupId] = useState<string | null>(null)
  const [focus, setFocus] = useState<Focus>(NATIONAL_FOCUS)
  const [menu, setMenu] = useState<RowMenu | null>(null)
  const [statusModal, setStatusModal] = useState<{ id: string; preset: SigStatut } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const mapRef = useRef<HTMLElement | null>(null)
  const popupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const actor = user ? `Super Admin : ${user.firstName[0] ?? ''}. ${user.lastName}` : 'Super Admin'

  const statutOf = (s: Signalement): SigStatut => overrides[s.id]?.statut ?? s.statut

  const byId = useMemo(() => new Map(signalements.map((s) => [s.id, s])), [signalements])

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

  /** Région + période : base des compteurs. */
  const scoped = useMemo(
    () => signalements.filter((s) => s.day >= win.start && s.day < win.end && (region === 'toutes' || s.region === region)),
    [signalements, win, region],
  )

  const kpis = useMemo(() => {
    let aVerifier = 0
    let enVerif = 0
    let valides = 0
    for (const s of scoped) {
      const st = overrides[s.id]?.statut ?? s.statut
      if (st === 'a_verifier') aVerifier++
      else if (st === 'en_verification') enVerif++
      else if (st === 'valide') valides++
    }
    return { total: scoped.length, aVerifier, enVerif, valides }
  }, [scoped, overrides])

  /** Applique les filtres, sauf (au choix) celui des types ou celui des statuts : sert aux compteurs des cases à cocher. */
  const applyFilters = (skip: 'type' | 'statut' | null) => {
    const q = search.trim().toLowerCase()
    const minDay = dateF === 'tous' ? 0 : SERIES_DAYS - DATE_FILTER_DAYS[dateF]
    return scoped.filter((s) => {
      const st = overrides[s.id]?.statut ?? s.statut
      if (s.day < minDay) return false
      if (skip !== 'type' && !typesOn.has(s.type)) return false
      if (skip !== 'statut' && !statutsOn.has(st)) return false
      if (!q) return true
      const d = driverById.get(s.conducteurId)
      return (
        s.id.toLowerCase().includes(q) ||
        DANGER_META[s.type].label.toLowerCase().includes(q) ||
        s.locality.toLowerCase().includes(q) ||
        regionName(s.region).toLowerCase().includes(q) ||
        (d?.name.toLowerCase().includes(q) ?? false) ||
        (d?.plate.toLowerCase().includes(q) ?? false)
      )
    })
  }

  const filtered = useMemo(() => {
    const rows = applyFilters(null)
    return rows.sort((a, b) => (sortDir === 'asc' ? 1 : -1) * (a.num - b.num))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoped, overrides, search, typesOn, statutsOn, dateF, sortDir])

  const typeCounts = useMemo(() => {
    const c = Object.fromEntries(DANGER_ORDER.map((t) => [t, 0])) as Record<DangerType, number>
    for (const s of applyFilters('type')) c[s.type]++
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoped, overrides, search, statutsOn, dateF])

  const statutCounts = useMemo(() => {
    const c = Object.fromEntries(SIG_STATUT_ORDER.map((t) => [t, 0])) as Record<SigStatut, number>
    for (const s of applyFilters('statut')) c[overrides[s.id]?.statut ?? s.statut]++
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoped, overrides, search, typesOn, dateF])

  /** Points de la carte : d'abord les signalements à traiter, puis les plus récents. */
  const mapItems = useMemo(() => {
    const rank = (s: Signalement) => SIG_STATUT_ORDER.indexOf(overrides[s.id]?.statut ?? s.statut)
    const ranked = filtered.length <= MAP_LIMIT ? [...filtered] : [...filtered].sort((a, b) => rank(a) - rank(b) || b.num - a.num).slice(0, MAP_LIMIT)
    // Les signalements à traiter sont dessinés en dernier, donc au-dessus.
    return ranked.sort((a, b) => rank(b) - rank(a))
  }, [filtered, overrides])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const firstShown = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const lastShown = Math.min(currentPage * PAGE_SIZE, filtered.length)
  const hasFilters =
    region !== 'toutes' || periode !== '30j' || !!search.trim() || typesOn.size < DANGER_ORDER.length || statutsOn.size < SIG_STATUT_ORDER.length || dateF !== 'tous'

  const selected = selectedId ? (byId.get(selectedId) ?? null) : null
  const popupSig = popupId ? (byId.get(popupId) ?? null) : null
  const menuSig = menu ? (byId.get(menu.id) ?? null) : null
  const modalSig = statusModal ? (byId.get(statusModal.id) ?? null) : null

  const historyOf = (s: Signalement): SigHistoryItem[] => [...baseHistory(s), ...(overrides[s.id]?.extra ?? [])]

  /* --- Effets ----------------------------------------------------------- */

  useEffect(() => {
    setPage(1)
  }, [region, periode, customFrom, customTo, search, typesOn, statutsOn, dateF])

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
      else if (selectedId) setSelectedId(null)
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
  }, [statusModal, menu, selectedId])

  /* --- Actions ---------------------------------------------------------- */

  const changeRegion = (value: string) => {
    setRegion(value)
    setPopupId(null)
    setFocus(value === 'toutes' ? { ...NATIONAL_FOCUS } : { center: REGION_CENTERS[value] ?? NATIONAL_FOCUS.center, zoom: 9 })
  }

  const resetFilters = () => {
    changeRegion('toutes')
    setPeriode('30j')
    setSearch('')
    setTypesOn(new Set(DANGER_ORDER))
    setStatutsOn(new Set(SIG_STATUT_ORDER))
    setDateF('tous')
  }

  const toggleType = (t: DangerType) =>
    setTypesOn((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })

  const toggleStatut = (st: SigStatut) =>
    setStatutsOn((prev) => {
      const next = new Set(prev)
      if (next.has(st)) next.delete(st)
      else next.add(st)
      return next
    })

  /** Les listes déroulantes « Type » et « Statut » pilotent les mêmes cases à cocher. */
  const typeSelectValue = typesOn.size === DANGER_ORDER.length ? 'tous' : typesOn.size === 1 ? [...typesOn][0] : 'multi'
  const statutSelectValue = statutsOn.size === SIG_STATUT_ORDER.length ? 'tous' : statutsOn.size === 1 ? [...statutsOn][0] : 'multi'

  const openDetail = (id: string) => setSelectedId(id)

  /** Centre la carte sur le signalement et ouvre sa fiche (après le survol, sinon elle est mal cadrée). */
  const locate = (s: Signalement, scroll: boolean) => {
    setPopupId(null)
    setFocus({ center: [s.lat, s.lng], zoom: 13 })
    if (scroll) mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (popupTimer.current) clearTimeout(popupTimer.current)
    popupTimer.current = setTimeout(() => setPopupId(s.id), 950)
  }

  const openMenu = (e: ReactMouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation()
    if (menu?.id === id) {
      setMenu(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setMenu({ id, top: rect.bottom + 4, right: window.innerWidth - rect.right, up: window.innerHeight - rect.bottom < 280 })
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

  const saveStatus = (s: Signalement, statut: SigStatut, note: string) => {
    // TODO backend : PATCH du statut du signalement + ajout d'une observation / d'un motif de rejet
    const current = overrides[s.id]?.statut ?? s.statut
    const extra: SigHistoryItem[] = []
    if (statut !== current) extra.push({ at: stampNow(), text: `Statut → ${SIG_STATUT_META[statut].label} (${actor})` })
    if (note) extra.push({ at: stampNow(), text: `${statut === 'rejete' && statut !== current ? 'Motif' : 'Observation'} : « ${note} » (${actor})` })
    setOverrides((prev) => ({ ...prev, [s.id]: { statut, extra: [...(prev[s.id]?.extra ?? []), ...extra] } }))
    setStatusModal(null)
    setToast(statut !== current ? `${s.id} : « ${SIG_STATUT_META[statut].label} ».` : 'Observation ajoutée.')
  }

  /** Les cartes de synthèse servent aussi de raccourcis de filtre. */
  const applyKpi = (key: 'total' | SigStatut) => {
    setStatutsOn(key === 'total' ? new Set(SIG_STATUT_ORDER) : new Set([key]))
  }

  /** Export CSV (séparateur « ; » et BOM UTF-8 pour s'ouvrir correctement dans Excel). */
  const exportCsv = () => {
    // TODO backend : export côté serveur pour les très gros volumes
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
    const head = ['Référence', 'Type', 'Région', 'Localité', 'Conducteur', 'Véhicule', 'Date', 'Heure', 'Statut', 'Événements à proximité']
    const rows = filtered.map((s) => {
      const d = driverById.get(s.conducteurId)
      return [s.id, DANGER_META[s.type].label, regionName(s.region), s.locality, d?.name ?? '', d?.plate ?? '', sigDate(s), sigTime(s), SIG_STATUT_META[statutOf(s)].label, String(nearbyIncidents(s).length)]
    })
    const csv = '﻿' + [head, ...rows].map((r) => r.map(esc).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `signalements-saferoad-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    setToast(`${fmt(filtered.length)} signalement${filtered.length > 1 ? 's' : ''} exporté${filtered.length > 1 ? 's' : ''}.`)
  }

  /* --- Rendu ------------------------------------------------------------ */

  const card = 'min-w-0 rounded-xl border border-line bg-white shadow-card'
  const selectCls =
    'w-full cursor-pointer rounded-[9px] border-[1.5px] border-line-field bg-white px-2.5 py-2 text-[12.5px] font-medium text-ink outline-none focus:border-brand-600'
  const headCard = 'flex min-w-[190px] cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-white px-3.5 py-2.5 shadow-card'
  const headBtn =
    'inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-line bg-white px-5 py-3.5 text-[13px] font-bold text-ink shadow-card transition-colors hover:bg-page'

  const kpiCards = [
    { key: 'total' as const, icon: 'campaign', tint: '#2b6cb0', soft: '#e8f0f9', label: 'Total signalements', value: kpis.total, sub: 'Signalements reçus', active: statutsOn.size === SIG_STATUT_ORDER.length },
    { key: 'a_verifier' as const, icon: 'schedule', tint: '#e8940c', soft: '#fdf4e6', label: 'À vérifier', value: kpis.aVerifier, sub: 'En attente de traitement', active: statutsOn.size === 1 && statutsOn.has('a_verifier') },
    { key: 'en_verification' as const, icon: 'search', tint: '#7c3aed', soft: '#f1eafe', label: 'En cours de vérification', value: kpis.enVerif, sub: "Signalements en cours d'analyse", active: statutsOn.size === 1 && statutsOn.has('en_verification') },
    { key: 'valide' as const, icon: 'check_circle', tint: '#1f9d55', soft: '#e9f6ee', label: 'Validés', value: kpis.valides, sub: 'Signalements confirmés', active: statutsOn.size === 1 && statutsOn.has('valide') },
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

  const filterPanelProps = (showRegion: boolean): FilterPanelProps => ({
    region,
    onRegion: changeRegion,
    showRegion,
    typeCounts,
    typesOn,
    onToggleType: toggleType,
    statutCounts,
    statutsOn,
    onToggleStatut: toggleStatut,
  })

  return (
    <div className="pb-8">
      {/* En-tête */}
      <section className="mx-6 mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="ic flex-none text-[44px] text-info-600">campaign</span>
          <div className="min-w-0">
            <h1 className="text-[clamp(24px,2.8vw,32px)] font-extrabold leading-[1.1] tracking-[-0.026em] text-navy-900">Signalements</h1>
            <p className="mt-1 text-[13.5px] leading-relaxed text-info-600">Gestion et vérification des dangers signalés par les conducteurs.</p>
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
        <label className="relative min-w-[220px] flex-[2_1_260px]">
          <span className="ic pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xl text-faint">search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Signalement, conducteur, localité…"
            className="w-full rounded-[9px] border-[1.5px] border-line-field bg-field py-2.5 pl-10 pr-3 text-[12.5px] font-medium text-ink outline-none placeholder:text-faint focus:border-brand-600"
          />
        </label>
        <label className="block min-w-[150px] flex-[1_1_150px]">
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
        <label className="block min-w-[150px] flex-[1_1_150px]">
          <span className="mb-1 block text-[11px] font-bold text-ink">Type</span>
          <select
            value={typeSelectValue}
            onChange={(e) => setTypesOn(e.target.value === 'tous' ? new Set(DANGER_ORDER) : new Set([e.target.value as DangerType]))}
            className={selectCls}
          >
            <option value="tous">Tous les types</option>
            {typeSelectValue === 'multi' && <option value="multi">Plusieurs types</option>}
            {DANGER_ORDER.map((t) => (
              <option key={t} value={t}>
                {DANGER_META[t].label}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-[130px] flex-[1_1_130px]">
          <span className="mb-1 block text-[11px] font-bold text-ink">Statut</span>
          <select
            value={statutSelectValue}
            onChange={(e) => setStatutsOn(e.target.value === 'tous' ? new Set(SIG_STATUT_ORDER) : new Set([e.target.value as SigStatut]))}
            className={selectCls}
          >
            <option value="tous">Tous les statuts</option>
            {statutSelectValue === 'multi' && <option value="multi">Plusieurs statuts</option>}
            {SIG_STATUT_ORDER.map((st) => (
              <option key={st} value={st}>
                {SIG_STATUT_META[st].label}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-[130px] flex-[1_1_130px]">
          <span className="mb-1 block text-[11px] font-bold text-ink">Date</span>
          <select value={dateF} onChange={(e) => setDateF(e.target.value as DateFilter)} className={selectCls}>
            <option value="tous">Toutes les dates</option>
            <option value="aujourdhui">Aujourd'hui</option>
            <option value="7j">7 derniers jours</option>
            <option value="30j">30 derniers jours</option>
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

      {/* Sous 1536 px, le panneau des types et statuts passe au-dessus de la carte */}
      <div className="mx-6 mt-4 2xl:hidden">
        <FilterPanel {...filterPanelProps(false)} />
      </div>

      <div className="mx-6 mt-4 grid grid-cols-1 items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Carte */}
          <section ref={mapRef} className={`${card} p-4`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="m-0 text-[15px] font-extrabold text-ink">Localisation des signalements</p>
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-body">
                {SIG_STATUT_ORDER.map((st) => (
                  <span key={st} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: SIG_STATUT_META[st].color }} />
                    {SIG_STATUT_META[st].label}
                  </span>
                ))}
              </div>
            </div>
            <div className="relative isolate h-[320px] w-full overflow-hidden rounded-lg">
              <MapContainer center={NATIONAL_FOCUS.center} zoom={NATIONAL_FOCUS.zoom} className="h-full w-full" scrollWheelZoom={false} preferCanvas>
                <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <FlyTo focus={focus} />
                {mapItems.map((s) => {
                  const sel = s.id === selectedId
                  return (
                    <CircleMarker
                      key={s.id}
                      center={[s.lat, s.lng]}
                      radius={sel ? 10 : 7}
                      pathOptions={{ color: sel ? '#073B4C' : '#fff', weight: sel ? 3 : 1.5, fillColor: SIG_STATUT_META[overrides[s.id]?.statut ?? s.statut].color, fillOpacity: 0.92 }}
                      eventHandlers={{
                        click: () => {
                          if (popupTimer.current) clearTimeout(popupTimer.current)
                          setPopupId(s.id)
                        },
                      }}
                    />
                  )
                })}
                {popupSig && (
                  <Popup
                    key={popupSig.id}
                    position={[popupSig.lat, popupSig.lng]}
                    offset={[0, -6]}
                    eventHandlers={{ remove: () => setPopupId((cur) => (cur === popupSig.id ? null : cur)) }}
                  >
                    <div className="w-[220px]">
                      <p className="m-0 flex flex-wrap items-center gap-1.5 text-[13px] font-extrabold text-ink">
                        {popupSig.id}
                        <StatutBadge statut={statutOf(popupSig)} />
                      </p>
                      <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0 text-[11.5px] text-ink">
                        <li className="flex items-center gap-1.5">
                          <span className="ic text-base" style={{ color: DANGER_META[popupSig.type].tint }}>
                            {DANGER_META[popupSig.type].icon}
                          </span>
                          {DANGER_META[popupSig.type].label}
                        </li>
                        <li className="flex items-center gap-1.5">
                          <span className="ic text-base text-info-600">location_on</span>
                          {popupSig.locality}, {regionName(popupSig.region)}
                        </li>
                        <li className="flex items-center gap-1.5">
                          <span className="ic text-base text-info-600">person</span>
                          {driverById.get(popupSig.conducteurId)?.name ?? '—'}
                        </li>
                        <li className="flex items-center gap-1.5">
                          <span className="ic text-base text-info-600">event</span>
                          {sigDate(popupSig)} — {sigTime(popupSig)}
                        </li>
                      </ul>
                      <button
                        type="button"
                        onClick={() => openDetail(popupSig.id)}
                        className="mt-2.5 w-full rounded-lg bg-info-600 px-2.5 py-1.5 text-[11.5px] font-bold text-white hover:opacity-90"
                      >
                        Voir le signalement
                      </button>
                    </div>
                  </Popup>
                )}
              </MapContainer>
              {filtered.length > MAP_LIMIT && (
                <p className="pointer-events-none absolute bottom-2 left-2 z-[1000] m-0 max-w-[75%] rounded-lg border border-line bg-white/95 px-2.5 py-1.5 text-[10.5px] font-semibold text-body shadow-card">
                  {fmt(MAP_LIMIT)} signalements affichés sur {fmt(filtered.length)} (à traiter en priorité, puis les plus récents). Affinez les filtres pour voir les autres.
                </p>
              )}
              {filtered.length === 0 && (
                <p className="pointer-events-none absolute inset-x-0 top-3 z-[500] m-0 text-center text-[11.5px] font-bold text-body">
                  Aucun signalement à afficher avec ces filtres.
                </p>
              )}
            </div>
          </section>

          {/* Liste */}
          <section className={`${card} p-5`}>
            <p className="m-0 mb-3 text-[15px] font-extrabold text-ink">
              Liste des signalements <span className="font-medium text-body">({fmt(filtered.length)})</span>
            </p>

            <div className="overflow-x-auto rounded-lg border border-line-soft">
              <table className="w-full min-w-[1040px] border-collapse text-left text-[12.5px]">
                <thead>
                  <tr className="bg-page text-[11.5px] font-bold text-ink">
                    <th className="py-3 pl-4 pr-3">Référence</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3">Localisation</th>
                    <th className="px-3 py-3">Conducteur</th>
                    <th className="px-3 py-3">
                      <button type="button" onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))} className="inline-flex items-center gap-0.5 hover:text-brand-600" aria-label="Trier par date">
                        Date
                        <span className="ic text-base">{sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>
                      </button>
                    </th>
                    <th className="px-3 py-3">Statut</th>
                    <th className="px-3 py-3">Incidents associés</th>
                    <th className="px-3 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((s) => {
                    const n = nearbyIncidents(s).length
                    return (
                      <tr key={s.id} className={`border-t border-line-soft hover:bg-page/60 ${selectedId === s.id ? 'bg-info-50/60' : ''}`}>
                        <td className="py-2.5 pl-4 pr-3">
                          <button type="button" onClick={() => openDetail(s.id)} className="text-left text-[12.5px] font-extrabold text-ink hover:text-brand-600">
                            {s.id}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 font-medium text-ink">{DANGER_META[s.type].label}</td>
                        <td className="px-3 py-2.5 font-medium text-ink">
                          {s.locality}, {regionName(s.region)}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-ink">{driverById.get(s.conducteurId)?.name ?? '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-medium text-ink">
                          {sigDate(s)} {sigTime(s)}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatutBadge statut={statutOf(s)} />
                        </td>
                        <td className={`whitespace-nowrap px-3 py-2.5 font-medium ${n === 0 ? 'text-body' : 'text-ink'}`}>{eventsLabel(n)}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openDetail(s.id)}
                              className="rounded-lg border-[1.5px] border-line px-3 py-1.5 text-[12px] font-bold text-info-600 transition-colors hover:bg-page"
                            >
                              Voir
                            </button>
                            <button
                              type="button"
                              data-row-menu
                              onClick={(e) => openMenu(e, s.id)}
                              aria-label={`Plus d'actions pour ${s.id}`}
                              aria-haspopup="menu"
                              aria-expanded={menu?.id === s.id}
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
                        <p className="m-0 mt-2 text-[13px] font-bold text-ink">Aucun signalement ne correspond à ces critères.</p>
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
                Affichage de {fmt(firstShown)} à {fmt(lastShown)} sur {fmt(filtered.length)} signalement{filtered.length > 1 ? 's' : ''}
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

        {/* Panneau des types et statuts : à droite sur grand écran */}
        <aside className="hidden min-w-0 2xl:sticky 2xl:top-4 2xl:block">
          <FilterPanel {...filterPanelProps(true)} />
        </aside>
      </div>

      {/* Détail : toujours en volet (la colonne de droite est prise par les filtres) */}
      {selected && (
        <div className="fixed inset-0 z-[1800] bg-black/30" onMouseDown={() => setSelectedId(null)}>
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={`Détail de ${selected.id}`}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 h-full w-full max-w-[440px] overflow-y-auto bg-page p-4 shadow-xl"
          >
            <DetailPanel
              key={selected.id}
              s={selected}
              statut={statutOf(selected)}
              history={historyOf(selected)}
              menuOpen={menu?.id === selected.id}
              onClose={() => setSelectedId(null)}
              onMenu={(e) => openMenu(e, selected.id)}
              onAction={(preset) => setStatusModal({ id: selected.id, preset })}
              onLocate={() => {
                setSelectedId(null)
                locate(selected, true)
              }}
            />
          </aside>
        </div>
      )}

      {/* Menu d'actions d'une ligne (ou du volet de détail) */}
      {menu && menuSig && (
        <div
          data-row-menu
          role="menu"
          className="fixed z-[2400] w-60 rounded-xl border border-line bg-white py-1.5 shadow-xl"
          style={menu.up ? { bottom: window.innerHeight - menu.top + 40, right: menu.right } : { top: menu.top, right: menu.right }}
        >
          {[
            { icon: 'visibility', label: 'Voir le détail', run: () => openDetail(menuSig.id), show: true },
            { icon: 'search', label: 'Prendre en charge', run: () => setStatusModal({ id: menuSig.id, preset: 'en_verification' }), show: statutOf(menuSig) === 'a_verifier' },
            { icon: 'check_circle', label: 'Valider', run: () => setStatusModal({ id: menuSig.id, preset: 'valide' }), show: statutOf(menuSig) === 'a_verifier' || statutOf(menuSig) === 'en_verification' },
            { icon: 'cancel', label: 'Rejeter', run: () => setStatusModal({ id: menuSig.id, preset: 'rejete' }), show: statutOf(menuSig) === 'a_verifier' || statutOf(menuSig) === 'en_verification' },
            { icon: 'edit_note', label: 'Modifier le statut', run: () => setStatusModal({ id: menuSig.id, preset: statutOf(menuSig) }), show: statutOf(menuSig) === 'valide' || statutOf(menuSig) === 'rejete' },
            { icon: 'my_location', label: 'Voir sur la carte', run: () => locate(menuSig, true), show: true },
            { icon: 'content_copy', label: 'Copier la référence', run: () => copy('Référence', menuSig.id), show: true },
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

      {modalSig && statusModal && (
        <StatusForm key={modalSig.id + statusModal.preset} s={modalSig} current={statutOf(modalSig)} preset={statusModal.preset} onSubmit={(st, note) => saveStatus(modalSig, st, note)} onClose={() => setStatusModal(null)} />
      )}

      {toast && (
        <div role="status" className="fixed bottom-6 right-6 z-[3000] max-w-sm rounded-xl bg-navy-900 px-4 py-3 text-[12.5px] font-semibold text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  )
}
