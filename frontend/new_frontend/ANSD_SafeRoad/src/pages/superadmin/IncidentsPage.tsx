import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useAuth } from '@/context/AuthContext'
import { REGION_STATS, SERIES_DATES, SERIES_DAYS } from '@/data/superAdminHome'
import {
  GRAVITE_META,
  GRAVITE_ORDER,
  INCIDENT_TYPES,
  INITIAL_INCIDENTS,
  LOCALITY_NAMES,
  STATUT_META,
  STATUT_ORDER,
  TYPE_ICON,
  baseHistory,
  driverById,
  driverExtras,
  incidentDate,
  incidentTime,
  needsAttention,
  type Gravite,
  type HistoryItem,
  type Incident,
  type IncidentType,
  type Statut,
} from '@/data/superAdminIncidents'
import { REGION_CENTERS } from '@/lib/regions'
import { PATHS } from '@/routes/paths'

/**
 * Super Admin → Incidents : vue NATIONALE des événements routiers détectés par
 * les boîtiers SafeRoad (type, localisation, boîtier détecteur, conducteur et
 * véhicule concernés, gravité, statut, détail).
 *
 * Les incidents suivent les séries du Dashboard national : mêmes totaux pour une
 * même région et une même période. Données de démonstration ; les modifications
 * de statut sont locales (// TODO backend).
 */

type Periode = 'aujourdhui' | '7j' | '30j' | '3m' | 'perso'

const PERIODE_LABELS: Record<Periode, string> = {
  aujourdhui: "Aujourd'hui",
  '7j': '7 derniers jours',
  '30j': '30 derniers jours',
  '3m': '3 derniers mois',
  perso: 'Personnalisée',
}

const PAGE_SIZE = 6
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

/* ------------------------------------------------------------------ */
/* Pastilles                                                           */
/* ------------------------------------------------------------------ */

function GraviteBadge({ gravite }: { gravite: Gravite }) {
  const m = GRAVITE_META[gravite]
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: m.soft, color: m.text }}>
      <span className="ic text-[14px]">{m.icon}</span>
      {m.label}
    </span>
  )
}

function StatutBadge({ statut }: { statut: Statut }) {
  const m = STATUT_META[statut]
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: m.soft, color: m.text }}>
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
  inc: Incident
  statut: Statut
  history: HistoryItem[]
  menuOpen: boolean
  onBack: () => void
  onMenu: (e: ReactMouseEvent<HTMLButtonElement>) => void
  onStatus: () => void
  onProfile: (kind: 'conducteur' | 'vehicule') => void
}

