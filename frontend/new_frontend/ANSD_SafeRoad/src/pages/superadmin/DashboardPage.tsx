import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import { Link } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import {
  EVENT_META,
  REGION_SERIES,
  REGION_STATS,
  SERIES_DATES,
  SERIES_DAYS,
  SERIES_LABELS,
  SYSTEM_EVENTS,
  type RegionStat,
  type SeriesKey,
} from '@/data/superAdminHome'
import { REGION_CENTERS } from '@/lib/regions'
import { PATHS } from '@/routes/paths'

/**
 * Dashboard national (Super Admin) — vue de synthèse de tout SafeRoad.
 * Il résume et oriente : pas de tableau complet d'incidents, de boîtiers ou de
 * signalements ici (ces listes vivent dans leurs pages dédiées).
 */

type Periode = 'aujourdhui' | '7j' | '30j' | '3m' | 'perso'
type Layer = 'incidents' | 'alertes' | 'signalements' | 'zones' | 'boitiers'
type SortKey = 'label' | 'boitiers' | 'incidents' | 'signalements' | 'zones'

const PERIODE_LABELS: Record<Periode, string> = {
  aujourdhui: "Aujourd'hui",
  '7j': '7 derniers jours',
  '30j': '30 derniers jours',
  '3m': '3 derniers mois',
  perso: 'Personnalisée',
}

const LAYER_META: Record<Layer, { label: string; color: string; soft: string; icon: string }> = {
  incidents: { label: 'Incidents', color: '#dc3a2f', soft: '#fdeeec', icon: 'warning' },
  alertes: { label: 'Alertes', color: '#7c3aed', soft: '#f1eafe', icon: 'notifications_active' },
  signalements: { label: 'Signalements', color: '#2b6cb0', soft: '#e8f0f9', icon: 'campaign' },
  zones: { label: 'Zones', color: '#e8940c', soft: '#fdf4e6', icon: 'location_on' },
  boitiers: { label: 'Boîtiers', color: '#1f9d55', soft: '#e9f6ee', icon: 'memory' },
}
const LAYERS = Object.keys(LAYER_META) as Layer[]

const SERIES_META: Record<SeriesKey, { label: string; color: string }> = {
  incidents: { label: 'Incidents', color: '#2b6cb0' },
  signalements: { label: 'Signalements', color: '#1f9d55' },
  alertes: { label: 'Alertes', color: '#e8940c' },
}

/** Couleur d'identité d'une région dans le tableau (décorative : elle n'exprime aucun classement). */
const REGION_DOT = ['#e8940c', '#2b6cb0', '#1f9d55', '#7c3aed', '#0e8fb5', '#dc3a2f']
const regionDot = (slug: string) => REGION_DOT[Math.max(0, REGION_STATS.findIndex((r) => r.slug === slug)) % REGION_DOT.length]

const NATIONAL_FOCUS = { center: [14.45, -14.6] as [number, number], zoom: 7 }
type Focus = typeof NATIONAL_FOCUS

const nf = new Intl.NumberFormat('fr-FR')
/** Espace insécable classique : l'espace fine de `Intl` est invisible dans certaines polices. */
const fmt = (n: number) => nf.format(n).replace(/ /g, ' ')

