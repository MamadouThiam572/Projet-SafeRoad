import { useMemo, useRef, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useAuth } from '@/context/AuthContext'
import {
  GRAVITE_META,
  INCIDENTS,
  KPI_TRENDS,
  SOURCE_META,
  STATUT_META,
  type Gravite,
  type StatutIncident,
} from '@/data/adminIncidents'
import { daysSince, latestDate } from '@/lib/period'
import { formatCoords, offsetLatLng, regionCenter, regionLabel } from '@/lib/regions'

const PAGE_SIZE = 8

type Periode = 'aujourdhui' | '7j' | '30j' | 'tout'

const PERIODE_OPTIONS: { value: Periode; label: string }[] = [
  { value: 'tout', label: 'Toute la période' },
  { value: 'aujourdhui', label: "Aujourd'hui" },
  { value: '7j', label: '7 derniers jours' },
  { value: '30j', label: '30 derniers jours' },
]

function matchesPeriode(ts: string, periode: Periode, reference: Date): boolean {
  if (periode === 'tout') return true
  const diff = daysSince(reference, ts)
  if (periode === 'aujourdhui') return diff === 0
  if (periode === '7j') return diff >= 0 && diff <= 6
  return diff >= 0 && diff <= 29 // 30j
}

const TYPE_ICON: Record<string, string> = {
  'Accident signalé': 'car_crash',
  'Freinage brusque': 'speed',
  'Collision signalée': 'report',
  'Incident matériel': 'build',
  'Excès de vitesse': 'speed',
  Autre: 'help',
}

function typeIcon(type: string): string {
  return TYPE_ICON[type] ?? 'report_problem'
}