function DetailPanel({ inc, statut, history, menuOpen, onBack, onMenu, onStatus, onProfile }: DetailProps) {
  const g = GRAVITE_META[inc.gravite]
  const driver = driverById.get(inc.conducteurId)
  const extras = driverExtras(inc.conducteurId)
  const sec = String(inc.num % 60).padStart(2, '0')

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 text-[15px] font-extrabold text-ink">Détail de l'incident</p>
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[11.5px] font-bold text-info-600 hover:underline">
          <span className="ic text-base">arrow_back</span>
          Retour aux incidents
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full" style={{ background: g.soft, color: g.color }}>
          <span className="ic text-xl">{TYPE_ICON[inc.type]}</span>
        </span>
        <span className="text-[16px] font-extrabold text-ink">{inc.id}</span>
        <GraviteBadge gravite={inc.gravite} />
        <StatutBadge statut={statut} />
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onStatus}
            className="whitespace-nowrap rounded-lg border-[1.5px] border-line px-2.5 py-1.5 text-[11.5px] font-bold text-info-600 hover:bg-page"
          >
            Modifier le statut
          </button>
          <button
            type="button"
            data-row-menu
            onClick={onMenu}
            aria-label="Plus d'actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="ic flex h-8 w-8 items-center justify-center rounded-lg text-xl text-body hover:bg-page"
          >
            more_vert
          </button>
        </div>
      </div>

      {needsAttention(inc.gravite, statut) && (
        <p className="m-0 flex items-center gap-2 rounded-lg bg-danger-50 px-3 py-2 text-[11.5px] font-bold text-danger-600">
          <span className="ic text-lg">priority_high</span>
          Incident critique non encore traité : attention particulière requise.
        </p>
      )}

      <Section icon="info" title="Informations générales">
        <InfoRow icon="category" label="Type">
          {inc.type}
        </InfoRow>
        <InfoRow icon="event" label="Date">
          {incidentDate(inc)} {incidentTime(inc)}
        </InfoRow>
        <InfoRow icon="place" label="Région">
          {regionName(inc.region)}
        </InfoRow>
        <InfoRow icon="location_on" label="Localisation">
          {inc.locality}
        </InfoRow>
        <InfoRow icon="memory" label="Référence boîtier">
          <Link to={`${PATHS.superAdmin.monitoring}?q=${inc.boitierId}`} className="text-info-600 hover:underline" title="Voir son état dans Monitoring IoT">
            {inc.boitierId}
          </Link>
        </InfoRow>
        <InfoRow icon="directions_car" label="Référence véhicule">
          {driver?.plate ?? '—'}
        </InfoRow>
      </Section>

      <Section icon="person" title="Conducteur">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-info-50 text-info-600">
            <span className="ic text-[22px]">person</span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[13px] font-extrabold text-ink">{driver?.name ?? '—'}</p>
            <p className="m-0 text-[11.5px] font-medium text-body">{extras.phone}</p>
          </div>
          <button type="button" onClick={() => onProfile('conducteur')} className="whitespace-nowrap rounded-lg border-[1.5px] border-line px-2.5 py-1.5 text-[11.5px] font-bold text-info-600 hover:bg-page">
            Voir le profil
          </button>
        </div>
      </Section>

      <Section icon="directions_car" title="Véhicule">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[13px] font-extrabold text-ink">{driver?.plate ?? '—'}</p>
            <p className="m-0 text-[11.5px] font-medium text-body">{extras.model}</p>
          </div>
          <button type="button" onClick={() => onProfile('vehicule')} className="whitespace-nowrap rounded-lg border-[1.5px] border-line px-2.5 py-1.5 text-[11.5px] font-bold text-info-600 hover:bg-page">
            Voir le véhicule
          </button>
        </div>
      </Section>

      <Section icon="monitoring" title="Données de détection">
        <InfoRow icon="speed" label="Vitesse GPS">
          {inc.vitesseGps} km/h
        </InfoRow>
        <InfoRow icon="radar" label="Vitesse radar">
          {inc.vitesseRadar} km/h
        </InfoRow>
        <InfoRow icon="my_location" label="Position GPS">
          {inc.lat.toFixed(4)} / {inc.lng.toFixed(4)}
        </InfoRow>
        <InfoRow icon="schedule" label="Heure">
          {incidentTime(inc)}:{sec}
        </InfoRow>
      </Section>

      <Section icon="history" title="Historique de l'incident">
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
/* Modales                                                             */
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

