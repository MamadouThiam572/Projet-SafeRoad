import { useEffect, useMemo, useRef, useState, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { REGION_STATS } from '@/data/superAdminHome'
import {
  ANOMALY_META,
  ANOMALY_STATUS_META,
  INITIAL_MONITORED,
  ONLINE_THRESHOLD_SEC,
  communicationLog,
  signalLevel,
  type Anomaly,
  type Connexion,
  type Monitored,
  type Reseau,
  type Technique,
} from '@/data/superAdminMonitoring'
import { REGION_CENTERS } from '@/lib/regions'
import { PATHS } from '@/routes/paths'

/**
 * Super Admin → Monitoring IoT : SUPERVISION TECHNIQUE des boîtiers.
 * Quels boîtiers fonctionnent, lesquels ne communiquent plus, où sont-ils,
 * quelles anomalies techniques nécessitent une vérification ?
 *
 * Volontairement absent : enregistrement, modification, affectation,
 * activation/désactivation, clé API… Cette administration se fait dans la page
 * « Boîtiers » (un lien y renvoie). Ici, tout est en lecture seule.
 *
 * Données de démonstration (déterministes) ; chaque point à brancher sur l'API
 * est marqué // TODO backend.
 */

const PAGE_SIZE = 5

const NATIONAL_FOCUS = { center: [14.45, -14.6] as [number, number], zoom: 7 }
type Focus = { center: [number, number]; zoom: number }

const COLOR = { online: '#1f9d55', offline: '#dc3a2f', anomaly: '#e8940c', ink: '#073B4C' }

const nf = new Intl.NumberFormat('fr-FR')
const fmt = (n: number) => nf.format(n).replace(/\s/g, ' ')

const regionName = (slug: string) => REGION_STATS.find((r) => r.slug === slug)?.label ?? slug

const p2 = (n: number) => String(n).padStart(2, '0')

function formatNow(): string {
  const d = new Date()
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}

/** HH:mm:ss d'un message reçu `ageSec` secondes avant l'ancre. */
function clock(anchor: number, ageSec: number): string {
  const d = new Date(anchor - ageSec * 1000)
  return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`
}

/** JJ/MM/AAAA HH:mm:ss */
function fullDate(anchor: number, ageSec: number): string {
  const d = new Date(anchor - ageSec * 1000)
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${clock(anchor, ageSec)}`
}

/** « Il y a 45 min », « Il y a 3 h », « Il y a 5 j ». */
function relAge(ageSec: number): string {
  const min = Math.max(1, Math.round(ageSec / 60))
  if (min < 60) return `Il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `Il y a ${h} h`
  return `Il y a ${Math.floor(h / 24)} j`
}

/** Heure exacte pour un boîtier en ligne, durée écoulée pour un boîtier hors ligne. */
const lastCommLabel = (m: Monitored, anchor: number) => (m.connexion === 'en_ligne' ? clock(anchor, m.ageSec) : relAge(m.ageSec))

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

const markerColor = (m: Monitored) => (m.technique === 'anomalie' ? COLOR.anomaly : m.connexion === 'en_ligne' ? COLOR.online : COLOR.offline)

/* ------------------------------------------------------------------ */
/* Pastilles                                                           */
/* ------------------------------------------------------------------ */

function ConnexionBadge({ connexion }: { connexion: Connexion }) {
  return connexion === 'en_ligne' ? (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-success-50 px-2.5 py-1 text-[11px] font-bold text-success-600">
      <span className="h-2 w-2 rounded-full bg-success-600" />
      En ligne
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-danger-50 px-2.5 py-1 text-[11px] font-bold text-danger-600">
      <span className="h-2 w-2 rounded-full bg-danger-600" />
      Hors ligne
    </span>
  )
}

function TechniqueBadge({ technique }: { technique: Technique }) {
  return technique === 'normal' ? (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-success-50 px-2.5 py-1 text-[11px] font-bold text-success-600">
      <span className="h-2 w-2 rounded-full bg-success-600" />
      Normal
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-warning-50 px-2.5 py-1 text-[11px] font-bold text-warning-600">
      <span className="h-2 w-2 rounded-full bg-warning-600" />
      Anomalie
    </span>
  )
}

const SIGNAL_META = {
  fort: { label: 'Fort', cls: 'text-success-600' },
  moyen: { label: 'Moyen', cls: 'text-warning-600' },
  faible: { label: 'Faible', cls: 'text-danger-600' },
} as const

function batteryTone(pct: number): string {
  if (pct < 20) return 'text-danger-600'
  if (pct < 40) return 'text-warning-600'
  return 'text-success-600'
}

/* ------------------------------------------------------------------ */
/* Carte                                                               */
/* ------------------------------------------------------------------ */

/** Recentre la carte quand la région (ou un boîtier localisé) change. */
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

type Tab = 'info' | 'comm'

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-line-soft py-2 first:border-t-0">
      <span className="flex-none text-[12px] font-medium text-body">{label}</span>
      <span className="min-w-0 break-words text-right text-[12.5px] font-semibold text-ink">{children}</span>
    </div>
  )
}

interface DetailProps {
  m: Monitored
  anchor: number
  tab: Tab
  onTab: (t: Tab) => void
  onBack: () => void
  onLocate: () => void
  onCopy: (label: string, value: string) => void
}

function DetailPanel({ m, anchor, tab, onTab, onBack, onLocate, onCopy }: DetailProps) {
  const online = m.connexion === 'en_ligne'
  const sig = SIGNAL_META[signalLevel(m.signal)]
  const log = useMemo(() => communicationLog(m), [m])

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 flex items-center gap-2 text-[15px] font-extrabold text-ink">
          <span className="ic text-[24px] text-navy-900">memory</span>
          Détail du boîtier
        </p>
        <div className="flex items-center gap-2">
          <Link
            to={PATHS.superAdmin.boitiers}
            className="whitespace-nowrap rounded-lg border-[1.5px] border-line px-2.5 py-1.5 text-[11px] font-bold text-info-600 hover:bg-page"
          >
            Voir tous les boîtiers
          </Link>
          <button type="button" onClick={onBack} aria-label="Fermer le détail" className="ic text-xl text-faint hover:text-ink 2xl:hidden">
            close
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="ic text-[24px] text-info-600">memory</span>
        <span className="text-[16px] font-extrabold text-ink">{m.id}</span>
        <ConnexionBadge connexion={m.connexion} />
        {m.technique === 'anomalie' && <TechniqueBadge technique="anomalie" />}
        <button
          type="button"
          onClick={onLocate}
          className="ml-auto inline-flex items-center gap-1 rounded-lg border-[1.5px] border-line px-2.5 py-1.5 text-[11px] font-bold text-ink hover:bg-page"
        >
          <span className="ic text-base text-info-600">my_location</span>
          Localiser
        </button>
      </div>

      {m.anomalies.map((a) => (
        <div key={a.id} className="flex items-start gap-2.5 rounded-lg bg-warning-50 px-3 py-2.5">
          <span className="ic mt-0.5 text-xl text-warning-600">{ANOMALY_META[a.kind].icon}</span>
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[12.5px] font-extrabold text-ink">{ANOMALY_META[a.kind].label}</p>
            <p className="m-0 mt-0.5 text-[11.5px] leading-snug text-body">{ANOMALY_META[a.kind].detail}</p>
            <p className="m-0 mt-1 text-[11px] font-semibold text-warning-600">
              {relAge(a.ageSec)} · {ANOMALY_STATUS_META[a.status].label}
            </p>
          </div>
        </div>
      ))}

      <div role="tablist" className="grid grid-cols-2 border-b border-line-soft">
        {(
          [
            ['info', 'Informations générales'],
            ['comm', 'Communication'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => onTab(key)}
            className={`-mb-px border-b-2 px-2 py-2 text-[12px] font-bold ${
              tab === key ? 'border-brand-600 text-brand-600' : 'border-transparent text-body hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'info' ? (
        <>
          <div className="rounded-lg border border-line-soft px-3">
            <DetailRow label="UUID">
              <span className="inline-flex items-center gap-1.5">
                <span className="break-all font-mono text-[11px] font-medium">{m.uuid}</span>
                <button type="button" onClick={() => onCopy('UUID', m.uuid)} aria-label="Copier l'UUID" className="ic text-base text-info-600 hover:text-ink">
                  content_copy
                </button>
              </span>
            </DetailRow>
            <DetailRow label="Conducteur">{m.conducteur ?? <span className="font-medium text-faint">Non affecté</span>}</DetailRow>
            <DetailRow label="Véhicule">{m.plate ?? <span className="font-medium text-faint">—</span>}</DetailRow>
            <DetailRow label="Région">{regionName(m.region)}</DetailRow>
          </div>

          <div className="rounded-lg border border-line-soft px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="m-0 flex items-center gap-1.5 text-[13px] font-extrabold text-ink">
                <span className={`h-2.5 w-2.5 rounded-full ${online ? 'bg-success-600' : 'bg-danger-600'}`} />
                {online ? 'Dernières données reçues' : 'Dernières données connues'}
              </p>
              <span className="flex items-center gap-1 text-[11.5px] font-semibold text-body">
                <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-success-600' : 'bg-danger-600'}`} />
                {lastCommLabel(m, anchor)}
              </span>
            </div>
            <div className="mt-1.5">
              <DetailRow label="Latitude">{m.lat.toFixed(4)}</DetailRow>
              <DetailRow label="Longitude">{m.lng.toFixed(4)}</DetailRow>
              <DetailRow label="Vitesse">{m.vitesse} km/h</DetailRow>
              <DetailRow label="Événement">{m.evenement}</DetailRow>
            </div>
            <button type="button" onClick={() => onTab('comm')} className="mt-1 inline-flex items-center gap-1.5 text-[12px] font-bold text-info-600 hover:underline">
              <span className="ic text-lg">history</span>
              Voir l'historique
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="rounded-lg border border-line-soft px-3">
            <DetailRow label="Réseau">
              <span className="inline-flex items-center gap-1.5">
                <span className="ic text-base text-info-600">{m.reseau === 'Wi-Fi' ? 'wifi' : 'signal_cellular_alt'}</span>
                {m.reseau}
              </span>
            </DetailRow>
            <DetailRow label="Qualité du signal">
              <span className={sig.cls}>{sig.label}</span> <span className="font-medium text-body">({m.signal} dBm)</span>
            </DetailRow>
            <DetailRow label="Dernière communication">{fullDate(anchor, m.ageSec)}</DetailRow>
            <DetailRow label="Fréquence d'émission">Toutes les {m.intervalSec} s</DetailRow>
            <DetailRow label="Délai de réception">{fmt(m.latenceMs)} ms</DetailRow>
            <DetailRow label="Messages reçus (24 h)">{m.tauxReception} %</DetailRow>
            <DetailRow label="Batterie">
              <span className={`inline-flex items-center gap-1 ${batteryTone(m.batterie)}`}>
                <span className="ic text-base">{m.batterie < 20 ? 'battery_alert' : 'battery_full'}</span>
                {m.batterie} %
              </span>
            </DetailRow>
          </div>

          <div className="rounded-lg border border-line-soft px-3 py-2.5">
            <p className="m-0 flex items-center gap-1.5 text-[13px] font-extrabold text-ink">
              <span className="ic text-lg text-info-600">history</span>
              Derniers messages
            </p>
            <ul className="m-0 mt-2 flex list-none flex-col gap-0.5 p-0">
              {log.map((e, i) => (
                <li key={i} className="flex items-center justify-between gap-2 border-t border-line-soft py-1.5 text-[12px] first:border-t-0">
                  <span className="font-mono font-semibold text-ink">{clock(anchor, e.ageSec)}</span>
                  {e.kind === 'recu' && <span className="font-semibold text-success-600">Reçu</span>}
                  {e.kind === 'retard' && <span className="font-semibold text-warning-600">Reçu avec retard</span>}
                  {e.kind === 'coupure' && <span className="text-right font-semibold text-danger-600">Dernier message · communication interrompue</span>}
                </li>
              ))}
            </ul>
            {!online && (
              <p className="m-0 mt-2 rounded-lg bg-danger-50 px-3 py-2 text-[11.5px] font-semibold text-danger-600">
                Aucune communication depuis {relAge(m.ageSec).replace('Il y a ', '')}.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Anomalies récentes                                                  */
/* ------------------------------------------------------------------ */

function AnomaliesCard({
  items,
  expanded,
  onToggle,
  onSelect,
}: {
  items: { anomaly: Anomaly; m: Monitored }[]
  expanded: boolean
  onToggle: () => void
  onSelect: (id: string) => void
}) {
  const nouvelles = items.filter((i) => i.anomaly.status === 'nouvelle').length
  const shown = expanded ? items : items.slice(0, 2)

  return (
    <section className="min-w-0 rounded-xl border border-line bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 flex items-center gap-2 text-[14px] font-extrabold text-ink">
          <span className="ic text-xl text-warning-600">warning</span>
          Anomalies récentes
        </p>
        {nouvelles > 0 && (
          <span className="text-[11.5px] font-bold text-warning-600">
            {nouvelles} nouvelle{nouvelles > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-success-50 px-3 py-3 text-[12.5px] font-semibold text-success-600">
          <span className="ic text-xl">check_circle</span>
          Aucune anomalie technique en cours.
        </div>
      ) : (
        <ul className="m-0 mt-2 flex list-none flex-col p-0">
          {shown.map(({ anomaly: a, m }) => (
            <li key={a.id} className="border-t border-line-soft first:border-t-0">
              <button
                type="button"
                onClick={() => onSelect(m.id)}
                className="flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-left hover:bg-page"
              >
                <span className="ic flex h-8 w-8 flex-none items-center justify-center rounded-full bg-warning-50 text-lg text-warning-600">
                  {ANOMALY_META[a.kind].icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-bold leading-tight text-ink">{ANOMALY_META[a.kind].label}</span>
                  <span className="block text-[11px] font-medium text-body">
                    {m.id} · {regionName(m.region)} · {relAge(a.ageSec)}
                  </span>
                </span>
                <span
                  className={`flex-none rounded-full px-2.5 py-1 text-[10.5px] font-bold ${
                    a.status === 'nouvelle' ? 'bg-warning-50 text-warning-600' : 'bg-info-50 text-info-600'
                  }`}
                >
                  {ANOMALY_STATUS_META[a.status].label}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {items.length > 2 && (
        <button type="button" onClick={onToggle} className="mt-1 inline-flex items-center gap-1.5 text-[12px] font-bold text-info-600 hover:underline">
          <span className="ic text-lg">{expanded ? 'expand_less' : 'expand_more'}</span>
          {expanded ? 'Réduire' : `Voir toutes les anomalies (${items.length})`}
        </button>
      )}
    </section>
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

type SortKey = 'id' | 'comm'

export function MonitoringPage() {
  // TODO backend : remplacer par la supervision en temps réel (WebSocket / SSE).
  const monitored = INITIAL_MONITORED
  const [anchor, setAnchor] = useState(() => Date.now())
  const [lastRefresh, setLastRefresh] = useState(() => formatNow())
  const [refreshing, setRefreshing] = useState(false)

  const [region, setRegion] = useState<'toutes' | string>('toutes')
  // Un lien depuis une autre page (ex. Incidents) peut pré-remplir la recherche : ?q=SR-BOX-014
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '')
  const [connexionF, setConnexionF] = useState<'tous' | Connexion>('tous')
  const [techniqueF, setTechniqueF] = useState<'tous' | Technique>('tous')
  const [reseauF, setReseauF] = useState<'tous' | Reseau>('tous')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'id', dir: 'asc' })
  const [page, setPage] = useState(1)

  const [selectedId, setSelectedId] = useState<string | null>(monitored[0]?.id ?? null)
  const [tab, setTab] = useState<Tab>('info')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [popupId, setPopupId] = useState<string | null>(null)
  const [focus, setFocus] = useState<Focus>(NATIONAL_FOCUS)
  const [menu, setMenu] = useState<RowMenu | null>(null)
  const [showAllAnomalies, setShowAllAnomalies] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const mapRef = useRef<HTMLElement | null>(null)
  const popupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* --- Données dérivées ------------------------------------------------ */

  const scoped = useMemo(() => monitored.filter((m) => region === 'toutes' || m.region === region), [monitored, region])

  const kpis = useMemo(
    () => ({
      total: scoped.length,
      enLigne: scoped.filter((m) => m.connexion === 'en_ligne').length,
      horsLigne: scoped.filter((m) => m.connexion === 'hors_ligne').length,
      anomalies: scoped.filter((m) => m.technique === 'anomalie').length,
    }),
    [scoped],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return scoped
      .filter((m) => {
        if (connexionF !== 'tous' && m.connexion !== connexionF) return false
        if (techniqueF !== 'tous' && m.technique !== techniqueF) return false
        if (reseauF !== 'tous' && m.reseau !== reseauF) return false
        if (!q) return true
        return (
          m.id.toLowerCase().includes(q) ||
          m.uuid.toLowerCase().includes(q) ||
          regionName(m.region).toLowerCase().includes(q) ||
          (m.conducteur?.toLowerCase().includes(q) ?? false) ||
          (m.plate?.toLowerCase().includes(q) ?? false)
        )
      })
      .sort((a, b) => {
        const s = sort.dir === 'asc' ? 1 : -1
        return sort.key === 'id' ? s * a.id.localeCompare(b.id, 'fr', { numeric: true }) : s * (a.ageSec - b.ageSec)
      })
  }, [scoped, search, connexionF, techniqueF, reseauF, sort])

  const anomalyItems = useMemo(
    () =>
      scoped
        .flatMap((m) => m.anomalies.map((anomaly) => ({ anomaly, m })))
        .sort((a, b) => a.anomaly.ageSec - b.anomaly.ageSec),
    [scoped],
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const firstShown = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const lastShown = Math.min(currentPage * PAGE_SIZE, filtered.length)
  const hasFilters = region !== 'toutes' || !!search.trim() || connexionF !== 'tous' || techniqueF !== 'tous' || reseauF !== 'tous'

  const selected = selectedId ? (monitored.find((m) => m.id === selectedId) ?? null) : null
  const popupM = popupId ? (monitored.find((m) => m.id === popupId) ?? null) : null
  const menuM = menu ? (monitored.find((m) => m.id === menu.id) ?? null) : null

  /* --- Effets ----------------------------------------------------------- */

  useEffect(() => {
    setPage(1)
  }, [region, search, connexionF, techniqueF, reseauF])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3400)
    return () => clearTimeout(id)
  }, [toast])

  useEffect(() => () => {
    if (popupTimer.current) clearTimeout(popupTimer.current)
  }, [])

  useEffect(() => {
    if (!refreshing) return
    const id = setTimeout(() => setRefreshing(false), 700)
    return () => clearTimeout(id)
  }, [refreshing])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (menu) setMenu(null)
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
  }, [menu, drawerOpen])

  /* --- Actions ---------------------------------------------------------- */

  const changeRegion = (value: string) => {
    setRegion(value)
    setPopupId(null)
    setFocus(value === 'toutes' ? { ...NATIONAL_FOCUS } : { center: REGION_CENTERS[value] ?? NATIONAL_FOCUS.center, zoom: 9 })
  }

  const resetFilters = () => {
    changeRegion('toutes')
    setSearch('')
    setConnexionF('tous')
    setTechniqueF('tous')
    setReseauF('tous')
  }

  const openDetail = (id: string, nextTab: Tab = 'info') => {
    setSelectedId(id)
    setTab(nextTab)
    setDrawerOpen(true)
  }

  /** Centre la carte sur le boîtier et ouvre sa fiche sur la carte. */
  const locate = (m: Monitored, scroll: boolean) => {
    setSelectedId(m.id)
    setPopupId(null)
    setFocus({ center: [m.lat, m.lng], zoom: 12 })
    if (scroll) mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // La fiche s'ouvre une fois le survol terminé, sinon la carte ne la recadre pas correctement.
    if (popupTimer.current) clearTimeout(popupTimer.current)
    popupTimer.current = setTimeout(() => setPopupId(m.id), 950)
  }

  const openMenu = (e: ReactMouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation()
    if (menu?.id === id) {
      setMenu(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setMenu({ id, top: rect.bottom + 4, right: window.innerWidth - rect.right, up: window.innerHeight - rect.bottom < 220 })
  }

  const copy = async (label: string, value: string) => {
    setToast((await copyText(value)) ? `${label} copié.` : "Impossible de copier : le navigateur a refusé l'accès au presse-papiers.")
  }

  const refresh = () => {
    // TODO backend : recharger l'état de connexion, les dernières communications et les anomalies
    setAnchor(Date.now())
    setLastRefresh(formatNow())
    setRefreshing(true)
    setToast('Données actualisées.')
  }

  /** Les cartes de synthèse servent aussi de raccourcis de filtre. */
  const applyKpi = (key: 'total' | 'enligne' | 'horsligne' | 'anomalie') => {
    setConnexionF(key === 'enligne' ? 'en_ligne' : key === 'horsligne' ? 'hors_ligne' : 'tous')
    setTechniqueF(key === 'anomalie' ? 'anomalie' : 'tous')
    setReseauF('tous')
    setSearch('')
  }

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))

  /* --- Rendu ------------------------------------------------------------ */

  const card = 'min-w-0 rounded-xl border border-line bg-white shadow-card'
  const selectCls =
    'w-full cursor-pointer rounded-[9px] border-[1.5px] border-line-field bg-white px-2.5 py-2 text-[12.5px] font-medium text-ink outline-none focus:border-brand-600'

  const kpiCards = [
    { key: 'total' as const, icon: 'memory', tint: '#2b6cb0', soft: '#e8f0f9', label: 'Boîtiers supervisés', value: kpis.total, sub: 'Boîtiers enregistrés', active: connexionF === 'tous' && techniqueF === 'tous' },
    { key: 'enligne' as const, icon: 'wifi', tint: '#1f9d55', soft: '#e9f6ee', label: 'En ligne', value: kpis.enLigne, sub: 'Communication active', active: connexionF === 'en_ligne' && techniqueF === 'tous' },
    { key: 'horsligne' as const, icon: 'sensors_off', tint: '#dc3a2f', soft: '#fdeeec', label: 'Hors ligne', value: kpis.horsLigne, sub: 'Aucune communication récente', active: connexionF === 'hors_ligne' && techniqueF === 'tous' },
    { key: 'anomalie' as const, icon: 'warning', tint: '#e8940c', soft: '#fdf4e6', label: 'Anomalies', value: kpis.anomalies, sub: 'Nécessitent une vérification', active: techniqueF === 'anomalie' && connexionF === 'tous' },
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

  const detailProps = (m: Monitored): DetailProps => ({
    m,
    anchor,
    tab,
    onTab: setTab,
    onBack: () => setDrawerOpen(false),
    onLocate: () => {
      setDrawerOpen(false)
      locate(m, true)
    },
    onCopy: copy,
  })

  const sortIcon = (key: SortKey) => (sort.key === key ? (sort.dir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more')

  return (
    <div className="pb-8">
      {/* En-tête */}
      <section className="mx-6 mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="ic flex-none text-[44px] text-navy-900">sensors</span>
          <div className="min-w-0">
            <h1 className="text-[clamp(24px,2.8vw,32px)] font-extrabold leading-[1.1] tracking-[-0.026em] text-navy-900">Monitoring IoT</h1>
            <p className="mt-1 text-[13.5px] leading-relaxed text-info-600">Supervision en temps réel des boîtiers SafeRoad et de leurs communications.</p>
          </div>
        </div>
        <div className="ml-auto flex flex-col items-end gap-1.5">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <label className="flex min-w-[210px] cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-white px-3.5 py-3 shadow-card">
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
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-line bg-white px-5 py-3.5 text-[13px] font-bold text-ink shadow-card transition-colors hover:bg-page"
            >
              <span className={`ic text-xl text-info-600 ${refreshing ? 'animate-spin' : ''}`}>refresh</span>
              Actualiser
            </button>
          </div>
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
                placeholder="Rechercher un boîtier, conducteur, véhicule ou UUID…"
                className="w-full rounded-[9px] border-[1.5px] border-line-field bg-field py-2.5 pl-10 pr-3 text-[12.5px] font-medium text-ink outline-none placeholder:text-faint focus:border-brand-600"
              />
            </label>
            <label className="block min-w-[140px] flex-[1_1_140px]">
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
            <label className="block min-w-[130px] flex-[1_1_130px]">
              <span className="mb-1 block text-[11px] font-bold text-ink">État de connexion</span>
              <select value={connexionF} onChange={(e) => setConnexionF(e.target.value as 'tous' | Connexion)} className={selectCls}>
                <option value="tous">Tous</option>
                <option value="en_ligne">En ligne</option>
                <option value="hors_ligne">Hors ligne</option>
              </select>
            </label>
            <label className="block min-w-[120px] flex-[1_1_120px]">
              <span className="mb-1 block text-[11px] font-bold text-ink">État technique</span>
              <select value={techniqueF} onChange={(e) => setTechniqueF(e.target.value as 'tous' | Technique)} className={selectCls}>
                <option value="tous">Tous</option>
                <option value="normal">Normal</option>
                <option value="anomalie">Anomalie</option>
              </select>
            </label>
            <label className="block min-w-[100px] flex-[1_1_100px]">
              <span className="mb-1 block text-[11px] font-bold text-ink">Réseau</span>
              <select value={reseauF} onChange={(e) => setReseauF(e.target.value as 'tous' | Reseau)} className={selectCls}>
                <option value="tous">Tous</option>
                <option value="Wi-Fi">Wi-Fi</option>
                <option value="GSM">GSM</option>
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
              <p className="m-0 text-[15px] font-extrabold text-ink">
                Localisation des boîtiers <span className="font-medium text-body">({fmt(filtered.length)})</span>
              </p>
              <div className="flex items-center gap-3 text-[11px] font-semibold text-body">
                {[
                  ['En ligne', COLOR.online],
                  ['Hors ligne', COLOR.offline],
                  ['Anomalie', COLOR.anomaly],
                ].map(([label, color]) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div className="relative isolate h-[360px] w-full overflow-hidden rounded-lg">
              <MapContainer center={NATIONAL_FOCUS.center} zoom={NATIONAL_FOCUS.zoom} className="h-full w-full" scrollWheelZoom={false}>
                <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <FlyTo focus={focus} />
                {filtered.map((m) => (
                  <CircleMarker
                    key={m.id}
                    center={[m.lat, m.lng]}
                    radius={m.id === selectedId ? 10 : 7}
                    pathOptions={{
                      color: m.id === selectedId ? COLOR.ink : '#fff',
                      weight: m.id === selectedId ? 3 : 2,
                      fillColor: markerColor(m),
                      fillOpacity: 0.95,
                    }}
                    eventHandlers={{
                      click: () => {
                        if (popupTimer.current) clearTimeout(popupTimer.current)
                        setSelectedId(m.id)
                        setPopupId(m.id)
                      },
                    }}
                  />
                ))}
                {popupM && (
                  <Popup
                    key={popupM.id}
                    position={[popupM.lat, popupM.lng]}
                    offset={[0, -6]}
                    eventHandlers={{ remove: () => setPopupId((cur) => (cur === popupM.id ? null : cur)) }}
                  >
                    <div className="w-[210px]">
                      <p className="m-0 flex flex-wrap items-center gap-1.5 text-[13px] font-extrabold text-ink">
                        {popupM.id}
                        <ConnexionBadge connexion={popupM.connexion} />
                      </p>
                      <dl className="m-0 mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11.5px]">
                        <dt className="text-body">Conducteur</dt>
                        <dd className="m-0 font-semibold text-ink">{popupM.conducteur ?? '—'}</dd>
                        <dt className="text-body">Région</dt>
                        <dd className="m-0 font-semibold text-ink">{regionName(popupM.region)}</dd>
                        <dt className="text-body">Réseau</dt>
                        <dd className="m-0 font-semibold text-ink">{popupM.reseau}</dd>
                        <dt className="text-body">Dernière com.</dt>
                        <dd className="m-0 font-semibold text-ink">{lastCommLabel(popupM, anchor)}</dd>
                      </dl>
                      {popupM.technique === 'anomalie' && (
                        <p className="m-0 mt-1.5 text-[11px] font-bold text-warning-600">⚠ {ANOMALY_META[popupM.anomalies[0].kind].label}</p>
                      )}
                      <button
                        type="button"
                        onClick={() => openDetail(popupM.id)}
                        className="mt-2.5 w-full rounded-lg bg-info-600 px-2.5 py-1.5 text-[11.5px] font-bold text-white hover:opacity-90"
                      >
                        Voir le détail
                      </button>
                    </div>
                  </Popup>
                )}
              </MapContainer>
              {filtered.length === 0 && (
                <p className="pointer-events-none absolute inset-x-0 top-3 z-[500] m-0 text-center text-[11.5px] font-bold text-body">
                  Aucun boîtier à afficher avec ces filtres.
                </p>
              )}
            </div>
          </section>

          {/* Liste */}
          <section className={`${card} p-5`}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <p className="m-0 text-[15px] font-extrabold text-ink">
                Boîtiers surveillés <span className="font-medium text-body">({fmt(filtered.length)})</span>
              </p>
              <p className="m-0 text-[11px] font-medium text-faint">
                Hors ligne : aucun message reçu depuis plus de {ONLINE_THRESHOLD_SEC / 60} min.
              </p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-line-soft">
              <table className="w-full min-w-[1020px] border-collapse text-left text-[12.5px]">
                <thead>
                  <tr className="bg-page text-[11.5px] font-bold text-ink">
                    <th className="py-3 pl-4 pr-3">
                      <button type="button" onClick={() => toggleSort('id')} className="inline-flex items-center gap-0.5 hover:text-brand-600" aria-label="Trier par identifiant">
                        Boîtier
                        <span className="ic text-base">{sortIcon('id')}</span>
                      </button>
                    </th>
                    <th className="px-3 py-3">UUID</th>
                    <th className="px-3 py-3">Conducteur</th>
                    <th className="px-3 py-3">Véhicule</th>
                    <th className="px-3 py-3">Région</th>
                    <th className="px-3 py-3">Connexion</th>
                    <th className="px-3 py-3">Réseau</th>
                    <th className="px-3 py-3">État technique</th>
                    <th className="px-3 py-3">
                      <button type="button" onClick={() => toggleSort('comm')} className="inline-flex items-center gap-0.5 whitespace-nowrap hover:text-brand-600" aria-label="Trier par dernière communication">
                        Dernière communication
                        <span className="ic text-base">{sortIcon('comm')}</span>
                      </button>
                    </th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((m) => (
                    <tr key={m.id} className={`border-t border-line-soft hover:bg-page/60 ${selectedId === m.id ? 'bg-info-50/60' : ''}`}>
                      <td className="py-2.5 pl-4 pr-3">
                        <button type="button" onClick={() => openDetail(m.id)} className="text-left text-[12.5px] font-extrabold text-ink hover:text-brand-600">
                          {m.id}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-info-600" title={m.uuid}>
                        {m.uuid.slice(0, 11)}…
                      </td>
                      <td className="px-3 py-2.5 font-medium text-ink">{m.conducteur ?? <span className="text-faint">—</span>}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-medium text-ink">{m.plate ?? <span className="text-faint">—</span>}</td>
                      <td className="px-3 py-2.5 font-medium text-ink">{regionName(m.region)}</td>
                      <td className="px-3 py-2.5">
                        <ConnexionBadge connexion={m.connexion} />
                      </td>
                      <td className="px-3 py-2.5 font-medium text-ink">{m.reseau}</td>
                      <td className="px-3 py-2.5">
                        <TechniqueBadge technique={m.technique} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-medium text-ink">{lastCommLabel(m, anchor)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openDetail(m.id)}
                            className="rounded-lg border-[1.5px] border-line px-3 py-1.5 text-[12px] font-bold text-info-600 transition-colors hover:bg-page"
                          >
                            Voir
                          </button>
                          <button
                            type="button"
                            data-row-menu
                            onClick={(e) => openMenu(e, m.id)}
                            aria-label={`Plus d'actions pour ${m.id}`}
                            aria-haspopup="menu"
                            aria-expanded={menu?.id === m.id}
                            className="ic flex h-8 w-8 items-center justify-center rounded-lg text-xl text-body hover:bg-page"
                          >
                            more_vert
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {pageRows.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center">
                        <span className="ic text-4xl text-faint">search_off</span>
                        <p className="m-0 mt-2 text-[13px] font-bold text-ink">Aucun boîtier ne correspond à ces critères.</p>
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
                Affichage de {firstShown} à {lastShown} sur {fmt(filtered.length)} boîtier{filtered.length > 1 ? 's' : ''}
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
                  {pageButtons.map((p, i) =>
                    p === '…' ? (
                      <span key={`gap-${i}`} className="px-1 text-faint">
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
                        {p}
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

          {/* Sous 1536 px : les anomalies passent sous la liste (à droite sinon) */}
          <div className="2xl:hidden">
            <AnomaliesCard
              items={anomalyItems}
              expanded={showAllAnomalies}
              onToggle={() => setShowAllAnomalies((v) => !v)}
              onSelect={(id) => openDetail(id)}
            />
          </div>
        </div>

        {/* Détail + anomalies : colonne de droite sur grand écran, volet sinon */}
        <aside className="hidden min-w-0 flex-col gap-4 2xl:sticky 2xl:top-4 2xl:flex">
          {selected ? (
            <DetailPanel key={selected.id} {...detailProps(selected)} />
          ) : (
            <div className={`${card} flex flex-col items-center gap-2 px-6 py-14 text-center`}>
              <span className="ic text-4xl text-faint">memory</span>
              <p className="m-0 text-[13px] font-bold text-ink">Aucun boîtier sélectionné</p>
              <p className="m-0 text-[12px] text-body">Cliquez sur « Voir » dans la liste ou sur un point de la carte.</p>
            </div>
          )}
          <AnomaliesCard
            items={anomalyItems}
            expanded={showAllAnomalies}
            onToggle={() => setShowAllAnomalies((v) => !v)}
            onSelect={(id) => {
              const m = monitored.find((x) => x.id === id)
              if (!m) return
              setTab('info')
              locate(m, false)
            }}
          />
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

      {/* Menu d'actions d'une ligne : lecture seule, aucune action d'administration */}
      {menu && menuM && (
        <div
          data-row-menu
          role="menu"
          className="fixed z-[1500] w-60 rounded-xl border border-line bg-white py-1.5 shadow-xl"
          style={menu.up ? { bottom: window.innerHeight - menu.top + 40, right: menu.right } : { top: menu.top, right: menu.right }}
        >
          {[
            { icon: 'visibility', label: 'Voir le détail', run: () => openDetail(menuM.id) },
            { icon: 'my_location', label: 'Localiser sur la carte', run: () => locate(menuM, true) },
            { icon: 'history', label: 'Historique des communications', run: () => openDetail(menuM.id, 'comm') },
            { icon: 'content_copy', label: "Copier l'UUID", run: () => copy('UUID', menuM.uuid) },
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

      {toast && (
        <div role="status" className="fixed bottom-6 right-6 z-[3000] max-w-sm rounded-xl bg-navy-900 px-4 py-3 text-[12.5px] font-semibold text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  )
}