function formatNow(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function niceMax(max: number): { top: number; step: number } {
  const steps = [5, 10, 20, 50, 100, 200, 500, 1000]
  const step = steps.find((s) => max / s <= 5) ?? 1000
  return { top: Math.max(step, Math.ceil(max / step) * step), step }
}

/** Courbe d'évolution (SVG) avec survol : une infobulle suit le curseur. */
function EvolutionChart({ labels, values, color }: { labels: string[]; values: number[]; color: string }) {
  const W = 760
  const H = 250
  const pl = 38
  const pr = 14
  const pt = 14
  const pb = 28
  const plotW = W - pl - pr
  const plotH = H - pt - pb
  const [hover, setHover] = useState<number | null>(null)

  const { top, step } = niceMax(Math.max(...values, 1))
  const n = values.length
  const x = (i: number) => pl + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2)
  const y = (v: number) => pt + plotH - (v / top) * plotH
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step)
  const line = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `${x(0)},${pt + plotH} ${line} ${x(n - 1)},${pt + plotH}`
  const labelEvery = Math.max(1, Math.ceil(n / 9))
  const gid = `evo-${color.replace('#', '')}`
  const showDots = n <= 31

  const onMove = (e: ReactMouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const idx = Math.round(((px - pl) / plotW) * (n - 1))
    setHover(Math.min(n - 1, Math.max(0, idx)))
  }

  const hv = hover !== null ? values[hover] : null
  const tipW = 96
  const tipX = hover !== null ? Math.min(Math.max(x(hover) - tipW / 2, pl), W - pr - tipW) : 0

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
      role="img"
      aria-label="Courbe d'évolution"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke="#e6edf2" strokeWidth={1} />
          <text x={pl - 8} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill="#8aa0ad" fontWeight={600}>
            {t}
          </text>
        </g>
      ))}
      <polygon points={area} fill={`url(#${gid})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) =>
        showDots || hover === i ? (
          <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 4.5 : 2.5} fill="#fff" stroke={color} strokeWidth={1.8} />
        ) : null,
      )}
      {labels.map((l, i) =>
        i % labelEvery === 0 || i === n - 1 ? (
          <text key={`${l}-${i}`} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="#8aa0ad" fontWeight={600}>
            {l}
          </text>
        ) : null,
      )}
      {hover !== null && hv !== null && (
        <g pointerEvents="none">
          <line x1={x(hover)} x2={x(hover)} y1={pt} y2={pt + plotH} stroke={color} strokeOpacity={0.35} strokeDasharray="3 3" />
          <rect x={tipX} y={Math.max(pt, y(hv) - 40)} width={tipW} height={30} rx={7} fill="#062334" />
          <text x={tipX + tipW / 2} y={Math.max(pt, y(hv) - 40) + 19} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">
            {labels[hover]} : {fmt(hv)}
          </text>
        </g>
      )}
    </svg>
  )
}

/** Recentre la carte quand le filtre de région (ou un clic sur une ligne) change. */
function FlyTo({ focus }: { focus: Focus }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(focus.center, focus.zoom, { duration: 0.8 })
  }, [focus, map])
  return null
}

function regionIcon(label: string, dots: { color: string; size: number }[], selected: boolean) {
  const html = dots.map((d) => `<i style="background:${d.color};width:${d.size}px;height:${d.size}px"></i>`).join('')
  return L.divIcon({
    className: 'sr-reg-wrap',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    html: `<div class="sr-reg${selected ? ' sr-reg-sel' : ''}"><span class="sr-dots">${html}</span><span class="sr-name">${label}</span></div>`,
  })
}

interface Row extends RegionStat {
  incidentsP: number
  alertesP: number
}

export function DashboardPage() {
  const [lastRefresh, setLastRefresh] = useState(() => formatNow())
  const [regionFilter, setRegionFilter] = useState<'toutes' | string>('toutes')
  const [periode, setPeriode] = useState<Periode>('30j')
  const [customFrom, setCustomFrom] = useState(SERIES_DATES[SERIES_DAYS - 30])
  const [customTo, setCustomTo] = useState(SERIES_DATES[SERIES_DAYS - 1])
  const [showAllRegions, setShowAllRegions] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'incidents', dir: 'desc' })
  const [metric, setMetric] = useState<SeriesKey>('incidents')
  // Par défaut, un seul type de données sur la carte : tout afficher d'un coup la rendrait illisible.
  const [layers, setLayers] = useState<Record<Layer, boolean>>({ incidents: true, alertes: false, signalements: false, zones: false, boitiers: false })
  const [mapSelected, setMapSelected] = useState<string | null>(null)
  const [focus, setFocus] = useState<Focus>(NATIONAL_FOCUS)
  const mapSectionRef = useRef<HTMLDivElement | null>(null)

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

  /** La courbe affiche au moins 7 jours, même pour « Aujourd'hui ». */
  const chartWin = useMemo(() => (win.end - win.start < 7 ? { start: Math.max(0, win.end - 7), end: win.end } : win), [win])

  const regions = useMemo<RegionStat[]>(
    () => (regionFilter === 'toutes' ? REGION_STATS : REGION_STATS.filter((r) => r.slug === regionFilter)),
    [regionFilter],
  )

  const rows = useMemo<Row[]>(() => {
    const sum = (slug: string, key: SeriesKey) => REGION_SERIES[slug][key].slice(win.start, win.end).reduce((a, b) => a + b, 0)
    return regions.map((r) => ({ ...r, incidentsP: sum(r.slug, 'incidents'), alertesP: sum(r.slug, 'alertes') }))
  }, [regions, win])

  /** Tri du tableau « Activité par région » : un outil de comparaison, pas un classement imposé. */
  const sortedRows = useMemo(() => {
    const value = (r: Row): number | string => {
      switch (sort.key) {
        case 'label':
          return r.label
        case 'boitiers':
          return r.boitiers
        case 'incidents':
          return r.incidentsP
        case 'signalements':
          return r.signalements
        default:
          return r.zones
      }
    }
    const factor = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const va = value(a)
      const vb = value(b)
      if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb, 'fr') * factor
      return ((va as number) - (vb as number)) * factor
    })
  }, [rows, sort])

  const totals = useMemo(() => {
    const sum = (k: keyof RegionStat) => regions.reduce((a, r) => a + (r[k] as number), 0)
    return {
      boitiers: sum('boitiers'),
      affectes: sum('affectes'),
      conducteurs: sum('conducteurs'),
      signalements: sum('signalements'),
      signalementsEnAttente: sum('signalementsEnAttente'),
      zones: sum('zones'),
      zonesEnAttente: sum('zonesEnAttente'),
      anomalies: sum('anomalies'),
      admins: regions.length,
      adminsAction: regions.filter((r) => r.adminAction).length,
      incidents: rows.reduce((a, r) => a + r.incidentsP, 0),
      alertes: rows.reduce((a, r) => a + r.alertesP, 0),
    }
  }, [regions, rows])

  /** Série journalière cumulée des régions affichées, sur la fenêtre de la courbe. */
  const nationalSeries = (key: SeriesKey): number[] => {
    const out: number[] = []
    for (let d = chartWin.start; d < chartWin.end; d++) out.push(regions.reduce((a, r) => a + REGION_SERIES[r.slug][key][d], 0))
    return out
  }

  const kpis = [
    { key: 'boitiers', icon: 'memory', tint: '#2b6cb0', soft: '#e8f0f9', label: 'Boîtiers', value: totals.boitiers, sub: `${fmt(totals.affectes)} affectés`, to: PATHS.superAdmin.boitiers },
    { key: 'conducteurs', icon: 'person', tint: '#1f9d55', soft: '#e9f6ee', label: 'Conducteurs équipés', value: totals.conducteurs, sub: 'Comptes enregistrés', to: PATHS.superAdmin.utilisateurs },
    { key: 'incidents', icon: 'warning', tint: '#dc3a2f', soft: '#fdeeec', label: 'Incidents', value: totals.incidents, sub: 'Sur la période sélectionnée', to: PATHS.superAdmin.incidents },
    { key: 'alertes', icon: 'notifications_active', tint: '#e8940c', soft: '#fdf4e6', label: 'Alertes', value: totals.alertes, sub: 'Sur la période sélectionnée', to: PATHS.superAdmin.notifications },
    { key: 'signalements', icon: 'campaign', tint: '#1f9d55', soft: '#e9f6ee', label: 'Signalements', value: totals.signalements, sub: 'Transmis par les conducteurs', to: PATHS.superAdmin.signalements },
    { key: 'zones', icon: 'location_on', tint: '#7c3aed', soft: '#f1eafe', label: 'Zones accidentogènes', value: totals.zones, sub: 'Zones enregistrées', to: PATHS.superAdmin.zones },
    { key: 'zonesAValider', icon: 'schedule', tint: '#e8940c', soft: '#fdf4e6', label: 'Zones à valider', value: totals.zonesEnAttente, sub: 'En attente de décision', to: PATHS.superAdmin.zones },
    { key: 'admins', icon: 'admin_panel_settings', tint: '#2b6cb0', soft: '#e8f0f9', label: 'Administrateurs', value: totals.admins, sub: 'Administrateurs régionaux', to: PATHS.superAdmin.utilisateurs },
  ]

  const chartValues = useMemo(
    () => nationalSeries(metric),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [regions, metric, chartWin],
  )
  const chartLabels = useMemo(() => SERIES_LABELS.slice(chartWin.start, chartWin.end), [chartWin])

  const events = useMemo(
    () => SYSTEM_EVENTS.filter((e) => regionFilter === 'toutes' || e.region === regionFilter).slice(0, 4),
    [regionFilter],
  )

  const attention = useMemo(() => {
    const items = [
      {
        key: 'zones',
        icon: 'location_on',
        tint: '#e8940c',
        soft: '#fdf4e6',
        count: totals.zonesEnAttente,
        title: (n: number) => `${n} zone${n > 1 ? 's sont' : ' est'} en attente de validation`,
        sub: "Zones à examiner par l'équipe régionale.",
        cta: 'Voir les zones',
        to: PATHS.superAdmin.zones,
      },
      {
        key: 'signalements',
        icon: 'campaign',
        tint: '#2b6cb0',
        soft: '#e8f0f9',
        count: totals.signalementsEnAttente,
        title: (n: number) => `${n} signalement${n > 1 ? 's sont' : ' est'} en attente de traitement`,
        sub: 'Signalements transmis par les conducteurs.',
        cta: 'Voir les signalements',
        to: PATHS.superAdmin.signalements,
      },
      {
        key: 'boitiers',
        icon: 'memory',
        tint: '#dc3a2f',
        soft: '#fdeeec',
        count: totals.anomalies,
        title: (n: number) => `${n} boîtier${n > 1 ? 's présentent' : ' présente'} une anomalie technique`,
        sub: 'Vérification et maintenance nécessaires.',
        cta: 'Voir le monitoring',
        to: PATHS.superAdmin.monitoring,
      },
      {
        key: 'admins',
        icon: 'manage_accounts',
        tint: '#7c3aed',
        soft: '#f1eafe',
        count: totals.adminsAction,
        title: (n: number) => `${n} administrateur${n > 1 ? 's ont des comptes nécessitant' : ' a un compte nécessitant'} une action`,
        sub: 'Vérification des accès et permissions.',
        cta: 'Voir les utilisateurs',
        to: PATHS.superAdmin.utilisateurs,
      },
    ]
    return items.filter((i) => i.count > 0)
  }, [totals])

  // TODO backend : « Boîtiers nécessitant une attention technique » doit venir de Monitoring IoT
  // (anomalies réellement remontées) ; ici c'est une donnée de démonstration.
  const systemRows = [
    { icon: 'person', tint: '#2b6cb0', soft: '#e8f0f9', label: 'Administrateurs actifs', value: totals.admins, alert: false },
    { icon: 'memory', tint: '#1f9d55', soft: '#e9f6ee', label: 'Boîtiers affectés', value: totals.affectes, alert: false },
    { icon: 'campaign', tint: '#e8940c', soft: '#fdf4e6', label: 'Signalements en attente', value: totals.signalementsEnAttente, alert: false },
    { icon: 'location_on', tint: '#7c3aed', soft: '#f1eafe', label: 'Zones à valider', value: totals.zonesEnAttente, alert: false },
    { icon: 'warning', tint: '#dc3a2f', soft: '#fdeeec', label: 'Boîtiers nécessitant une attention technique', value: totals.anomalies, alert: true },
  ]

  const handleRegionFilter = (value: string) => {
    setRegionFilter(value)
    setMapSelected(null)
    setShowAllRegions(false)
    if (value === 'toutes') setFocus({ ...NATIONAL_FOCUS })
    else setFocus({ center: REGION_CENTERS[value] ?? NATIONAL_FOCUS.center, zoom: 9 })
  }

  const selectOnMap = (slug: string, scroll = false) => {
    setMapSelected(slug)
    setFocus({ center: REGION_CENTERS[slug] ?? NATIONAL_FOCUS.center, zoom: regionFilter === 'toutes' ? 8 : 9 })
    if (scroll) mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const toggleSort = (key: SortKey) =>
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'label' ? 'asc' : 'desc' }))

  const activeLayers = LAYERS.filter((l) => layers[l])
  const layerCount = activeLayers.length
  const typeSelectValue = layerCount === LAYERS.length ? 'tous' : layerCount === 1 ? activeLayers[0] : 'perso'
  const handleTypeSelect = (value: string) => {
    if (value === 'tous') setLayers({ incidents: true, alertes: true, signalements: true, zones: true, boitiers: true })
    else if (value !== 'perso') {
      const next = { incidents: false, alertes: false, signalements: false, zones: false, boitiers: false }
      setLayers({ ...next, [value]: true } as Record<Layer, boolean>)
    }
  }

  const layerValue = (r: Row, l: Layer): number =>
    l === 'incidents' ? r.incidentsP : l === 'alertes' ? r.alertesP : l === 'signalements' ? r.signalements : l === 'zones' ? r.zones : r.boitiers

  /** Icônes mémorisées. Avec un seul type affiché, la taille du point reflète la valeur de la région. */
  const activeKey = activeLayers.join(',')
  const markerIcons = useMemo(() => {
    const active = activeKey ? (activeKey.split(',') as Layer[]) : []
    const maxValue = active.length === 1 ? Math.max(...rows.map((r) => layerValue(r, active[0])), 1) : 1
    return rows.map((r) => ({
      slug: r.slug,
      icon: regionIcon(
        r.label,
        active.map((l) => ({
          color: LAYER_META[l].color,
          size: active.length === 1 ? 10 + Math.round(14 * Math.sqrt(layerValue(r, l) / maxValue)) : 10,
        })),
        mapSelected === r.slug,
      ),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, activeKey, mapSelected])

  const visibleRows = showAllRegions || regionFilter !== 'toutes' ? sortedRows : sortedRows.slice(0, 8)
  const selectedRow = mapSelected ? rows.find((r) => r.slug === mapSelected) ?? null : null

  const sortHeader = (key: SortKey, label: string, align: 'left' | 'right') => (
    <th className={`py-2.5 ${align === 'right' ? 'px-1.5 text-center' : 'pl-3 pr-2'}`}>
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className={`inline-flex items-center gap-0.5 whitespace-nowrap text-[11px] font-bold hover:text-ink ${sort.key === key ? 'text-ink' : 'text-body'}`}
      >
        {label}
        <span className="ic text-sm">{sort.key === key ? (sort.dir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}</span>
      </button>
    </th>
  )

  const card = 'min-w-0 rounded-xl border border-line bg-white shadow-card'
  const filterCard = 'flex min-w-[200px] cursor-pointer items-center gap-3 rounded-xl border border-line bg-white px-3.5 py-2.5 shadow-card'
  const selectCls = 'w-full cursor-pointer bg-transparent text-[12.5px] font-medium text-body outline-none'

  return (
    <div className="pb-8">
      <style>{`
        .sr-reg-wrap { background: transparent; border: 0; }
        .sr-reg { position: absolute; transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; gap: 2px; cursor: pointer; }
        .sr-dots { display: flex; align-items: center; gap: 3px; padding: 4px 6px; background: #fff; border-radius: 999px; box-shadow: 0 1px 5px rgba(6,35,52,.35); }
        .sr-dots i { display: block; border-radius: 50%; }
        .sr-name { font: 700 10.5px system-ui, sans-serif; color: #062334; white-space: nowrap; text-shadow: 0 0 3px #fff, 0 0 3px #fff, 0 0 3px #fff; }
        .sr-reg-sel .sr-dots { outline: 2px solid #0F766E; }
      `}</style>

      {/* 1. En-tête */}
      <section className="mx-6 mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="ic flex-none text-[44px] text-navy-900">monitoring</span>
          <div className="min-w-0">
            <h1 className="text-[clamp(24px,2.8vw,32px)] font-extrabold leading-[1.1] tracking-[-0.026em] text-navy-900">
              Dashboard national
            </h1>
            <p className="mt-1 text-[13.5px] leading-relaxed text-info-600">
              Vue globale du système SafeRoad et de l'activité des différentes régions.
            </p>
          </div>
        </div>
        <div className="ml-auto flex flex-col items-end gap-1.5">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <label className={filterCard}>
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#e9f6ee] text-success-600">
                <span className="ic text-[22px]">place</span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[12.5px] font-extrabold leading-tight text-ink">Région</span>
                <select value={regionFilter} onChange={(e) => handleRegionFilter(e.target.value)} className={selectCls}>
                  <option value="toutes">Toutes les régions</option>
                  {REGION_STATS.map((r) => (
                    <option key={r.slug} value={r.slug}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <label className={filterCard}>
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#e8f0f9] text-info-600">
                <span className="ic text-[22px]">calendar_month</span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[12.5px] font-extrabold leading-tight text-ink">Période</span>
                <select value={periode} onChange={(e) => setPeriode(e.target.value as Periode)} className={selectCls}>
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
              onClick={() => setLastRefresh(formatNow())}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-line bg-white px-5 py-3.5 text-[13px] font-bold text-ink shadow-card transition-colors hover:bg-page"
            >
              <span className="ic text-xl text-info-600">refresh</span>
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

      {/* 2. KPI : 2 rangées de 4 */}
      <section className="mx-6 mt-4.5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Link key={kpi.key} to={kpi.to} className={`${card} flex items-center gap-3.5 p-4 transition-shadow hover:shadow-md`}>
            <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full" style={{ background: kpi.soft, color: kpi.tint }}>
              <span className="ic text-[26px]">{kpi.icon}</span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[11px] font-extrabold uppercase leading-tight tracking-wide text-ink">{kpi.label}</p>
              <p className="m-0 mt-1 text-[28px] font-extrabold leading-none tracking-tight text-navy-900">{fmt(kpi.value)}</p>
              <p className="m-0 mt-1.5 text-[11.5px] font-medium leading-snug text-info-600">{kpi.sub}</p>
            </div>
          </Link>
        ))}
      </section>

      {/* 3. Activité par région | Situation du système | Carte nationale */}
      <section className="mx-6 mt-4.5 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,0.85fr)_minmax(0,1.8fr)]">
        <div className={`${card} p-5`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="m-0 text-[15px] font-extrabold text-ink">Activité par région</p>
            <button
              type="button"
              onClick={() => {
                if (regionFilter !== 'toutes') {
                  handleRegionFilter('toutes')
                  setShowAllRegions(true)
                } else {
                  setShowAllRegions((v) => !v)
                }
              }}
              className="inline-flex items-center gap-1 text-[11.5px] font-bold text-info-600"
            >
              {showAllRegions && regionFilter === 'toutes' ? 'Voir moins' : 'Voir toutes les régions'}
              <span className="ic text-base">{showAllRegions && regionFilter === 'toutes' ? 'arrow_upward' : 'arrow_forward'}</span>
            </button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-line-soft">
            <table className="w-full min-w-[400px] border-collapse text-left text-[12.5px]">
              <thead>
                <tr className="bg-page">
                  {sortHeader('label', 'Région', 'left')}
                  {sortHeader('boitiers', 'Boîtiers', 'right')}
                  {sortHeader('incidents', 'Incidents', 'right')}
                  {sortHeader('signalements', 'Signalements', 'right')}
                  {sortHeader('zones', 'Zones', 'right')}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => (
                  <tr
                    key={r.slug}
                    onClick={() => selectOnMap(r.slug, true)}
                    className={`cursor-pointer border-t border-line-soft hover:bg-page ${mapSelected === r.slug ? 'bg-page' : ''}`}
                  >
                    <td className="py-2.5 pl-3 pr-2 font-semibold text-ink">
                      <span className="flex items-center gap-2.5">
                        <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: regionDot(r.slug) }} />
                        {r.label}
                      </span>
                    </td>
                    <td className="px-1.5 py-2.5 text-center tabular-nums text-body">{r.boitiers}</td>
                    <td className="px-1.5 py-2.5 text-center tabular-nums text-body">{fmt(r.incidentsP)}</td>
                    <td className="px-1.5 py-2.5 text-center tabular-nums text-body">{r.signalements}</td>
                    <td className="px-1.5 py-2.5 text-center tabular-nums text-body">{r.zones}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={`${card} p-5`}>
          <p className="m-0 mb-3 text-[15px] font-extrabold text-ink">Situation du système</p>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {systemRows.map((s) => (
              <li key={s.label} className="flex items-center gap-3.5 rounded-lg border border-line-soft px-3 py-2.5">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full" style={{ background: s.soft, color: s.tint }}>
                  <span className="ic text-[24px]">{s.icon}</span>
                </span>
                <div className="min-w-0">
                  <p className="m-0 text-[11.5px] font-medium leading-snug text-body">{s.label}</p>
                  <p className={`m-0 text-[22px] font-extrabold leading-tight tabular-nums ${s.alert && s.value > 0 ? 'text-danger-600' : 'text-navy-900'}`}>
                    {s.value}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div ref={mapSectionRef} className={`${card} flex flex-col p-5 lg:col-span-2 xl:col-span-1`}>
          <p className="m-0 mb-3 text-[15px] font-extrabold text-ink">Carte nationale SafeRoad</p>
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {LAYERS.map((l) => {
              const on = layers[l]
              const m = LAYER_META[l]
              return (
                <button
                  key={l}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setLayers((prev) => ({ ...prev, [l]: !prev[l] }))}
                  className={`inline-flex items-center gap-1.5 rounded-full border-[1.5px] py-1 pl-1 pr-2.5 text-[11px] font-bold transition-colors ${
                    on ? 'bg-white text-ink' : 'border-line bg-white text-faint hover:bg-page'
                  }`}
                  style={on ? { borderColor: m.color } : undefined}
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full"
                    style={on ? { background: m.soft, color: m.color } : { background: '#eef2f5', color: '#8aa0ad' }}
                  >
                    <span className="ic text-[13px]">{m.icon}</span>
                  </span>
                  {m.label}
                </button>
              )
            })}
            <select
              value={typeSelectValue}
              onChange={(e) => handleTypeSelect(e.target.value)}
              aria-label="Type de données"
              className="ml-auto cursor-pointer rounded-lg border-[1.5px] border-line bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-ink outline-none"
            >
              <option value="tous">Tous</option>
              {LAYERS.map((l) => (
                <option key={l} value={l}>
                  {LAYER_META[l].label}
                </option>
              ))}
              {typeSelectValue === 'perso' && <option value="perso">Sélection personnalisée</option>}
            </select>
          </div>
          <div className="relative min-h-[340px] flex-1 overflow-hidden rounded-lg">
            <div className="absolute inset-0">
              <MapContainer center={NATIONAL_FOCUS.center} zoom={NATIONAL_FOCUS.zoom} className="h-full w-full" scrollWheelZoom={false}>
                <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <FlyTo focus={focus} />
                {layerCount > 0 &&
                  markerIcons.map((m) => (
                    <Marker key={m.slug} position={REGION_CENTERS[m.slug]} icon={m.icon} eventHandlers={{ click: () => selectOnMap(m.slug) }} />
                  ))}
              </MapContainer>
            </div>
            {layerCount === 0 && (
              <p className="pointer-events-none absolute inset-x-0 top-3 z-[500] m-0 text-center text-[11.5px] font-bold text-body">
                Sélectionnez au moins un type de données.
              </p>
            )}
            {layerCount === 1 && (
              <p className="pointer-events-none absolute bottom-3 left-3 z-[1000] m-0 rounded-lg border border-line bg-white/95 px-2.5 py-1.5 text-[10.5px] font-semibold text-body shadow-card">
                La taille des points reflète la valeur de chaque région.
              </p>
            )}
            {selectedRow && (
              <div className="absolute right-3 top-3 z-[1000] w-[200px] rounded-lg border border-line bg-white p-3.5 shadow-card">
                <div className="flex items-start justify-between">
                  <p className="m-0 text-[14px] font-extrabold text-navy-900">{selectedRow.label}</p>
                  <button type="button" onClick={() => setMapSelected(null)} className="ic text-base text-faint hover:text-ink" aria-label="Fermer">
                    close
                  </button>
                </div>
                <ul className="m-0 mt-1.5 flex list-none flex-col gap-0.5 p-0 text-[11.5px] text-body">
                  <li>Boîtiers : <span className="font-bold text-ink">{selectedRow.boitiers}</span></li>
                  <li>Incidents : <span className="font-bold text-ink">{fmt(selectedRow.incidentsP)}</span></li>
                  <li>Signalements : <span className="font-bold text-ink">{selectedRow.signalements}</span></li>
                  <li>Zones : <span className="font-bold text-ink">{selectedRow.zones}</span></li>
                </ul>
                {regionFilter === 'toutes' ? (
                  <button
                    type="button"
                    onClick={() => handleRegionFilter(selectedRow.slug)}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md bg-navy-900 px-3 py-2 text-[12px] font-bold text-white hover:opacity-90"
                  >
                    Voir la région
                    <span className="ic text-base">arrow_forward</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRegionFilter('toutes')}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border-[1.5px] border-line px-3 py-2 text-[12px] font-bold text-ink hover:bg-page"
                  >
                    <span className="ic text-base">arrow_back</span>
                    Toutes les régions
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. Évolution | Activité récente | Situations nécessitant une attention */}
      <section className="mx-6 mt-4.5 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.85fr)_minmax(0,1.3fr)]">
        <div className={`${card} p-5 lg:col-span-2 xl:col-span-1`}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="m-0 text-[15px] font-extrabold text-ink">Évolution des {SERIES_META[metric].label.toLowerCase()}</p>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as SeriesKey)}
              className="cursor-pointer rounded-lg border-[1.5px] border-line bg-white px-2.5 py-1.5 text-[12px] font-semibold text-ink outline-none"
            >
              {(Object.keys(SERIES_META) as SeriesKey[]).map((k) => (
                <option key={k} value={k}>
                  {SERIES_META[k].label}
                </option>
              ))}
            </select>
          </div>
          <EvolutionChart labels={chartLabels} values={chartValues} color={SERIES_META[metric].color} />
          <p className="m-0 mt-1 text-[11px] font-medium text-faint">
            Du {chartLabels[0]} au {chartLabels[chartLabels.length - 1]} · survolez la courbe pour le détail jour par jour.
          </p>
        </div>

        <div className={`${card} flex flex-col p-5`}>
          <p className="m-0 mb-3 text-[15px] font-extrabold text-ink">Activité récente</p>
          {events.length === 0 ? (
            <p className="m-0 py-4 text-[12.5px] text-faint">Aucune activité récente pour cette région.</p>
          ) : (
            <ul className="m-0 list-none p-0">
              {events.map((ev, i) => {
                const meta = EVENT_META[ev.kind]
                return (
                  <li key={ev.id} className="relative flex items-center gap-2.5 py-2.5 pl-5">
                    <span
                      className="absolute left-[3px] w-px bg-line"
                      style={{ top: i === 0 ? '50%' : 0, bottom: i === events.length - 1 ? '50%' : 0 }}
                    />
                    <span className="absolute left-0 top-1/2 h-[7px] w-[7px] -translate-y-1/2 rounded-full bg-navy-900" />
                    <span className="w-9 flex-none text-[11px] font-semibold tabular-nums text-body">{ev.time}</span>
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full" style={{ background: meta.bg, color: meta.fg }}>
                      <span className="ic text-[17px]">{meta.icon}</span>
                    </span>
                    <div className="min-w-0">
                      <p className="m-0 text-[12px] font-bold leading-tight text-ink">{ev.title}</p>
                      <p className="m-0 mt-0.5 text-[10.5px] font-medium text-info-600">{ev.place}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="flex-1" />
          <Link to={PATHS.superAdmin.historique} className="mt-3 inline-flex items-center gap-1 self-end text-[11.5px] font-bold text-info-600">
            Voir l'historique
            <span className="ic text-base">arrow_forward</span>
          </Link>
        </div>

        <div className="min-w-0 rounded-xl border border-[#f6d5d1] bg-[#fdf6f5] p-5 shadow-card">
          <p className="m-0 mb-3 flex items-center gap-2 text-[15px] font-extrabold text-danger-600">
            <span className="ic text-xl">warning</span>
            Situations nécessitant une attention
          </p>
          {attention.length === 0 ? (
            <p className="m-0 py-2 text-[12.5px] font-semibold text-success-600">Aucune situation nécessitant une attention.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {attention.map((a) => (
                <li key={a.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line-soft bg-white px-3 py-2.5">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full" style={{ background: a.soft, color: a.tint }}>
                    <span className="ic text-[20px]">{a.icon}</span>
                  </span>
                  <div className="min-w-0 flex-1 basis-44">
                    <p className="m-0 text-[12px] font-bold leading-snug text-ink">{a.title(a.count)}</p>
                    <p className="m-0 mt-0.5 text-[10.5px] font-medium text-faint">{a.sub}</p>
                  </div>
                  <Link
                    to={a.to}
                    className="flex-none whitespace-nowrap rounded-md border-[1.5px] border-line px-3 py-1.5 text-[11px] font-bold text-info-600 transition-colors hover:bg-page"
                  >
                    {a.cta}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
