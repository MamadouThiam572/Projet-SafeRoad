import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import { Link } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import { useAuth } from '@/context/AuthContext'
import {
  ADMIN_EVENTS,
  ADMIN_KPIS,
  ADMIN_REGION_ZONES,
  INCIDENT_BREAKDOWN,
  INCIDENT_TOTAL,
  PENDING_ZONES,
  TOP_LOCALITIES,
  WEEK_STATS,
  type RiskLevel,
} from '@/data/adminHome'
import { offsetLatLng, regionCenter, regionLabel } from '@/lib/regions'
import { PATHS } from '@/routes/paths'

const LEVEL_META: Record<RiskLevel, { label: string; color: string; soft: string; text: string }> = {
  critique: { label: 'Critique', color: '#dc3a2f', soft: '#fdeeec', text: '#dc3a2f' },
  vigilance: { label: 'Vigilance', color: '#e8940c', soft: '#fdf4e6', text: '#e8940c' },
  normale: { label: 'Normal', color: '#1f9d55', soft: '#e9f6ee', text: '#1f9d55' },
}

const TREND_ICON: Record<'up' | 'down' | 'flat', string> = {
  up: 'trending_up',
  down: 'trending_down',
  flat: 'trending_flat',
}

function firstName(fullName: string): string {
  return fullName.split(' ')[0]
}

function StatsBarChart({ metric }: { metric: 'incidents' | 'alertes' | 'zones' }) {
  const max = useMemo(() => Math.max(...WEEK_STATS.map((d) => d[metric]), 1), [metric])
  const color = metric === 'incidents' ? '#2b6cb0' : metric === 'alertes' ? '#e8940c' : '#7c3aed'

  return (
    <div className="flex h-[140px] items-end gap-2.5">
      {WEEK_STATS.map((d) => (
        <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <div className="flex h-[104px] w-full items-end">
            <div
              className="w-full rounded-t-[5px] transition-all"
              style={{ height: `${(d[metric] / max) * 100}%`, backgroundColor: color, minHeight: 4 }}
            />
          </div>
          <span className="text-[10px] font-semibold text-faint">{d.date}</span>
        </div>
      ))}
    </div>
  )
}

