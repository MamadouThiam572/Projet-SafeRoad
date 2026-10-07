import { useMemo, useRef, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useAuth } from '@/context/AuthContext'
import {
  BOITIERS,
  CONNEXION_META,
  KPI_TRENDS,
  TECHNIQUE_META,
  type Boitier,
  type EtatConnexion,
  type EtatTechnique,
} from '@/data/adminMonitoring'
import { exportTableToPdf } from '@/lib/exportPdf'
import { formatCoords, offsetLatLng, regionCenter, regionLabel } from '@/lib/regions'

const PAGE_SIZE = 5

type Tri = 'recent' | 'ancien'

/** Petite courbe de tendance en SVG — pas d'axes, une seule teinte par carte KPI (même composant que /admin/incidents). */
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

function batterieMeta(pct: number): { icon: string; color: string } {
  if (pct < 20) return { icon: 'battery_alert', color: '#dc3a2f' }
  if (pct < 50) return { icon: 'battery_3_bar', color: '#e8940c' }
  return { icon: 'battery_full', color: '#1f9d55' }
}

const RESEAU_ICON: Record<Boitier['reseau'], string> = {
  GSM: 'signal_cellular_alt',
  WiFi: 'wifi',
}

function formatNow(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function MonitoringPage() {
  const { user } = useAuth()
  const region = regionLabel(user?.region)
  const center = useMemo(() => regionCenter(user?.region), [user?.region])

  const [search, setSearch] = useState('')
  const [localite, setLocalite] = useState('tous')
  const [connexion, setConnexion] = useState<'tous' | EtatConnexion>('tous')
  const [technique, setTechnique] = useState<'tous' | EtatTechnique>('tous')
  const [tri, setTri] = useState<Tri>('recent')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  /* Pas de backend temps réel pour l'instant : le bouton ré-horodate juste localement — voir // TODO backend plus bas. */
  const [lastRefresh, setLastRefresh] = useState(() => formatNow())
  /* Boîtier actuellement ouvert dans le panneau de détail (depuis la liste ou la carte). */
  const [detailBoitier, setDetailBoitier] = useState<Boitier | null>(null)

  const listRef = useRef<HTMLDivElement>(null)
  const scrollToList = () => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const localites = useMemo(() => Array.from(new Set(BOITIERS.map((b) => b.localite))).sort(), [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = BOITIERS.filter((b) => {
      if (q && !b.id.toLowerCase().includes(q) && !b.vehicule.toLowerCase().includes(q)) return false
      if (localite !== 'tous' && b.localite !== localite) return false
      if (connexion !== 'tous' && b.connexion !== connexion) return false
      if (technique !== 'tous' && b.technique !== technique) return false
      return true
    })
    return [...rows].sort((a, b) =>
      tri === 'recent'
        ? (a.derniereCommunicationTs < b.derniereCommunicationTs ? 1 : -1)
        : (a.derniereCommunicationTs > b.derniereCommunicationTs ? 1 : -1),
    )
  }, [search, localite, connexion, technique, tri])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const kpis = useMemo(() => {
    const total = BOITIERS.length
    const enLigne = BOITIERS.filter((b) => b.connexion === 'en_ligne').length
    const horsLigne = BOITIERS.filter((b) => b.connexion === 'hors_ligne').length
    const enAnomalie = BOITIERS.filter((b) => b.technique === 'anomalie').length
    return [
      { key: 'total', icon: 'memory', tint: '#2b6cb0', soft: '#e8f0f9', value: total, label: 'Total des boîtiers', sub: 'Boîtiers enregistrés dans la région', trend: KPI_TRENDS.total },
      { key: 'enligne', icon: 'sensors', tint: '#1f9d55', soft: '#e9f6ee', value: enLigne, label: 'En ligne', sub: 'Boîtiers joignables actuellement', trend: KPI_TRENDS.enLigne },
      { key: 'horsligne', icon: 'sensors_off', tint: '#e8940c', soft: '#fdf4e6', value: horsLigne, label: 'Hors ligne', sub: 'Boîtiers sans communication récente', trend: KPI_TRENDS.horsLigne },
      { key: 'anomalie', icon: 'warning', tint: '#dc3a2f', soft: '#fdeeec', value: enAnomalie, label: 'En anomalie', sub: 'Boîtiers signalant un problème technique', trend: KPI_TRENDS.enAnomalie },
    ]
  }, [])

  /*
   * Alertes de supervision — chacune est directement dérivée de la liste des
   * boîtiers (pas de chiffres inventés hors de ce jeu de données). Cliquer
   * une carte applique le filtre correspondant à la liste ci-dessous.
   */
  const alerts = useMemo(() => {
    const sansCommunication = BOITIERS.filter((b) => {
      const diffMs = Date.now() - new Date(b.derniereCommunicationTs).getTime()
      return b.connexion === 'hors_ligne' && diffMs > 24 * 60 * 60 * 1000
    })
    const alimentation = BOITIERS.filter((b) => b.batterie < 20)
    const anomalieTech = BOITIERS.filter((b) => b.technique === 'anomalie')
    const maintenance = BOITIERS.filter((b) => b.technique === 'maintenance')
    return [
      {
        key: 'sanscomm',
        icon: 'wifi_off',
        tint: '#dc3a2f',
        soft: '#fdeeec',
        count: sansCommunication.length,
        label: 'Boîtiers sans communication',
        sub: 'Depuis plus de 24h',
        actionLabel: 'Consulter',
        onClick: () => {
          setConnexion('hors_ligne')
          setTechnique('tous')
          setPage(1)
          scrollToList()
        },
      },
      {
        key: 'alimentation',
        icon: 'battery_alert',
        tint: '#e8940c',
        soft: '#fdf4e6',
        count: alimentation.length,
        label: "Problèmes d'alimentation",
        sub: 'Batterie faible (< 20%)',
        actionLabel: 'Consulter',
        onClick: () => {
          setSearch(alimentation[0]?.id ?? '')
          setConnexion('tous')
          setTechnique('tous')
          setPage(1)
          scrollToList()
        },
      },
      {
        key: 'anomalie',
        icon: 'report',
        tint: '#dc3a2f',
        soft: '#fdeeec',
        count: anomalieTech.length,
        label: 'Boîtiers en anomalie technique',
        sub: 'Nécessitent une vérification',
        actionLabel: 'Examiner',
        onClick: () => {
          setConnexion('tous')
          setTechnique('anomalie')
          setSearch('')
          setPage(1)
          scrollToList()
        },
      },
      {
        key: 'maintenance',
        icon: 'build',
        tint: '#7c3aed',
        soft: '#f1eafe',
        count: maintenance.length,
        label: 'En maintenance',
        sub: 'Intervention en cours',
        actionLabel: 'Voir',
        onClick: () => {
          setConnexion('tous')
          setTechnique('maintenance')
          setSearch('')
          setPage(1)
          scrollToList()
        },
      },
    ]
  }, [])

  const resetFilters = () => {
    setSearch('')
    setLocalite('tous')
    setConnexion('tous')
    setTechnique('tous')
    setTri('recent')
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

  const allOnPageSelected = paginated.length > 0 && paginated.every((b) => selected.has(b.id))
  const toggleSelectAllOnPage = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allOnPageSelected) paginated.forEach((b) => next.delete(b.id))
      else paginated.forEach((b) => next.add(b.id))
      return next
    })
  }

  const handleExport = () => {
    exportTableToPdf({
      title: 'Monitoring IoT — Liste des boîtiers',
      subtitle: `Région de ${region} · ${filtered.length} boîtier${filtered.length > 1 ? 's' : ''}`,
      columns: [
        { header: 'Identifiant', key: 'id' },
        { header: 'Véhicule', key: 'vehicule' },
        { header: 'Localité', key: 'localite' },
        { header: 'Lieu', key: 'lieu' },
        { header: 'Connexion', key: 'connexion' },
        { header: 'État technique', key: 'technique' },
        { header: 'Dernière communication', key: 'derniereCommunication' },
        { header: 'Batterie', key: 'batterie' },
        { header: 'Réseau', key: 'reseau' },
      ],
      rows: filtered.map((b) => ({
        id: b.id,
        vehicule: b.vehicule,
        localite: b.localite,
        lieu: b.lieu,
        connexion: CONNEXION_META[b.connexion].label,
        technique: TECHNIQUE_META[b.technique].label,
        derniereCommunication: b.derniereCommunication,
        batterie: `${b.batterie}%`,
        reseau: b.reseau,
      })),
      filename: `monitoring-boitiers-${region.toLowerCase()}.pdf`,
    })
  }

  return (
    <div className="pb-8">
      {/* Clignotement des boîtiers en ligne sur la carte (voir isOnlineHealthy / boitier-marker-pulse plus bas). */}
      <style>{`
        @keyframes boitier-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .boitier-marker-pulse {
          animation: boitier-pulse 1.6s ease-in-out infinite;
        }
      `}</style>

      <section className="mx-6 mt-5 flex flex-wrap items-start justify-between gap-3.5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-navy-900 text-white">
            <span className="ic text-2xl">memory</span>
          </span>
          <div className="min-w-0">
            <h1 className="text-[clamp(21px,2.6vw,26px)] font-extrabold leading-[1.15] tracking-[-0.026em] text-ink">
              Monitoring IoT
            </h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-body">
              Surveillance des boîtiers et suivi de leur activité en temps réel.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex items-start gap-1.5 whitespace-nowrap rounded-full border border-line bg-white px-3.5 py-2.5 text-xs font-bold text-ink">
            <span className="ic text-base text-brand-600">place</span>
            <span>
              Région de {region}
              <span className="mt-0.5 block text-[10.5px] font-semibold text-faint">
                Vous consultez uniquement les boîtiers de votre région.
              </span>
            </span>
          </span>
          <button
            type="button"
            onClick={() => setLastRefresh(formatNow())}
            className="flex items-center gap-2 whitespace-nowrap rounded-full border border-line bg-white px-3.5 py-2.5 text-left text-xs font-bold text-ink transition-colors hover:bg-page"
          >
            <span>
              Dernière actualisation :
              <span className="block text-[10.5px] font-semibold text-faint">{lastRefresh}</span>
            </span>
            <span className="ic text-base text-brand-600">refresh</span>
          </button>
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

      <section className="mx-6 mt-4.5 grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.7fr_1fr]">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-line bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line-soft px-5 py-4">
            <p className="m-0 text-sm font-extrabold text-ink">Localisation des boîtiers IoT</p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={connexion}
                onChange={(e) => {
                  setConnexion(e.target.value as 'tous' | EtatConnexion)
                  setPage(1)
                }}
                className="rounded-[9px] border-[1.5px] border-line bg-white px-2.5 py-1.5 text-[12px] font-semibold text-ink outline-none"
              >
                <option value="tous">Tous les états</option>
                {(Object.keys(CONNEXION_META) as EtatConnexion[]).map((c) => (
                  <option key={c} value={c}>
                    {CONNEXION_META[c].label}
                  </option>
                ))}
              </select>
              <select
                value={localite}
                onChange={(e) => {
                  setLocalite(e.target.value)
                  setPage(1)
                }}
                className="rounded-[9px] border-[1.5px] border-line bg-white px-2.5 py-1.5 text-[12px] font-semibold text-ink outline-none"
              >
                <option value="tous">Toutes les localités</option>
                {localites.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="relative h-[360px] w-full">
            <MapContainer center={center} zoom={12} className="h-full w-full" scrollWheelZoom={false}>
              <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {filtered.map((b) => {
                const meta = CONNEXION_META[b.connexion]
                const [lat, lng] = offsetLatLng(center, b.offset)
                /* Les points verts (en ligne, sans anomalie) clignotent pour signaler une activité en direct — voir le <style> de clignotement plus bas. */
                const isOnlineHealthy = b.connexion === 'en_ligne' && b.technique !== 'anomalie'
                return (
                  <CircleMarker
                    key={b.id}
                    center={[lat, lng]}
                    radius={9}
                    pathOptions={{
                      color: '#fff',
                      weight: 2,
                      fillColor: b.technique === 'anomalie' ? '#e8940c' : meta.color,
                      fillOpacity: 0.92,
                      className: isOnlineHealthy ? 'boitier-marker-pulse' : undefined,
                    }}
                  >
                    <Popup>
                      <div className="w-[190px]">
                        <p className="m-0 flex items-center gap-1.5 text-[13px] font-extrabold text-ink">
                          {b.id}
                          <span
                            className="inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                            style={{ background: meta.soft, color: meta.text }}
                          >
                            {meta.label}
                          </span>
                        </p>
                        <p className="m-0 mt-1 text-[11.5px] text-body">{b.localite}</p>
                        <p className="m-0 mt-1 text-[10.5px] text-faint">
                          {b.lieu} ({formatCoords(lat, lng)})
                        </p>
                        <p className="m-0 mt-1 text-[10.5px] text-faint">Dernière communication : {b.derniereCommunication}</p>
                        <button
                          type="button"
                          onClick={() => setDetailBoitier(b)}
                          className="mt-2 w-full rounded-lg bg-navy-900 px-2.5 py-1.5 text-[11px] font-bold text-white"
                        >
                          Voir les détails →
                        </button>
                      </div>
                    </Popup>
                  </CircleMarker>
                )
              })}
            </MapContainer>
            <div className="pointer-events-none absolute bottom-2 left-2 z-[1000] flex flex-wrap gap-x-2.5 gap-y-1 rounded-[10px] border border-line bg-white/95 px-2.5 py-2 text-[10px] font-semibold text-body shadow-card">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: CONNEXION_META.en_ligne.color }} />
                En ligne
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: CONNEXION_META.hors_ligne.color }} />
                Hors ligne
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: '#e8940c' }} />
                En anomalie
              </span>
            </div>
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-card">
          <div className="mb-3.5 flex items-center justify-between gap-2">
            <p className="m-0 flex items-center gap-1.5 text-sm font-extrabold text-ink">
              <span className="ic text-base text-danger-600">warning</span>
              Alertes de supervision technique
            </p>
            <button type="button" onClick={scrollToList} className="whitespace-nowrap text-xs font-bold text-brand-600">
              Voir tout →
            </button>
          </div>
          <ul className="flex flex-col gap-2.5">
            {alerts.map((a) => (
              <li key={a.key}>
                <button
                  type="button"
                  onClick={a.onClick}
                  className="flex w-full items-start gap-3 rounded-xl border border-line-soft p-3 text-left transition-colors hover:border-brand-200 hover:bg-page"
                >
                  <span
                    className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-sm font-extrabold"
                    style={{ background: a.soft, color: a.tint }}
                  >
                    {a.count}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[12.5px] font-bold text-ink">{a.label}</p>
                    <p className="m-0 mt-0.5 text-[11px] text-faint">{a.sub}</p>
                  </div>
                  <span className="flex-none whitespace-nowrap self-center text-[11px] font-bold text-brand-600">
                    {a.actionLabel}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section ref={listRef} className="mx-6 mt-4.5 scroll-mt-4 rounded-2xl border border-line bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line-soft px-5 py-4">
          <p className="m-0 text-sm font-extrabold text-ink">Liste des boîtiers ({filtered.length})</p>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-[10px] border-[1.5px] border-line bg-white px-3.5 py-2 text-[12.5px] font-bold text-ink transition-colors hover:bg-page"
          >
            <span className="ic text-base">download</span>
            Exporter
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 border-b border-line-soft px-5 py-3.5">
          <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-[10px] border-[1.5px] border-line-field bg-field px-3.5 py-2.5">
            <span className="ic text-lg text-faint">search</span>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Rechercher un boîtier…"
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none placeholder:text-faint"
            />
          </div>
          <select
            value={localite}
            onChange={(e) => {
              setLocalite(e.target.value)
              setPage(1)
            }}
            className="rounded-[9px] border-[1.5px] border-line bg-white px-2.5 py-2 text-[12.5px] font-semibold text-ink outline-none"
          >
            <option value="tous">Toutes les localités</option>
            {localites.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <select
            value={connexion}
            onChange={(e) => {
              setConnexion(e.target.value as 'tous' | EtatConnexion)
              setPage(1)
            }}
            className="rounded-[9px] border-[1.5px] border-line bg-white px-2.5 py-2 text-[12.5px] font-semibold text-ink outline-none"
          >
            <option value="tous">Tous les états de connexion</option>
            {(Object.keys(CONNEXION_META) as EtatConnexion[]).map((c) => (
              <option key={c} value={c}>
                {CONNEXION_META[c].label}
              </option>
            ))}
          </select>
          <select
            value={technique}
            onChange={(e) => {
              setTechnique(e.target.value as 'tous' | EtatTechnique)
              setPage(1)
            }}
            className="rounded-[9px] border-[1.5px] border-line bg-white px-2.5 py-2 text-[12.5px] font-semibold text-ink outline-none"
          >
            <option value="tous">Tous les états techniques</option>
            {(Object.keys(TECHNIQUE_META) as EtatTechnique[]).map((t) => (
              <option key={t} value={t}>
                {TECHNIQUE_META[t].label}
              </option>
            ))}
          </select>
          <select
            value={tri}
            onChange={(e) => setTri(e.target.value as Tri)}
            className="rounded-[9px] border-[1.5px] border-line bg-white px-2.5 py-2 text-[12.5px] font-semibold text-ink outline-none"
          >
            <option value="recent">Dernière communication (récent)</option>
            <option value="ancien">Dernière communication (ancien)</option>
          </select>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-[10px] border-[1.5px] border-line px-3.5 py-2 text-[12.5px] font-bold text-body transition-colors hover:bg-page"
          >
            <span className="ic text-base">refresh</span>
            Réinitialiser
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-left text-[12.5px]">
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
                <th className="px-3 py-3">Boîtier / Véhicule</th>
                <th className="px-3 py-3">Localisation</th>
                <th className="px-3 py-3">Connexion</th>
                <th className="px-3 py-3">État technique</th>
                <th className="px-3 py-3">Dernière communication</th>
                <th className="px-3 py-3">Batterie</th>
                <th className="px-3 py-3">Réseau</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((b) => {
                const cMeta = CONNEXION_META[b.connexion]
                const tMeta = TECHNIQUE_META[b.technique]
                const batt = batterieMeta(b.batterie)
                const [lat, lng] = offsetLatLng(center, b.offset)
                return (
                  <tr key={b.id} className="border-b border-line-soft last:border-0 hover:bg-page">
                    <td className="px-5 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(b.id)}
                        onChange={() => toggleSelected(b.id)}
                        className="h-4 w-4 rounded border-line-field accent-brand-600"
                        aria-label={`Sélectionner ${b.id}`}
                      />
                    </td>
                    <td className="px-3 py-3 font-bold text-ink">{b.id}</td>
                    <td className="px-3 py-3 text-body">{b.vehicule}</td>
                    <td className="px-3 py-3 text-body">
                      <p className="m-0 flex items-center gap-1 font-semibold text-ink">
                        <span className="ic text-sm text-faint">place</span>
                        {b.localite}
                      </p>
                      <p className="m-0 text-[11px] text-faint">
                        {b.lieu} ({formatCoords(lat, lng)})
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-md px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: cMeta.soft, color: cMeta.text }}>
                        {cMeta.label}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-md px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: tMeta.soft, color: tMeta.text }}>
                        {tMeta.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-body">{b.derniereCommunication}</td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-1 font-semibold" style={{ color: batt.color }}>
                        <span className="ic text-base">{batt.icon}</span>
                        {b.batterie}%
                      </span>
                    </td>
                    <td className="px-3 py-3 text-body">
                      <span className="flex items-center gap-1.5">
                        <span className="ic text-base text-faint">{RESEAU_ICON[b.reseau]}</span>
                        {b.reseau}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDetailBoitier(b)}
                          className="whitespace-nowrap rounded-lg border-[1.5px] border-line px-3 py-1.5 text-[11px] font-bold text-ink hover:bg-page"
                        >
                          Voir les détails
                        </button>
                        {/* TODO : menu d'actions (redémarrer, désactiver…) — pas encore construit. */}
                        <button
                          type="button"
                          aria-label="Plus d'actions"
                          className="ic flex h-7 w-7 flex-none items-center justify-center rounded-lg text-base text-faint hover:bg-page"
                        >
                          more_vert
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-8 text-center text-[12.5px] text-faint">
                    Aucun boîtier ne correspond à ces filtres.
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
              {filtered.length} boîtiers
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
      </section>

      {detailBoitier && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDetailBoitier(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const b = detailBoitier
              const cMeta = CONNEXION_META[b.connexion]
              const tMeta = TECHNIQUE_META[b.technique]
              const batt = batterieMeta(b.batterie)
              const [lat, lng] = offsetLatLng(center, b.offset)
              return (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-navy-900 text-white">
                        <span className="ic text-2xl">memory</span>
                      </span>
                      <div>
                        <p className="m-0 text-lg font-extrabold leading-tight text-ink">{b.id}</p>
                        <p className="m-0 mt-0.5 text-[12.5px] text-faint">{b.vehicule}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetailBoitier(null)}
                      aria-label="Fermer"
                      className="ic flex h-8 w-8 flex-none items-center justify-center rounded-lg text-xl text-faint hover:bg-page hover:text-ink"
                    >
                      close
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-md px-2 py-1 text-[11px] font-bold" style={{ background: cMeta.soft, color: cMeta.text }}>
                      {cMeta.label}
                    </span>
                    <span className="rounded-md px-2 py-1 text-[11px] font-bold" style={{ background: tMeta.soft, color: tMeta.text }}>
                      {tMeta.label}
                    </span>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3.5 text-[12.5px]">
                    <div className="col-span-2">
                      <dt className="font-semibold text-faint">Localisation</dt>
                      <dd className="m-0 mt-0.5 flex items-center gap-1 font-semibold text-ink">
                        <span className="ic text-sm text-faint">place</span>
                        {b.localite}
                      </dd>
                      <dd className="m-0 text-[11px] text-faint">
                        {b.lieu} ({formatCoords(lat, lng)})
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-faint">Batterie</dt>
                      <dd className="m-0 mt-0.5 flex items-center gap-1 font-bold" style={{ color: batt.color }}>
                        <span className="ic text-base">{batt.icon}</span>
                        {b.batterie}%
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-faint">Réseau</dt>
                      <dd className="m-0 mt-0.5 flex items-center gap-1 font-semibold text-ink">
                        <span className="ic text-base text-faint">{RESEAU_ICON[b.reseau]}</span>
                        {b.reseau}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-faint">Dernière communication</dt>
                      <dd className="m-0 mt-0.5 font-semibold text-ink">{b.derniereCommunication}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-faint">Dernière donnée reçue</dt>
                      <dd className="m-0 mt-0.5 font-semibold text-ink">{b.derniereDonnee}</dd>
                    </div>
                  </dl>

                  {/* TODO backend : historique d'événements du boîtier + actions de supervision (redémarrage à distance, désactivation…). */}
                  <p className="m-0 mt-4 rounded-xl bg-page px-3.5 py-3 text-[11px] leading-relaxed text-faint">
                    L'historique détaillé des événements et les actions de supervision à distance (redémarrage,
                    désactivation…) arriveront avec le branchement au vrai backend.
                  </p>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