/** Petite courbe de tendance en SVG — pas d'axes, une seule teinte par carte KPI. */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const width = 64
  const height = 24
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const span = Math.max(max - min, 1)

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / span) * height
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-hidden="true">
      <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IncidentsPage() {
  const { user } = useAuth()
  const region = regionLabel(user?.region)
  const center = useMemo(() => regionCenter(user?.region), [user?.region])

  /* Date de référence pour le filtre Période = le jour le plus récent du jeu de données (voir src/lib/period.ts). */
  const reference = useMemo(() => latestDate(INCIDENTS.map((i) => i.ts)), [])

  const [periode, setPeriode] = useState<Periode>('tout')
  const [search, setSearch] = useState('')
  const [localite, setLocalite] = useState('tous')
  const [type, setType] = useState('tous')
  const [gravite, setGravite] = useState<'tous' | Gravite>('tous')
  const [statut, setStatut] = useState<'tous' | StatutIncident>('tous')
  const [boitier, setBoitier] = useState('tous')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const localites = useMemo(() => Array.from(new Set(INCIDENTS.map((i) => i.localite))).sort(), [])
  const types = useMemo(() => Array.from(new Set(INCIDENTS.map((i) => i.type))).sort(), [])
  const boitiers = useMemo(
    () => Array.from(new Set(INCIDENTS.map((i) => i.boitier).filter((b): b is string => Boolean(b)))).sort(),
    [],
  )

  /* Sous-ensemble scopé par Période — alimente à la fois les KPI (voir leur
     sous-titre « Sur la période sélectionnée ») et la liste/carte, que les
     autres filtres (recherche, localité…) viennent ensuite affiner. */
  const periodFiltered = useMemo(
    () => INCIDENTS.filter((i) => matchesPeriode(i.ts, periode, reference)),
    [periode, reference],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return periodFiltered.filter((i) => {
      if (q && !i.id.toLowerCase().includes(q) && !(i.boitier ?? '').toLowerCase().includes(q)) return false
      if (localite !== 'tous' && i.localite !== localite) return false
      if (type !== 'tous' && i.type !== type) return false
      if (gravite !== 'tous' && i.gravite !== gravite) return false
      if (statut !== 'tous' && i.statut !== statut) return false
      if (boitier !== 'tous' && i.boitier !== boitier) return false
      return true
    })
  }, [periodFiltered, search, localite, type, gravite, statut, boitier])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const kpis = useMemo(() => {
    const total = periodFiltered.length
    const aExaminer = periodFiltered.filter((i) => i.statut === 'a_examiner').length
    const enCours = periodFiltered.filter((i) => i.statut === 'en_cours' || i.statut === 'transmis').length
    const clotures = periodFiltered.filter((i) => i.statut === 'cloture').length
    return [
      { key: 'total', icon: 'report', tint: '#dc3a2f', soft: '#fdeeec', value: total, label: 'Total des incidents', sub: 'Sur la période sélectionnée', trend: KPI_TRENDS.total },
      { key: 'examiner', icon: 'pending_actions', tint: '#e8940c', soft: '#fdf4e6', value: aExaminer, label: 'À examiner', sub: "Incidents en attente d'examen", trend: KPI_TRENDS.aExaminer },
      { key: 'encours', icon: 'sync', tint: '#2b6cb0', soft: '#e8f0f9', value: enCours, label: 'En cours de traitement', sub: 'Incidents nécessitant un suivi', trend: KPI_TRENDS.enCours },
      { key: 'clotures', icon: 'check_circle', tint: '#1f9d55', soft: '#e9f6ee', value: clotures, label: 'Clôturés', sub: 'Incidents dont le traitement est terminé', trend: KPI_TRENDS.clotures },
    ]
  }, [periodFiltered])

  const recents = useMemo(
    () => [...INCIDENTS].sort((a, b) => (a.ts < b.ts ? 1 : -1)).slice(0, 4),
    [],
  )

  const listRef = useRef<HTMLDivElement>(null)
  const scrollToList = () => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const resetFilters = () => {
    setPeriode('tout')
    setSearch('')
    setLocalite('tous')
    setType('tous')
    setGravite('tous')
    setStatut('tous')
    setBoitier('tous')
    setPage(1)
  }

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allOnPageSelected = paginated.length > 0 && paginated.every((i) => selected.has(i.id))
  const toggleSelectAllOnPage = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allOnPageSelected) paginated.forEach((i) => next.delete(i.id))
      else paginated.forEach((i) => next.add(i.id))
      return next
    })
  }

  return (
    <div className="pb-8">
      <section className="mx-6 mt-5 flex flex-wrap items-start justify-between gap-3.5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-navy-900 text-white">
            <span className="ic text-2xl">warning</span>
          </span>
          <div className="min-w-0">
            <h1 className="text-[clamp(21px,2.6vw,26px)] font-extrabold leading-[1.15] tracking-[-0.026em] text-ink">
              Gestion des incidents
            </h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-body">
              Consultez et suivez les incidents signalés dans votre région afin de faciliter leur analyse et leur
              traitement.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-white px-3.5 py-2.5 text-xs font-bold text-ink">
            <span className="ic text-base text-brand-600">place</span>
            Région : {region}
            <span className="ic text-base text-muted">expand_more</span>
          </span>
          <span className="flex max-w-[280px] items-start gap-2 rounded-xl border border-brand-100 bg-brand-50 px-3.5 py-2.5 text-[11px] font-semibold leading-snug text-brand-700">
            <span className="ic mt-0.5 flex-none text-base">verified_user</span>
            Les données affichées concernent uniquement votre périmètre régional.
          </span>
        </div>
      </section>

      <section className="mx-6 mt-4.5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.key} className="min-w-0 rounded-2xl border border-line bg-white p-4.5 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <span
                  className="flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-full"
                  style={{ background: kpi.soft, color: kpi.tint }}
                >
                  <span className="ic text-2xl">{kpi.icon}</span>
                </span>
                <div className="min-w-0">
                  <p className="m-0 text-2xl font-extrabold leading-none tracking-tight text-ink">{kpi.value}</p>
                  <p className="m-0 mt-1.5 text-xs font-semibold text-body">{kpi.label}</p>
                </div>
              </div>
              <Sparkline data={kpi.trend} color={kpi.tint} />
            </div>
            <p className="mt-3 text-[11px] font-semibold text-faint">{kpi.sub}</p>
          </div>
        ))}
      </section>

      <section className="mx-6 mt-4.5 rounded-2xl border border-line bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-[10px] border-[1.5px] border-line-field bg-field px-3.5 py-2.5">
            <span className="ic text-lg text-faint">search</span>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Rechercher par identifiant ou numéro de boîtier…"
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none placeholder:text-faint"
            />
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-[10px] border-[1.5px] border-line px-3.5 py-2.5 text-[12.5px] font-bold text-body transition-colors hover:bg-page"
          >
            <span className="ic text-base">refresh</span>
            Réinitialiser
          </button>
        </div>

        <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
          <label className="block">
            <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-faint">Période</span>
            <select
              value={periode}
              onChange={(e) => {
                setPeriode(e.target.value as Periode)
                setPage(1)
              }}
              className="w-full rounded-[9px] border-[1.5px] border-line bg-white px-2.5 py-2 text-[12.5px] font-semibold text-ink outline-none"
            >
              {PERIODE_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-faint">Localité</span>
            <select
              value={localite}
              onChange={(e) => {
                setLocalite(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-[9px] border-[1.5px] border-line bg-white px-2.5 py-2 text-[12.5px] font-semibold text-ink outline-none"
            >
              <option value="tous">Toutes</option>
              {localites.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-faint">Type d'incident</span>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-[9px] border-[1.5px] border-line bg-white px-2.5 py-2 text-[12.5px] font-semibold text-ink outline-none"
            >
              <option value="tous">Tous</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-faint">Gravité</span>
            <select
              value={gravite}
              onChange={(e) => {
                setGravite(e.target.value as 'tous' | Gravite)
                setPage(1)
              }}
              className="w-full rounded-[9px] border-[1.5px] border-line bg-white px-2.5 py-2 text-[12.5px] font-semibold text-ink outline-none"
            >
              <option value="tous">Toutes</option>
              {(Object.keys(GRAVITE_META) as Gravite[]).map((g) => (
                <option key={g} value={g}>
                  {GRAVITE_META[g].label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-faint">Statut</span>
            <select
              value={statut}
              onChange={(e) => {
                setStatut(e.target.value as 'tous' | StatutIncident)
                setPage(1)
              }}
              className="w-full rounded-[9px] border-[1.5px] border-line bg-white px-2.5 py-2 text-[12.5px] font-semibold text-ink outline-none"
            >
              <option value="tous">Tous</option>
              {(Object.keys(STATUT_META) as StatutIncident[]).map((s) => (
                <option key={s} value={s}>
                  {STATUT_META[s].label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-faint">Boîtier</span>
            <select
              value={boitier}
              onChange={(e) => {
                setBoitier(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-[9px] border-[1.5px] border-line bg-white px-2.5 py-2 text-[12.5px] font-semibold text-ink outline-none"
            >
              <option value="tous">Tous</option>
              {boitiers.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section ref={listRef} className="mx-6 mt-4.5 scroll-mt-4 grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.7fr_1fr]">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-line bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-5 py-4">
            <p className="m-0 text-sm font-extrabold text-ink">Liste des incidents ({filtered.length})</p>
            <span className="text-[11px] font-semibold text-faint">Trier par : Date ↓</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-line-soft text-[10.5px] font-bold uppercase tracking-wide text-faint">
                  <th className="px-5 py-3">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleSelectAllOnPage}
                      className="h-4 w-4 rounded border-line-field accent-brand-600"
                      aria-label="Tout sélectionner sur cette page"
                    />
                  </th>
                  <th className="px-3 py-3">Identifiant</th>
                  <th className="px-3 py-3">Date et heure</th>
                  <th className="px-3 py-3">Localisation</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Gravité</th>
                  <th className="px-3 py-3">Source</th>
                  <th className="px-3 py-3">Statut</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((incident) => {
                  const gMeta = GRAVITE_META[incident.gravite]
                  const sMeta = STATUT_META[incident.statut]
                  const srcMeta = SOURCE_META[incident.source]
                  const [lat, lng] = offsetLatLng(center, incident.offset)
                  return (
                    <tr key={incident.id} className="border-b border-line-soft last:border-0 hover:bg-page">
                      <td className="px-5 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(incident.id)}
                          onChange={() => toggleSelected(incident.id)}
                          className="h-4 w-4 rounded border-line-field accent-brand-600"
                          aria-label={`Sélectionner ${incident.id}`}
                        />
                      </td>
                      <td className="px-3 py-3 font-bold text-ink">{incident.id}</td>
                      <td className="px-3 py-3 text-body">
                        <p className="m-0">{incident.date}</p>
                        <p className="m-0 text-[11px] text-faint">{incident.heure}</p>
                      </td>
                      <td className="px-3 py-3 text-body">
                        <p className="m-0 flex items-center gap-1 font-semibold text-ink">
                          <span className="ic text-sm text-faint">place</span>
                          {incident.localite}
                        </p>
                        <p className="m-0 text-[11px] text-faint">
                          {incident.lieu} ({formatCoords(lat, lng)})
                        </p>
                      </td>
                      <td className="px-3 py-3 text-body">
                        <span className="flex items-center gap-1.5">
                          <span className="ic text-base text-faint">{typeIcon(incident.type)}</span>
                          {incident.type}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-md px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: gMeta.soft, color: gMeta.text }}>
                          {gMeta.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-body">
                        <span className="flex items-center gap-1.5">
                          <span className="ic text-base text-faint">{srcMeta.icon}</span>
                          {srcMeta.label}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-md px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: sMeta.soft, color: sMeta.text }}>
                          {sMeta.label}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {/* TODO : vue détaillée / modale d'un incident — pas encore construite. */}
                        <button
                          type="button"
                          className="whitespace-nowrap rounded-lg border-[1.5px] border-line px-3 py-1.5 text-[11px] font-bold text-ink hover:bg-page"
                        >
                          Voir les détails
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-8 text-center text-[12.5px] text-faint">
                      Aucun incident ne correspond à ces filtres.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft px-5 py-3.5 text-[11.5px] font-semibold text-faint">
              <span>
                Affichage de {(currentPage - 1) * PAGE_SIZE + 1} à {Math.min(currentPage * PAGE_SIZE, filtered.length)} sur{' '}
                {filtered.length} incidents
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="ic flex h-7 w-7 items-center justify-center rounded-lg text-base disabled:opacity-30"
                >
                  chevron_left
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={`flex h-7 w-7 items-center justify-center rounded-lg font-bold ${
                      n === currentPage ? 'bg-brand-600 text-white' : 'text-body hover:bg-page'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="ic flex h-7 w-7 items-center justify-center rounded-lg text-base disabled:opacity-30"
                >
                  chevron_right
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="min-w-0 overflow-hidden rounded-2xl border border-line bg-white shadow-card">
            <div className="border-b border-line-soft px-5 py-4">
              <p className="m-0 text-sm font-extrabold text-ink">Carte des incidents — {region}</p>
            </div>
            <div className="relative h-[280px] w-full">
              <MapContainer center={center} zoom={12} className="h-full w-full" scrollWheelZoom={false}>
                <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {filtered.map((incident) => {
                  const meta = GRAVITE_META[incident.gravite]
                  return (
                    <CircleMarker
                      key={incident.id}
                      center={offsetLatLng(center, incident.offset)}
                      radius={8}
                      pathOptions={{ color: '#fff', weight: 2, fillColor: meta.color, fillOpacity: 0.92 }}
                    >
                      <Popup>
                        <div className="w-[180px]">
                          <p className="m-0 text-[13px] font-extrabold text-ink">{incident.id}</p>
                          <p className="m-0 mt-1 text-[11.5px] text-body">{incident.type}</p>
                          <p
                            className="m-0 mt-1 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                            style={{ background: meta.soft, color: meta.text }}
                          >
                            {meta.label}
                          </p>
                          <p className="m-0 mt-1 text-[10.5px] text-faint">
                            {incident.date} · {incident.heure}
                          </p>
                        </div>
                      </Popup>
                    </CircleMarker>
                  )
                })}
              </MapContainer>
              <div className="pointer-events-none absolute bottom-2 left-2 z-[1000] flex flex-wrap gap-x-2.5 gap-y-1 rounded-[10px] border border-line bg-white/95 px-2.5 py-2 text-[10px] font-semibold text-body shadow-card">
                {(Object.keys(GRAVITE_META) as Gravite[]).map((g) => (
                  <span key={g} className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: GRAVITE_META[g].color }} />
                    {GRAVITE_META[g].label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-card">
            <div className="mb-3.5 flex items-center justify-between">
              <p className="m-0 text-sm font-extrabold text-ink">Incidents récents dans votre région</p>
              {/* Déjà sur cette page : "Voir tout" réinitialise les filtres et ramène à la liste complète plutôt que de rediriger vers elle-même. */}
              <button
                type="button"
                onClick={() => {
                  resetFilters()
                  scrollToList()
                }}
                className="text-xs font-bold text-brand-600"
              >
                Voir tout →
              </button>
            </div>
            <ul className="flex flex-col gap-3">
              {recents.map((incident) => {
                const meta = GRAVITE_META[incident.gravite]
                return (
                  <li key={incident.id} className="flex items-start gap-3">
                    <span
                      className="flex h-8 w-8 flex-none items-center justify-center rounded-full"
                      style={{ background: meta.soft, color: meta.text }}
                    >
                      <span className="ic text-base">{typeIcon(incident.type)}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate text-[12.5px] font-bold text-ink">
                        {incident.id} {incident.lieu}
                      </p>
                      <p className="m-0 mt-0.5 text-[11px] text-faint">
                        {incident.type} · {incident.heure}
                      </p>
                    </div>
                    <span
                      className="flex-none rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                      style={{ background: meta.soft, color: meta.text }}
                    >
                      {meta.label}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
