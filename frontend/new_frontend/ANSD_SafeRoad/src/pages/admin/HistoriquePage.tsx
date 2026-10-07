import { useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  DEVICE_HISTORY,
  HISTORY_WEEK_STATS,
  REGIONAL_TRIPS,
  type DeviceEventType,
  type DeviceHistoryEntry,
  type RegionalTrip,
} from '@/data/adminHistorique'
import { ADMIN_REGION_ZONES, INCIDENT_BREAKDOWN, INCIDENT_TOTAL } from '@/data/adminHome'
import { TAUX_RECURRENCE_7J } from '@/data/adminZones'
import { exportTableToPdf } from '@/lib/exportPdf'
import { daysSince, latestDate } from '@/lib/period'
import { regionLabel, regionPlatePrefix } from '@/lib/regions'

/** "2145-AB" (suffixe stocké en donnée) -> "DL-2145-AB" (plaque complète de la région connectée). */
function formatPlate(prefix: string, suffix?: string): string {
  return suffix ? `${prefix}-${suffix}` : '—'
}

type MetricKey = 'trajets' | 'distanceKm' | 'boitiersActifs' | 'disponibilite'
type TableTab = 'trajets' | 'boitiers'
type Periode = '7' | '30' | '12m'

const PERIODE_LABELS: Record<Periode, string> = {
  '7': '7 derniers jours',
  '30': '30 derniers jours',
  '12m': '12 derniers mois',
}

/** Un trajet/événement boîtier tombe dans la période si sa date est à `reference` moins N jours (ou moins). */
function matchesPeriode(date: string, periode: Periode, reference: Date): boolean {
  const diff = daysSince(reference, date)
  if (periode === '7') return diff >= 0 && diff <= 6
  if (periode === '30') return diff >= 0 && diff <= 29
  return diff >= 0 && diff <= 365 // 12m
}

const METRICS: { key: MetricKey; label: string; color: string; unit: string }[] = [
  { key: 'trajets', label: 'Trajets', color: '#2b6cb0', unit: '' },
  { key: 'distanceKm', label: 'Distance', color: '#0F766E', unit: ' km' },
  { key: 'boitiersActifs', label: 'Boîtiers actifs', color: '#7c3aed', unit: '' },
  { key: 'disponibilite', label: 'Disponibilité', color: '#e8940c', unit: '%' },
]

const EVENT_META: Record<DeviceEventType, { label: string; icon: string; fg: string; bg: string }> = {
  connexion: { label: 'Connexion', icon: 'wifi', fg: '#1f9d55', bg: '#e9f6ee' },
  deconnexion: { label: 'Déconnexion', icon: 'wifi_off', fg: '#dc3a2f', bg: '#fdeeec' },
  maintenance: { label: 'Maintenance', icon: 'build', fg: '#2b6cb0', bg: '#e8f0f9' },
}

function alertBadge(count: number): { label: string; fg: string; bg: string } {
  if (count === 0) return { label: 'Aucune', fg: '#1f9d55', bg: '#e9f6ee' }
  if (count <= 2) return { label: `${count} alerte${count > 1 ? 's' : ''}`, fg: '#e8940c', bg: '#fdf4e6' }
  return { label: `${count} alertes`, fg: '#dc3a2f', bg: '#fdeeec' }
}

function scoreBadge(score: number): { tint: string; bg: string; icon: string } {
  if (score >= 90) return { tint: '#1f9d55', bg: '#e9f6ee', icon: 'verified' }
  if (score >= 80) return { tint: '#e8940c', bg: '#fdf4e6', icon: 'shield' }
  return { tint: '#dc3a2f', bg: '#fdeeec', icon: 'warning' }
}

function HistoryBarChart({ metric }: { metric: MetricKey }) {
  const max = useMemo(() => Math.max(...HISTORY_WEEK_STATS.map((d) => d[metric]), 1), [metric])
  const color = METRICS.find((m) => m.key === metric)!.color

  return (
    <div className="flex h-[150px] items-end gap-2.5">
      {HISTORY_WEEK_STATS.map((d) => (
        <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <div className="flex h-[112px] w-full items-end">
            <div
              className="w-full rounded-t-[5px] transition-all"
              style={{ height: `${(d[metric] / max) * 100}%`, backgroundColor: color, minHeight: 4 }}
              title={`${d.date} : ${d[metric]}`}
            />
          </div>
          <span className="text-[10px] font-semibold text-faint">{d.date}</span>
        </div>
      ))}
    </div>
  )
}