function IncidentDonut() {
  let cursor = 0
  const stops = INCIDENT_BREAKDOWN.map((seg) => {
    const from = cursor
    cursor += seg.pct
    return `${seg.color} ${from}% ${cursor}%`
  }).join(', ')

  return (
    <div className="flex items-center gap-5">
      <div
        className="relative h-[120px] w-[120px] flex-none rounded-full"
        style={{ background: `conic-gradient(${stops})` }}
      >
        <div className="absolute inset-[14px] flex flex-col items-center justify-center rounded-full bg-white">
          <p className="m-0 text-2xl font-extrabold leading-none text-ink">{INCIDENT_TOTAL}</p>
          <p className="m-0 mt-1 text-[10px] font-semibold text-faint">incidents</p>
        </div>
      </div>
      <ul className="flex min-w-0 flex-1 flex-col gap-2">
        {INCIDENT_BREAKDOWN.map((seg) => (
          <li key={seg.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="min-w-0 flex-1 truncate font-semibold text-body">{seg.label}</span>
            <span className="flex-none font-bold text-ink">{seg.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function DashboardPage() {
  const { user } = useAuth()
  const region = regionLabel(user?.region)
  const center = useMemo(() => regionCenter(user?.region), [user?.region])
  const [clock, setClock] = useState(() => new Date())
  const [metric, setMetric] = useState<'incidents' | 'alertes' | 'zones'>('incidents')

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  const today = useMemo(() => {
    const label = clock.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    return label.charAt(0).toUpperCase() + label.slice(1)
  }, [clock])

  const timeLabel = useMemo(() => clock.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), [clock])

  return (
    <div>
      <section className="relative mx-6 mt-3.5 flex min-h-[128px] items-center overflow-hidden rounded-2xl bg-navy-900">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(96deg, rgba(6,35,52,.96) 0%, rgba(6,35,52,.86) 45%, rgba(6,35,52,.7) 100%)',
          }}
        />
        <div className="relative grid w-full grid-cols-1 gap-5 p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <h1 className="text-[clamp(22px,3vw,28px)] font-extrabold leading-[1.15] tracking-[-0.026em] text-white">
              Bonjour {user ? firstName(user.firstName) : 'Administrateur'} 👋
            </h1>
            <p className="mt-2.5 text-sm leading-relaxed text-[rgba(234,244,248,0.86)]">
              Voici un aperçu de la situation dans votre région de {region}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <div className="flex items-center gap-2.5 rounded-full bg-[rgba(255,255,255,0.94)] px-4 py-2.5">
              <span className="ic text-lg text-brand-600">calendar_month</span>
              <div className="text-left">
                <p className="m-0 text-[11.5px] font-bold leading-tight text-ink">{today}</p>
                <p className="m-0 text-[11px] font-semibold leading-tight text-muted">{timeLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-[rgba(255,255,255,0.94)] px-4 py-2.5 text-[13px] font-bold text-ink">
              <span className="ic text-lg text-brand-600">place</span>
              Région
              <span className="text-muted">·</span>
              {region}
              <span className="ic text-lg text-muted">expand_more</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-6 mt-4.5 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {ADMIN_KPIS.map((kpi) => (
          <Link
            key={kpi.label}
            to={kpi.to}
            className="min-w-0 rounded-2xl border border-line bg-white p-4.5 shadow-card transition-shadow hover:shadow-card-hover"
          >
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
            <div className="mt-3.5 flex items-center justify-between text-[11px] font-semibold">
              <span className="flex items-center gap-1 text-faint">
                <span className="ic text-sm">{TREND_ICON[kpi.trendIcon]}</span>
                {kpi.trend}
              </span>
              <span className="font-bold text-brand-600">{kpi.cta} →</span>
            </div>
          </Link>
        ))}
      </section>

      <section className="mx-6 mt-4.5 grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.6fr_1fr_1fr]">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-line bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
            <p className="m-0 text-sm font-extrabold text-ink">
              Carte de votre région — {region}{' '}
              <span className="ml-1 inline-flex items-center gap-1 text-[11px] font-bold text-brand-600">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-600" /> En temps réel
              </span>
            </p>
          </div>
          <div className="relative h-[360px] w-full">
            <MapContainer center={center} zoom={11} className="h-full w-full" scrollWheelZoom={false}>
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {ADMIN_REGION_ZONES.map((zone) => {
                const meta = LEVEL_META[zone.level]
                return (
                  <CircleMarker
                    key={zone.id}
                    center={offsetLatLng(center, zone.offset)}
                    radius={8 + Math.min(zone.incidents / 3, 10)}
                    pathOptions={{ color: '#fff', weight: 2, fillColor: meta.color, fillOpacity: 0.9 }}
                  >
                    <Popup>
                      <div className="w-[190px]">
                        <p className="m-0 text-[13.5px] font-extrabold text-ink">{zone.name}</p>
                        <p
                          className="m-0 mt-1 inline-block rounded-md px-2 py-1 text-[10.5px] font-bold"
                          style={{ background: meta.soft, color: meta.text }}
                        >
                          Zone {meta.label.toLowerCase()}
                        </p>
                        <p className="m-0 mt-1.5 text-[11.5px] text-body">
                          {zone.incidents} incidents · {zone.avgSpeed} km/h (moy.)
                        </p>
                        <p className="m-0 mt-1 text-[11px] text-faint">Dernière détection : {zone.lastDetection}</p>
                      </div>
                    </Popup>
                  </CircleMarker>
                )
              })}
            </MapContainer>

            <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] rounded-[10px] border border-line bg-white/95 px-3 py-2.5 text-[11px] font-semibold text-body shadow-card">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-danger-600" /> Zone critique
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-warning-600" /> Zone de vigilance
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-success-600" /> Zone normale
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-card">
          <div className="mb-3.5 flex items-center justify-between">
            <p className="m-0 text-sm font-extrabold text-ink">Événements récents</p>
            <Link to={PATHS.admin.historique} className="text-xs font-bold text-brand-600">
              Voir tout →
            </Link>
          </div>
          <ul className="flex flex-col gap-3.5">
            {ADMIN_EVENTS.map((ev) => (
              <li key={ev.id} className="flex items-start gap-3">
                <span
                  className="flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded-full"
                  style={{ background: ev.soft, color: ev.tint }}
                >
                  <span className="ic text-lg">{ev.icon}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-[13px] font-bold text-ink">{ev.title}</p>
                  <p className="m-0 mt-0.5 text-[11.5px] text-body">{ev.location}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[11px] font-medium text-faint">{ev.ago}</span>
                    {ev.badge && (
                      <span
                        className="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                        style={{ background: ev.badge.soft, color: ev.badge.tint }}
                      >
                        {ev.badge.label}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-card">
          <div className="mb-3.5 flex items-center justify-between">
            <p className="m-0 text-sm font-extrabold text-ink">Zones à risque de votre région</p>
            <Link to={PATHS.admin.carte} className="text-xs font-bold text-brand-600">
              Voir toutes →
            </Link>
          </div>
          <ul className="flex flex-col gap-3">
            {ADMIN_REGION_ZONES.map((zone) => {
              const meta = LEVEL_META[zone.level]
              return (
                <li key={zone.id} className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: meta.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-[12.5px] font-bold text-ink">{zone.name}</p>
                    <p className="m-0 mt-0.5 text-[11px] text-faint">
                      {zone.incidents} incidents · {zone.avgSpeed} km/h
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
      </section>

      <section className="mx-6 my-4.5 grid grid-cols-1 items-start gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-card">
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
            <p className="m-0 text-sm font-extrabold text-ink">Statistiques rapides</p>
            <span className="text-[11px] font-semibold text-faint">7 derniers jours</span>
          </div>
          <div className="mb-4 flex gap-1.5 rounded-full bg-page p-1">
            {(['incidents', 'alertes', 'zones'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetric(m)}
                className={`flex-1 rounded-full px-2 py-1.5 text-[11px] font-bold capitalize transition-colors ${
                  metric === m ? 'bg-white text-ink shadow-card' : 'text-faint'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <StatsBarChart metric={metric} />
        </div>

        <div className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-card">
          <div className="mb-3.5 flex items-center justify-between">
            <p className="m-0 text-sm font-extrabold text-ink">Top localités à surveiller</p>
            <Link to={PATHS.admin.carte} className="text-xs font-bold text-brand-600">
              Voir plus →
            </Link>
          </div>
          <ul className="flex flex-col gap-3">
            {TOP_LOCALITIES.map((loc) => {
              const meta = LEVEL_META[loc.level]
              return (
                <li key={loc.id} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[12.5px] font-bold text-ink">{loc.name}</p>
                    <p className="m-0 mt-0.5 text-[11px] text-faint">
                      {loc.incidents} incident{loc.incidents > 1 ? 's' : ''} · {loc.alerts} alerte{loc.alerts > 1 ? 's' : ''}
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

        <div className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-card">
          <p className="m-0 mb-4 text-sm font-extrabold text-ink">Répartition des incidents</p>
          <IncidentDonut />
        </div>

        <div className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-card">
          <div className="mb-3.5 flex items-center justify-between">
            <p className="m-0 text-sm font-extrabold text-ink">Zones à valider</p>
            <Link to={PATHS.admin.zones} className="text-xs font-bold text-brand-600">
              Voir toutes →
            </Link>
          </div>
          <ul className="flex flex-col gap-3">
            {PENDING_ZONES.map((zone) => {
              const meta = LEVEL_META[zone.level]
              return (
                <li key={zone.id} className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: meta.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-[12.5px] font-bold text-ink">{zone.name}</p>
                    <p className="m-0 mt-0.5 truncate text-[10.5px] text-faint">{zone.detectedAt}</p>
                  </div>
                  <button
                    type="button"
                    className="flex-none rounded-full bg-brand-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-brand-700"
                  >
                    Valider
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </section>
    </div>
  )
}