function StatusForm({ inc, current, onSubmit, onClose }: { inc: Incident; current: Statut; onSubmit: (s: Statut, note: string) => void; onClose: () => void }) {
  const [statut, setStatut] = useState<Statut>(current)
  const [note, setNote] = useState('')
  const changed = statut !== current
  const canSave = changed || note.trim().length > 0

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (canSave) onSubmit(statut, note.trim())
  }

  return (
    <ModalShell title={`Modifier le statut de ${inc.id}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div role="radiogroup" aria-label="Statut" className="flex flex-col gap-2">
          {STATUT_ORDER.map((s) => {
            const m = STATUT_META[s]
            const on = statut === s
            return (
              <label
                key={s}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border-[1.5px] px-3 py-2.5 ${on ? 'border-brand-600 bg-brand-50' : 'border-line hover:bg-page'}`}
              >
                <input type="radio" name="statut" checked={on} onChange={() => setStatut(s)} className="h-4 w-4 accent-brand-600" />
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full" style={{ background: m.soft, color: m.text }}>
                  <span className="ic text-lg">{m.icon}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-extrabold text-ink">
                    {m.label}
                    {s === current && <span className="ml-1.5 text-[10.5px] font-semibold text-faint">(actuel)</span>}
                  </span>
                  <span className="block text-[11.5px] text-body">{m.hint}</span>
                </span>
              </label>
            )
          })}
        </div>
        <label className="block">
          <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-faint">Observation (facultatif)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 300))}
            rows={3}
            placeholder="Ajouter une précision à l'historique de l'incident…"
            className={`${fieldCls} resize-none`}
          />
          <span className="mt-0.5 block text-right text-[10.5px] text-faint">{note.length}/300</span>
        </label>
        <div className="mt-1 flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className="rounded-lg border-[1.5px] border-line px-4 py-2 text-[12.5px] font-bold text-ink hover:bg-page">
            Annuler
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="rounded-lg bg-brand-600 px-4 py-2 text-[12.5px] font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enregistrer
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function ProfileModal({
  kind,
  inc,
  all,
  onOpenIncident,
  onClose,
}: {
  kind: 'conducteur' | 'vehicule'
  inc: Incident
  /** Tous les incidents du conducteur (du plus récent au plus ancien). */
  all: Incident[]
  onOpenIncident: (id: string) => void
  onClose: () => void
}) {
  const driver = driverById.get(inc.conducteurId)
  const extras = driverExtras(inc.conducteurId)
  const critiques = all.filter((i) => i.gravite === 'critique').length

  return (
    <ModalShell title={kind === 'conducteur' ? 'Profil du conducteur' : 'Fiche du véhicule'} onClose={onClose}>
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-info-50 text-info-600">
          <span className="ic text-[26px]">{kind === 'conducteur' ? 'person' : 'directions_car'}</span>
        </span>
        <div className="min-w-0">
          <p className="m-0 text-[15px] font-extrabold text-ink">{kind === 'conducteur' ? driver?.name : driver?.plate}</p>
          <p className="m-0 text-[12px] font-medium text-body">{kind === 'conducteur' ? extras.phone : extras.model}</p>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-line-soft px-3">
        {(kind === 'conducteur'
          ? [
              ['Téléphone', extras.phone],
              ['Région', regionName(inc.region)],
              ['Véhicule', `${driver?.plate ?? '—'} · ${extras.model}`],
              ['Boîtier', inc.boitierId],
            ]
          : [
              ['Immatriculation', driver?.plate ?? '—'],
              ['Modèle', extras.model],
              ['Conducteur', driver?.name ?? '—'],
              ['Boîtier', inc.boitierId],
              ['Région', regionName(inc.region)],
            ]
        ).map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-3 border-t border-line-soft py-2 first:border-t-0">
            <span className="text-[12px] font-medium text-body">{label}</span>
            <span className="text-right text-[12.5px] font-semibold text-ink">{value}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <div className="rounded-lg bg-page px-3 py-2.5">
          <p className="m-0 text-[22px] font-extrabold leading-none text-navy-900">{fmt(all.length)}</p>
          <p className="m-0 mt-1 text-[11px] font-medium text-body">incidents sur 3 mois</p>
        </div>
        <div className="rounded-lg bg-danger-50 px-3 py-2.5">
          <p className="m-0 text-[22px] font-extrabold leading-none text-danger-600">{fmt(critiques)}</p>
          <p className="m-0 mt-1 text-[11px] font-medium text-body">dont critiques</p>
        </div>
      </div>

      {all.length > 0 && (
        <>
          <p className="m-0 mb-1 mt-3 text-[12px] font-extrabold text-ink">Derniers incidents</p>
          <ul className="m-0 flex list-none flex-col p-0">
            {all.slice(0, 3).map((i) => (
              <li key={i.id} className="border-t border-line-soft first:border-t-0">
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onOpenIncident(i.id)
                  }}
                  className="flex w-full items-center gap-2 py-2 text-left hover:bg-page"
                >
                  <span className="text-[12px] font-extrabold text-ink">{i.id}</span>
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-body">
                    {i.type} · {incidentDate(i)}
                  </span>
                  <GraviteBadge gravite={i.gravite} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
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
  statut: Statut
  extra: HistoryItem[]
}

type SortKey = 'date' | 'gravite'

export function IncidentsPage() {
  const { user } = useAuth()
  const incidents = INITIAL_INCIDENTS
  const [lastRefresh, setLastRefresh] = useState(() => formatNow())
  const [refreshing, setRefreshing] = useState(false)

  const [region, setRegion] = useState<'toutes' | string>('toutes')
  const [periode, setPeriode] = useState<Periode>('30j')
  const [customFrom, setCustomFrom] = useState(SERIES_DATES[SERIES_DAYS - 30])
  const [customTo, setCustomTo] = useState(SERIES_DATES[SERIES_DAYS - 1])
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '')
  const [typeF, setTypeF] = useState<'tous' | IncidentType>('tous')
  const [graviteF, setGraviteF] = useState<'tous' | Gravite>('tous')
  const [statutF, setStatutF] = useState<'tous' | Statut>('tous')
  const [localiteF, setLocaliteF] = useState('tous')
  const [attentionF, setAttentionF] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' })
  const [page, setPage] = useState(1)

  const [overrides, setOverrides] = useState<Record<string, Override>>({})
  const [selectedId, setSelectedId] = useState<string | null>(incidents[incidents.length - 1]?.id ?? null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [popupId, setPopupId] = useState<string | null>(null)
  const [focus, setFocus] = useState<Focus>(NATIONAL_FOCUS)
  const [menu, setMenu] = useState<RowMenu | null>(null)
  const [statusId, setStatusId] = useState<string | null>(null)
  const [profile, setProfile] = useState<{ kind: 'conducteur' | 'vehicule'; id: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const mapRef = useRef<HTMLElement | null>(null)
  const popupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const actor = user ? `Super Admin : ${user.firstName[0] ?? ''}. ${user.lastName}` : 'Super Admin'

  const statutOf = (i: Incident): Statut => overrides[i.id]?.statut ?? i.statut

  const byId = useMemo(() => new Map(incidents.map((i) => [i.id, i])), [incidents])

  /** Incidents de chaque conducteur, du plus récent au plus ancien (fiches conducteur / véhicule). */
  const byDriver = useMemo(() => {
    const map = new Map<string, Incident[]>()
    for (let k = incidents.length - 1; k >= 0; k--) {
      const i = incidents[k]
      const list = map.get(i.conducteurId)
      if (list) list.push(i)
      else map.set(i.conducteurId, [i])
    }
    return map
  }, [incidents])

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
    () => incidents.filter((i) => i.day >= win.start && i.day < win.end && (region === 'toutes' || i.region === region)),
    [incidents, win, region],
  )

  const kpis = useMemo(() => {
    let critiques = 0
    let enCours = 0
    let valides = 0
    let attention = 0
    for (const i of scoped) {
      const s = overrides[i.id]?.statut ?? i.statut
      if (i.gravite === 'critique') critiques++
      if (s === 'en_cours') enCours++
      if (s === 'valide') valides++
      if (needsAttention(i.gravite, s)) attention++
    }
    return { total: scoped.length, critiques, enCours, valides, attention }
  }, [scoped, overrides])

  const localiteOptions = useMemo(
    () =>
      region === 'toutes'
        ? REGION_STATS.map((r) => ({ label: r.label, names: [...(LOCALITY_NAMES[r.slug] ?? [])].sort((a, b) => a.localeCompare(b, 'fr')) }))
        : [{ label: '', names: [...(LOCALITY_NAMES[region] ?? [])].sort((a, b) => a.localeCompare(b, 'fr')) }],
    [region],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = scoped.filter((i) => {
      const s = overrides[i.id]?.statut ?? i.statut
      if (typeF !== 'tous' && i.type !== typeF) return false
      if (graviteF !== 'tous' && i.gravite !== graviteF) return false
      if (statutF !== 'tous' && s !== statutF) return false
      if (localiteF !== 'tous' && i.locality !== localiteF) return false
      if (attentionF && !needsAttention(i.gravite, s)) return false
      if (!q) return true
      const d = driverById.get(i.conducteurId)
      return (
        i.id.toLowerCase().includes(q) ||
        i.type.toLowerCase().includes(q) ||
        i.locality.toLowerCase().includes(q) ||
        regionName(i.region).toLowerCase().includes(q) ||
        i.boitierId.toLowerCase().includes(q) ||
        (d?.name.toLowerCase().includes(q) ?? false) ||
        (d?.plate.toLowerCase().includes(q) ?? false)
      )
    })
    const f = sort.dir === 'asc' ? 1 : -1
    return rows.sort((a, b) =>
      sort.key === 'date'
        ? f * (a.num - b.num)
        : f * (GRAVITE_ORDER.indexOf(b.gravite) - GRAVITE_ORDER.indexOf(a.gravite)) || b.num - a.num,
    )
  }, [scoped, overrides, search, typeF, graviteF, statutF, localiteF, attentionF, sort])

  /**
   * Points de la carte. Au-delà de MAP_LIMIT, on dessine un échantillon qui met
   * les critiques en avant (40 % des points) et répartit le reste selon le poids
   * de chaque gravité, du plus récent au plus ancien. Les critiques sont dessinés en dernier (au-dessus).
   */
  const mapItems = useMemo(() => {
    if (filtered.length <= MAP_LIMIT) return [...filtered].sort((a, b) => GRAVITE_ORDER.indexOf(b.gravite) - GRAVITE_ORDER.indexOf(a.gravite))
    const groups = GRAVITE_ORDER.map((g) => filtered.filter((i) => i.gravite === g).sort((a, b) => b.num - a.num))
    const [crit, ...others] = groups
    const take = Math.min(crit.length, Math.round(MAP_LIMIT * 0.4))
    const rest = MAP_LIMIT - take
    const othersTotal = others.reduce((n, g) => n + g.length, 0)
    let picked: Incident[]
    if (othersTotal <= rest) picked = [...crit.slice(0, MAP_LIMIT - othersTotal), ...others.flat()]
    else picked = [...crit.slice(0, take), ...others.flatMap((g) => g.slice(0, Math.floor((rest * g.length) / othersTotal)))]
    return picked.sort((a, b) => GRAVITE_ORDER.indexOf(b.gravite) - GRAVITE_ORDER.indexOf(a.gravite))
  }, [filtered])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const firstShown = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const lastShown = Math.min(currentPage * PAGE_SIZE, filtered.length)
  const hasFilters =
    region !== 'toutes' || periode !== '30j' || !!search.trim() || typeF !== 'tous' || graviteF !== 'tous' || statutF !== 'tous' || localiteF !== 'tous' || attentionF

  const selected = selectedId ? (byId.get(selectedId) ?? null) : null
  const popupInc = popupId ? (byId.get(popupId) ?? null) : null
  const menuInc = menu ? (byId.get(menu.id) ?? null) : null
  const statusInc = statusId ? (byId.get(statusId) ?? null) : null
  const profileInc = profile ? (byId.get(profile.id) ?? null) : null

  const historyOf = (i: Incident): HistoryItem[] => [...baseHistory(i), ...(overrides[i.id]?.extra ?? [])]

  /* --- Effets ----------------------------------------------------------- */

  useEffect(() => {
    setPage(1)
  }, [region, periode, customFrom, customTo, search, typeF, graviteF, statutF, localiteF, attentionF])

  // La localité choisie doit exister dans la région sélectionnée.
  useEffect(() => {
    if (localiteF !== 'tous' && !localiteOptions.some((g) => g.names.includes(localiteF))) setLocaliteF('tous')
  }, [localiteOptions, localiteF])

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
      if (profile) setProfile(null)
      else if (statusId) setStatusId(null)
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
  }, [profile, statusId, menu, drawerOpen])

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
    setTypeF('tous')
    setGraviteF('tous')
    setStatutF('tous')
    setLocaliteF('tous')
    setAttentionF(false)
  }

  const openDetail = (id: string) => {
    setSelectedId(id)
    setDrawerOpen(true)
  }

  /** Centre la carte sur l'incident et ouvre sa fiche (après le survol, sinon elle est mal cadrée). */
  const locate = (i: Incident, scroll: boolean) => {
    setSelectedId(i.id)
    setPopupId(null)
    setFocus({ center: [i.lat, i.lng], zoom: 13 })
    if (scroll) mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (popupTimer.current) clearTimeout(popupTimer.current)
    popupTimer.current = setTimeout(() => setPopupId(i.id), 950)
  }

  const openMenu = (e: ReactMouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation()
    if (menu?.id === id) {
      setMenu(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setMenu({ id, top: rect.bottom + 4, right: window.innerWidth - rect.right, up: window.innerHeight - rect.bottom < 230 })
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

  const saveStatus = (inc: Incident, statut: Statut, note: string) => {
    // TODO backend : PATCH du statut de l'incident + ajout d'une observation à son historique
    const current = overrides[inc.id]?.statut ?? inc.statut
    const extra: HistoryItem[] = []
    if (statut !== current) extra.push({ at: stampNow(), text: `Statut → ${STATUT_META[statut].label} (${actor})` })
    if (note) extra.push({ at: stampNow(), text: `Observation : « ${note} » (${actor})` })
    setOverrides((prev) => ({ ...prev, [inc.id]: { statut, extra: [...(prev[inc.id]?.extra ?? []), ...extra] } }))
    setStatusId(null)
    setToast(statut !== current ? `${inc.id} : statut « ${STATUT_META[statut].label} ».` : 'Observation ajoutée.')
  }

  /** Les cartes de synthèse servent aussi de raccourcis de filtre. */
  const applyKpi = (key: 'total' | 'critiques' | 'encours' | 'valides') => {
    setGraviteF(key === 'critiques' ? 'critique' : 'tous')
    setStatutF(key === 'encours' ? 'en_cours' : key === 'valides' ? 'valide' : 'tous')
    setAttentionF(false)
  }

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'date' ? 'desc' : 'asc' }))

  const sortIcon = (key: SortKey) => (sort.key === key ? (sort.dir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more')

  /* --- Rendu ------------------------------------------------------------ */

  const card = 'min-w-0 rounded-xl border border-line bg-white shadow-card'
  const selectCls =
    'w-full cursor-pointer rounded-[9px] border-[1.5px] border-line-field bg-white px-2.5 py-2 text-[12.5px] font-medium text-ink outline-none focus:border-brand-600'
  const headCard = 'flex min-w-[200px] cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-white px-3.5 py-2.5 shadow-card'

  const kpiCards = [
    { key: 'total' as const, icon: 'warning', tint: '#2b6cb0', soft: '#e8f0f9', label: 'Total incidents', value: kpis.total, sub: 'Sur la période sélectionnée', active: graviteF === 'tous' && statutF === 'tous' && !attentionF },
    { key: 'critiques' as const, icon: 'error', tint: '#dc3a2f', soft: '#fdeeec', label: 'Incidents critiques', value: kpis.critiques, sub: 'Niveau de gravité élevé', active: graviteF === 'critique' && statutF === 'tous' },
    { key: 'encours' as const, icon: 'schedule', tint: '#e8940c', soft: '#fdf4e6', label: 'Incidents en cours', value: kpis.enCours, sub: 'Nécessitent un suivi', active: statutF === 'en_cours' && graviteF === 'tous' },
    { key: 'valides' as const, icon: 'check_circle', tint: '#1f9d55', soft: '#e9f6ee', label: 'Incidents validés', value: kpis.valides, sub: 'Événements confirmés', active: statutF === 'valide' && graviteF === 'tous' },
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

  const detailProps = (i: Incident): DetailProps => ({
    inc: i,
    statut: statutOf(i),
    history: historyOf(i),
    menuOpen: menu?.id === i.id,
    onBack: () => {
      setDrawerOpen(false)
      setSelectedId(null)
    },
    onMenu: (e) => openMenu(e, i.id),
    onStatus: () => setStatusId(i.id),
    onProfile: (kind) => setProfile({ kind, id: i.id }),
  })

  return (
    <div className="pb-8">
      {/* En-tête */}
      <section className="mx-6 mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-danger-50 text-danger-600">
            <span className="ic text-[32px]">warning</span>
          </span>
          <div className="min-w-0">
            <h1 className="text-[clamp(24px,2.8vw,32px)] font-extrabold leading-[1.1] tracking-[-0.026em] text-navy-900">Incidents</h1>
            <p className="mt-1 text-[13.5px] leading-relaxed text-info-600">Suivi et analyse des événements routiers détectés par le système SafeRoad.</p>
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
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-line bg-white px-5 py-3.5 text-[13px] font-bold text-ink shadow-card transition-colors hover:bg-page"
            >
              <span className={`ic text-xl text-info-600 ${refreshing ? 'animate-spin' : ''}`}>refresh</span>
              Actualiser
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

      {/* Situations nécessitant une attention particulière */}
      {kpis.attention > 0 && (
        <section className="mx-6 mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-danger-200 bg-danger-50 px-4 py-2.5">
          <span className="ic text-xl text-danger-600">priority_high</span>
          <p className="m-0 min-w-0 flex-1 text-[12.5px] font-semibold text-ink">
            <span className="font-extrabold text-danger-600">{fmt(kpis.attention)}</span> incident{kpis.attention > 1 ? 's' : ''} critique{kpis.attention > 1 ? 's' : ''} pas encore
            traité{kpis.attention > 1 ? 's' : ''} (nouveaux ou en cours) sur la période.
          </p>
          <button
            type="button"
            onClick={() => {
              setAttentionF((v) => !v)
              setGraviteF('tous')
              setStatutF('tous')
            }}
            className="whitespace-nowrap rounded-lg bg-danger-600 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-danger-700"
          >
            {attentionF ? 'Voir tous les incidents' : 'Afficher ces incidents'}
          </button>
        </section>
      )}

      <div className="mx-6 mt-4.5 grid grid-cols-1 items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Filtres */}
          <section className={`${card} flex flex-wrap items-end gap-3.5 p-4`}>
            <label className="relative min-w-[220px] flex-[2_1_260px]">
              <span className="ic pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xl text-faint">search</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Incident, boîtier, conducteur, véhicule…"
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
            <label className="block min-w-[140px] flex-[1_1_140px]">
              <span className="mb-1 block text-[11px] font-bold text-ink">Type d'incident</span>
              <select value={typeF} onChange={(e) => setTypeF(e.target.value as 'tous' | IncidentType)} className={selectCls}>
                <option value="tous">Tous les types</option>
                {INCIDENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-[100px] flex-[1_1_100px]">
              <span className="mb-1 block text-[11px] font-bold text-ink">Gravité</span>
              <select value={graviteF} onChange={(e) => setGraviteF(e.target.value as 'tous' | Gravite)} className={selectCls}>
                <option value="tous">Toutes</option>
                {GRAVITE_ORDER.map((g) => (
                  <option key={g} value={g}>
                    {GRAVITE_META[g].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-[100px] flex-[1_1_100px]">
              <span className="mb-1 block text-[11px] font-bold text-ink">Statut</span>
              <select value={statutF} onChange={(e) => setStatutF(e.target.value as 'tous' | Statut)} className={selectCls}>
                <option value="tous">Tous</option>
                {STATUT_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUT_META[s].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-[120px] flex-[1_1_120px]">
              <span className="mb-1 block text-[11px] font-bold text-ink">Localité</span>
              <select value={localiteF} onChange={(e) => setLocaliteF(e.target.value)} className={selectCls}>
                <option value="tous">Toutes</option>
                {localiteOptions.map((g) =>
                  g.label ? (
                    <optgroup key={g.label} label={g.label}>
                      {g.names.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </optgroup>
                  ) : (
                    g.names.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))
                  ),
                )}
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

          {/* Carte */}
          <section ref={mapRef} className={`${card} p-4`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="m-0 text-[15px] font-extrabold text-ink">Localisation des incidents</p>
              <div className="flex items-center gap-3 text-[11px] font-semibold text-body">
                {GRAVITE_ORDER.map((g) => (
                  <span key={g} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: GRAVITE_META[g].color }} />
                    {GRAVITE_META[g].label}
                  </span>
                ))}
              </div>
            </div>
            <div className="relative isolate h-[340px] w-full overflow-hidden rounded-lg">
              <MapContainer center={NATIONAL_FOCUS.center} zoom={NATIONAL_FOCUS.zoom} className="h-full w-full" scrollWheelZoom={false} preferCanvas>
                <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <FlyTo focus={focus} />
                {mapItems.map((i) => {
                  const g = GRAVITE_META[i.gravite]
                  const sel = i.id === selectedId
                  return (
                    <CircleMarker
                      key={i.id}
                      center={[i.lat, i.lng]}
                      radius={sel ? 10 : i.gravite === 'critique' ? 8 : i.gravite === 'elevee' ? 7 : 6}
                      pathOptions={{ color: sel ? '#073B4C' : '#fff', weight: sel ? 3 : 1.5, fillColor: g.color, fillOpacity: 0.92 }}
                      eventHandlers={{
                        click: () => {
                          if (popupTimer.current) clearTimeout(popupTimer.current)
                          setSelectedId(i.id)
                          setPopupId(i.id)
                        },
                      }}
                    />
                  )
                })}
                {popupInc && (
                  <Popup
                    key={popupInc.id}
                    position={[popupInc.lat, popupInc.lng]}
                    offset={[0, -6]}
                    eventHandlers={{ remove: () => setPopupId((cur) => (cur === popupInc.id ? null : cur)) }}
                  >
                    <div className="w-[220px]">
                      <p className="m-0 flex flex-wrap items-center gap-1.5 text-[13px] font-extrabold text-ink">
                        {popupInc.id}
                        <GraviteBadge gravite={popupInc.gravite} />
                      </p>
                      <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0 text-[11.5px] text-ink">
                        <li className="flex items-center gap-1.5">
                          <span className="ic text-base text-info-600">{TYPE_ICON[popupInc.type]}</span>
                          {popupInc.type}
                        </li>
                        <li className="flex items-center gap-1.5">
                          <span className="ic text-base text-info-600">location_on</span>
                          {popupInc.locality}, {regionName(popupInc.region)}
                        </li>
                        <li className="flex items-center gap-1.5">
                          <span className="ic text-base text-info-600">event</span>
                          {incidentDate(popupInc)} — {incidentTime(popupInc)}
                        </li>
                        <li className="flex items-center gap-1.5">
                          <span className="ic text-base text-info-600">directions_car</span>
                          Véhicule : {driverById.get(popupInc.conducteurId)?.plate ?? '—'}
                        </li>
                        <li className="flex items-center gap-1.5">
                          <span className="ic text-base text-info-600">memory</span>
                          Boîtier : {popupInc.boitierId}
                        </li>
                      </ul>
                      <button
                        type="button"
                        onClick={() => openDetail(popupInc.id)}
                        className="mt-2.5 w-full rounded-lg bg-info-600 px-2.5 py-1.5 text-[11.5px] font-bold text-white hover:opacity-90"
                      >
                        Voir le détail
                      </button>
                    </div>
                  </Popup>
                )}
              </MapContainer>
              {filtered.length > MAP_LIMIT && (
                <p className="pointer-events-none absolute bottom-2 left-2 z-[1000] m-0 max-w-[75%] rounded-lg border border-line bg-white/95 px-2.5 py-1.5 text-[10.5px] font-semibold text-body shadow-card">
                  {fmt(mapItems.length)} incidents affichés sur {fmt(filtered.length)} (critiques en priorité, puis les plus récents). Affinez les filtres pour voir les autres.
                </p>
              )}
              {filtered.length === 0 && (
                <p className="pointer-events-none absolute inset-x-0 top-3 z-[500] m-0 text-center text-[11.5px] font-bold text-body">
                  Aucun incident à afficher avec ces filtres.
                </p>
              )}
            </div>
          </section>

          {/* Liste */}
          <section className={`${card} p-5`}>
            <p className="m-0 mb-3 text-[15px] font-extrabold text-ink">
              Liste des incidents <span className="font-medium text-body">({fmt(filtered.length)})</span>
            </p>

            <div className="overflow-x-auto rounded-lg border border-line-soft">
              <table className="w-full min-w-[1040px] border-collapse text-left text-[12.5px]">
                <thead>
                  <tr className="bg-page text-[11.5px] font-bold text-ink">
                    <th className="py-3 pl-4 pr-3">Référence</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3">Localisation</th>
                    <th className="px-3 py-3">Conducteur</th>
                    <th className="px-3 py-3">Boîtier</th>
                    <th className="px-3 py-3">
                      <button type="button" onClick={() => toggleSort('gravite')} className="inline-flex items-center gap-0.5 hover:text-brand-600" aria-label="Trier par gravité">
                        Gravité
                        <span className="ic text-base">{sortIcon('gravite')}</span>
                      </button>
                    </th>
                    <th className="px-3 py-3">
                      <button type="button" onClick={() => toggleSort('date')} className="inline-flex items-center gap-0.5 hover:text-brand-600" aria-label="Trier par date">
                        Date
                        <span className="ic text-base">{sortIcon('date')}</span>
                      </button>
                    </th>
                    <th className="px-3 py-3">Statut</th>
                    <th className="px-3 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((i) => {
                    const s = statutOf(i)
                    const urgent = needsAttention(i.gravite, s)
                    return (
                      <tr key={i.id} className={`border-t border-line-soft hover:bg-page/60 ${selectedId === i.id ? 'bg-info-50/60' : ''}`}>
                        <td className={`py-2.5 pl-4 pr-3 ${urgent ? 'shadow-[inset_3px_0_0_0_#dc3a2f]' : ''}`}>
                          <button type="button" onClick={() => openDetail(i.id)} className="inline-flex items-center gap-1 text-left text-[12.5px] font-extrabold text-ink hover:text-brand-600">
                            {i.id}
                            {urgent && <span className="ic text-base text-danger-600" title="Critique, pas encore traité">priority_high</span>}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 font-medium text-ink">{i.type}</td>
                        <td className="px-3 py-2.5 font-medium text-ink">
                          {i.locality}, {regionName(i.region)}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-ink">{driverById.get(i.conducteurId)?.name ?? '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-medium text-ink">{i.boitierId}</td>
                        <td className="px-3 py-2.5">
                          <GraviteBadge gravite={i.gravite} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-medium text-ink">
                          {incidentDate(i)} {incidentTime(i)}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatutBadge statut={s} />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openDetail(i.id)}
                              className="rounded-lg border-[1.5px] border-line px-3 py-1.5 text-[12px] font-bold text-info-600 transition-colors hover:bg-page"
                            >
                              Voir
                            </button>
                            <button
                              type="button"
                              data-row-menu
                              onClick={(e) => openMenu(e, i.id)}
                              aria-label={`Plus d'actions pour ${i.id}`}
                              aria-haspopup="menu"
                              aria-expanded={menu?.id === i.id}
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
                      <td colSpan={9} className="px-4 py-12 text-center">
                        <span className="ic text-4xl text-faint">search_off</span>
                        <p className="m-0 mt-2 text-[13px] font-bold text-ink">Aucun incident ne correspond à ces critères.</p>
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
                Affichage de {fmt(firstShown)} à {fmt(lastShown)} sur {fmt(filtered.length)} incident{filtered.length > 1 ? 's' : ''}
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
              <span className="ic text-4xl text-faint">warning</span>
              <p className="m-0 text-[13px] font-bold text-ink">Aucun incident sélectionné</p>
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
            className="absolute right-0 top-0 h-full w-full max-w-[420px] overflow-y-auto bg-page p-4 shadow-xl"
          >
            <DetailPanel key={selected.id} {...detailProps(selected)} />
          </aside>
        </div>
      )}

      {/* Menu d'actions d'une ligne (ou du volet de détail) */}
      {menu && menuInc && (
        <div
          data-row-menu
          role="menu"
          className="fixed z-[2400] w-60 rounded-xl border border-line bg-white py-1.5 shadow-xl"
          style={menu.up ? { bottom: window.innerHeight - menu.top + 40, right: menu.right } : { top: menu.top, right: menu.right }}
        >
          {[
            { icon: 'visibility', label: 'Voir le détail', run: () => openDetail(menuInc.id) },
            { icon: 'edit_note', label: 'Modifier le statut', run: () => setStatusId(menuInc.id) },
            { icon: 'my_location', label: 'Voir sur la carte', run: () => locate(menuInc, true) },
            { icon: 'content_copy', label: 'Copier la référence', run: () => copy('Référence', menuInc.id) },
          ].map((item) => (
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

      {statusInc && <StatusForm inc={statusInc} current={statutOf(statusInc)} onSubmit={(s, note) => saveStatus(statusInc, s, note)} onClose={() => setStatusId(null)} />}

      {profile && profileInc && (
        <ProfileModal
          kind={profile.kind}
          inc={profileInc}
          all={byDriver.get(profileInc.conducteurId) ?? []}
          onOpenIncident={(id) => openDetail(id)}
          onClose={() => setProfile(null)}
        />
      )}

      {toast && (
        <div role="status" className="fixed bottom-6 right-6 z-[3000] max-w-sm rounded-xl bg-navy-900 px-4 py-3 text-[12.5px] font-semibold text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  )
}