/** Répartition des incidents par type — même principe visuel que le donut du Dashboard. */
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

function TripRow({ trip, platePrefix }: { trip: RegionalTrip; platePrefix: string }) {
  const alert = alertBadge(trip.alerts)
  const score = scoreBadge(trip.score)
  return (
    <div className="flex flex-wrap items-start gap-4 border-b border-page px-5 py-4 last:border-b-0 sm:items-center sm:flex-nowrap">
      <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-xl bg-info-50 text-info-600">
        <span className="ic text-[22px]">route</span>
      </span>

      <div className="min-w-0 flex-1 basis-[190px]">
        <p className="m-0 text-sm font-extrabold leading-tight text-ink">{trip.route}</p>
        <p className="m-0 mt-1.5 text-[11.5px] font-medium text-muted">
          {formatPlate(platePrefix, trip.vehicle)} · {trip.driver}
        </p>
      </div>

      <span className="flex-none whitespace-nowrap text-[11px] font-semibold text-faint sm:min-w-[110px]">
        {trip.date} · {trip.duration}
      </span>

      <span className="flex-none whitespace-nowrap font-mono text-[13px] font-bold text-ink sm:min-w-[64px]">
        {trip.km} km
      </span>

      <span
        className="flex-none whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-bold"
        style={{ color: alert.fg, background: alert.bg }}
      >
        {alert.label}
      </span>

      <span
        className="flex flex-none items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-[12.5px] font-extrabold"
        style={{ color: score.tint, background: score.bg }}
      >
        <span className="ic text-[15px]">{score.icon}</span>
        {trip.score}/100
      </span>
    </div>
  )
}

function DeviceRow({ entry, platePrefix }: { entry: DeviceHistoryEntry; platePrefix: string }) {
  const meta = EVENT_META[entry.event]
  return (
    <div className="flex flex-wrap items-start gap-4 border-b border-page px-5 py-4 last:border-b-0 sm:items-center sm:flex-nowrap">
      <span
        className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-xl"
        style={{ background: meta.bg, color: meta.fg }}
      >
        <span className="ic text-[22px]">{meta.icon}</span>
      </span>

      <div className="min-w-0 flex-1 basis-[190px]">
        <p className="m-0 text-sm font-extrabold leading-tight text-ink">Boîtier {entry.deviceId}</p>
        <p className="m-0 mt-1.5 text-[11.5px] font-medium text-muted">{entry.detail}</p>
      </div>

      <span className="flex-none whitespace-nowrap font-mono text-[12px] font-bold text-body sm:min-w-[90px]">
        {formatPlate(platePrefix, entry.vehicle)}
      </span>

      <span
        className="flex-none whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-bold"
        style={{ color: meta.fg, background: meta.bg }}
      >
        {meta.label}
      </span>

      <span className="flex-none whitespace-nowrap text-[11.5px] font-semibold text-faint">
        {entry.date} · {entry.time}
      </span>
    </div>
  )
}

export function HistoriquePage() {
  const { user } = useAuth()
  const region = regionLabel(user?.region)
  const platePrefix = useMemo(() => regionPlatePrefix(user?.region), [user?.region])
  const [tab, setTab] = useState<TableTab>('trajets')
  const [metric, setMetric] = useState<MetricKey>('trajets')

  /* Date de référence pour le filtre Période = le jour le plus récent du jeu de données (voir src/lib/period.ts). */
  const reference = useMemo(
    () => latestDate([...REGIONAL_TRIPS.map((t) => t.date), ...DEVICE_HISTORY.map((d) => d.date)]),
    [],
  )
  const [periode, setPeriode] = useState<Periode>('7')

  const tripsFiltered = useMemo(
    () => REGIONAL_TRIPS.filter((t) => matchesPeriode(t.date, periode, reference)),
    [periode, reference],
  )
  const devicesFiltered = useMemo(
    () => DEVICE_HISTORY.filter((d) => matchesPeriode(d.date, periode, reference)),
    [periode, reference],
  )

  const kpis = useMemo(() => {
    const count = tripsFiltered.length
    const totalKm = tripsFiltered.reduce((sum, t) => sum + t.km, 0)
    const avgScore = count > 0 ? Math.round(tripsFiltered.reduce((sum, t) => sum + t.score, 0) / count) : 0
    const activeDevices = HISTORY_WEEK_STATS[HISTORY_WEEK_STATS.length - 1].boitiersActifs
    const avgAvailability = Math.round(
      HISTORY_WEEK_STATS.reduce((sum, d) => sum + d.disponibilite, 0) / HISTORY_WEEK_STATS.length,
    )
    return [
      { value: String(count), label: 'Trajets effectués', tint: '#2b6cb0' },
      { value: `${totalKm} km`, label: 'Distance totale', tint: '#0F766E' },
      { value: `${avgScore}/100`, label: 'Score moyen', tint: scoreBadge(avgScore).tint },
      { value: String(activeDevices), label: 'Boîtiers actifs', tint: '#7c3aed' },
      { value: `${avgAvailability}%`, label: 'Disponibilité moyenne', tint: '#e8940c' },
    ]
  }, [tripsFiltered])

  /**
   * Section « Statistiques » — reprend ce que la page /admin/statistiques
   * (retirée) aurait montré : vue d'ensemble sécurité routière de la région,
   * à partir des données déjà utilisées ailleurs dans l'app (zones, incidents).
   */
  const statsKpis = useMemo(() => {
    const zonesCritiques = ADMIN_REGION_ZONES.filter((z) => z.level === 'critique').length
    return [
      { icon: 'report', tint: '#dc3a2f', soft: '#fdeeec', value: String(INCIDENT_TOTAL), label: 'Incidents (mois)' },
      { icon: 'warning', tint: '#dc3a2f', soft: '#fdeeec', value: String(zonesCritiques), label: 'Zones critiques' },
      {
        icon: 'crisis_alert',
        tint: '#7c3aed',
        soft: '#f1eafe',
        value: String(ADMIN_REGION_ZONES.length),
        label: 'Zones à risque actives',
      },
      {
        icon: 'insights',
        tint: '#7c3aed',
        soft: '#f1eafe',
        value: `${TAUX_RECURRENCE_7J.valeur}%`,
        label: 'Taux de récurrence (7j)',
      },
    ]
  }, [])

  const handleExport = () => {
    const periodeLabel = PERIODE_LABELS[periode]
    if (tab === 'trajets') {
      exportTableToPdf({
        title: 'Historique — Trajets véhicules',
        subtitle: `Région de ${region} · ${periodeLabel} · ${tripsFiltered.length} trajet${tripsFiltered.length > 1 ? 's' : ''}`,
        columns: [
          { header: 'Véhicule', key: 'vehicle' },
          { header: 'Conducteur', key: 'driver' },
          { header: 'Trajet', key: 'route' },
          { header: 'Date', key: 'date' },
          { header: 'Durée', key: 'duration' },
          { header: 'Distance', key: 'km' },
          { header: 'Alertes', key: 'alerts' },
          { header: 'Score', key: 'score' },
        ],
        rows: tripsFiltered.map((t) => ({
          vehicle: formatPlate(platePrefix, t.vehicle),
          driver: t.driver,
          route: t.route,
          date: t.date,
          duration: t.duration,
          km: `${t.km} km`,
          alerts: t.alerts,
          score: `${t.score}/100`,
        })),
        filename: `historique-trajets-${region.toLowerCase()}.pdf`,
      })
    } else {
      exportTableToPdf({
        title: 'Historique — Appareils connectés',
        subtitle: `Région de ${region} · ${periodeLabel} · ${devicesFiltered.length} événement${devicesFiltered.length > 1 ? 's' : ''}`,
        columns: [
          { header: 'Boîtier', key: 'deviceId' },
          { header: 'Véhicule', key: 'vehicle' },
          { header: 'Événement', key: 'event' },
          { header: 'Date', key: 'date' },
          { header: 'Heure', key: 'time' },
          { header: 'Détail', key: 'detail' },
        ],
        rows: devicesFiltered.map((d) => ({
          deviceId: d.deviceId,
          vehicle: formatPlate(platePrefix, d.vehicle),
          event: EVENT_META[d.event].label,
          date: d.date,
          time: d.time,
          detail: d.detail,
        })),
        filename: `historique-boitiers-${region.toLowerCase()}.pdf`,
      })
    }
  }

  return (
    <div>
      <section className="mx-6 mt-5 flex flex-wrap items-end justify-between gap-3.5">
        <div className="min-w-0">
          <h1 className="text-[clamp(23px,2.8vw,30px)] font-extrabold leading-[1.15] tracking-[-0.026em] text-ink">
            Historique
          </h1>
          <p className="mt-2.5 text-sm leading-6 text-body">
            Trajets des véhicules connectés et activité des boîtiers de {region}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <select
            value={periode}
            onChange={(e) => setPeriode(e.target.value as Periode)}
            className="min-h-[44px] rounded-[10px] border-[1.5px] border-line bg-white px-4 text-[13px] font-medium text-ink outline-none"
          >
            <option value="7">7 derniers jours</option>
            <option value="30">30 derniers jours</option>
            <option value="12m">12 derniers mois</option>
          </select>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-[10px] border-[1.5px] border-line bg-white px-[18px] text-[13px] font-bold text-ink transition-colors hover:bg-page"
          >
            <span className="ic text-lg">download</span>
            Exporter
          </button>
        </div>
      </section>

      <section className="mx-6 mt-4.5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-card">
            <p
              className="m-0 font-mono text-[26px] font-extrabold leading-none tracking-tight"
              style={{ color: kpi.tint }}
            >
              {kpi.value}
            </p>
            <p className="m-0 mt-2.5 text-[12.5px] font-semibold text-body">{kpi.label}</p>
          </div>
        ))}
      </section>

      <section className="mx-6 mt-4.5 rounded-2xl border border-line bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
          <div>
            <p className="m-0 text-sm font-extrabold text-ink">Statistiques</p>
            <p className="m-0 mt-0.5 text-[11.5px] text-faint">Vue d'ensemble sécurité routière de {region}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 xl:grid-cols-[repeat(4,1fr)_1.3fr]">
          {statsKpis.map((kpi) => (
            <div key={kpi.label} className="flex items-center gap-3.5 rounded-xl border border-line-soft p-4">
              <span
                className="flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-full"
                style={{ background: kpi.soft, color: kpi.tint }}
              >
                <span className="ic text-2xl">{kpi.icon}</span>
              </span>
              <div className="min-w-0">
                <p className="m-0 text-xl font-extrabold leading-none tracking-tight text-ink">{kpi.value}</p>
                <p className="m-0 mt-1.5 text-[11.5px] font-semibold text-body">{kpi.label}</p>
              </div>
            </div>
          ))}
          <div className="rounded-xl border border-line-soft p-4">
            <p className="m-0 mb-3 text-[11.5px] font-bold text-ink">Répartition des incidents</p>
            <IncidentDonut />
          </div>
        </div>
      </section>

      <section className="mx-6 mt-4.5 rounded-2xl border border-line bg-white p-5 shadow-card">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
          <p className="m-0 text-sm font-extrabold text-ink">Évolution — 7 derniers jours</p>
          <span className="text-[11px] font-semibold text-faint">Survolez une barre pour le détail</span>
        </div>
        <div className="mb-4 flex flex-wrap gap-1.5 rounded-full bg-page p-1">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              className={`flex-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                metric === m.key ? 'bg-white text-ink shadow-card' : 'text-faint'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <HistoryBarChart metric={metric} />
      </section>

      <section className="mx-6 mt-4.5 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => setTab('trajets')}
          className={`whitespace-nowrap rounded-full border-[1.5px] px-5 py-3 text-[12.5px] font-bold transition-colors ${
            tab === 'trajets'
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'border-line bg-white text-body hover:border-brand-200'
          }`}
        >
          Trajets véhicules ({tripsFiltered.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('boitiers')}
          className={`whitespace-nowrap rounded-full border-[1.5px] px-5 py-3 text-[12.5px] font-bold transition-colors ${
            tab === 'boitiers'
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'border-line bg-white text-body hover:border-brand-200'
          }`}
        >
          Appareils connectés ({devicesFiltered.length})
        </button>
      </section>

      <section className="mx-6 mb-6 mt-4 overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        <div className="flex flex-col">
          {tab === 'trajets' ? (
            tripsFiltered.length > 0 ? (
              tripsFiltered.map((trip) => <TripRow key={trip.id} trip={trip} platePrefix={platePrefix} />)
            ) : (
              <p className="m-0 px-5 py-8 text-center text-[12.5px] text-faint">Aucun trajet sur cette période.</p>
            )
          ) : devicesFiltered.length > 0 ? (
            devicesFiltered.map((entry) => <DeviceRow key={entry.id} entry={entry} platePrefix={platePrefix} />)
          ) : (
            <p className="m-0 px-5 py-8 text-center text-[12.5px] text-faint">Aucun événement boîtier sur cette période.</p>
          )}
        </div>
      </section>
    </div>
  )
}
