import { useMemo } from 'react'
import { CLIENT_TRIPS, type ClientTrip } from '@/data/clientTrips'

interface Kpi {
  value: string
  label: string
  tint: string
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

function TripRow({ trip }: { trip: ClientTrip }) {
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
          {trip.date} · {trip.duration}
        </p>
      </div>

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

export function TrajetsPage() {
  const kpis: Kpi[] = useMemo(() => {
    const count = CLIENT_TRIPS.length
    const totalKm = CLIENT_TRIPS.reduce((sum, t) => sum + t.km, 0)
    const totalAlerts = CLIENT_TRIPS.reduce((sum, t) => sum + t.alerts, 0)
    const avgScore = Math.round(CLIENT_TRIPS.reduce((sum, t) => sum + t.score, 0) / count)
    return [
      { value: String(count), label: 'Trajets effectués', tint: '#0F766E' },
      { value: `${totalKm} km`, label: 'Distance totale', tint: '#2b6cb0' },
      { value: `${avgScore}/100`, label: 'Score moyen', tint: scoreBadge(avgScore).tint },
      { value: String(totalAlerts), label: 'Alertes cumulées', tint: '#e8940c' },
    ]
  }, [])

  return (
    <div>
      <section className="mx-6 mt-5 flex flex-wrap items-end justify-between gap-3.5">
        <div className="min-w-0">
          <h1 className="text-[clamp(23px,2.8vw,30px)] font-extrabold leading-[1.15] tracking-[-0.026em] text-ink">
            Mes trajets
          </h1>
          <p className="mt-2.5 text-sm leading-6 text-body">
            Historique de vos déplacements et analyse de sécurité.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <select
            defaultValue="30"
            className="min-h-[44px] rounded-[10px] border-[1.5px] border-line bg-white px-4 text-[13px] font-medium text-ink outline-none"
          >
            <option value="7">7 derniers jours</option>
            <option value="30">30 derniers jours</option>
            <option value="12m">12 derniers mois</option>
          </select>
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-[10px] border-[1.5px] border-line bg-white px-[18px] text-[13px] font-bold text-ink transition-colors hover:bg-page"
          >
            <span className="ic text-lg">download</span>
            Exporter
          </button>
        </div>
      </section>

      <section className="mx-6 mt-4.5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-card">
            <p className="m-0 font-mono text-[28px] font-extrabold leading-none tracking-tight" style={{ color: kpi.tint }}>
              {kpi.value}
            </p>
            <p className="m-0 mt-2.5 text-[12.5px] font-semibold text-body">{kpi.label}</p>
          </div>
        ))}
      </section>

      <section className="mx-6 mt-4.5 overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        <div className="flex flex-col">
          {CLIENT_TRIPS.map((trip) => (
            <TripRow key={trip.id} trip={trip} />
          ))}
        </div>
      </section>

      <section className="mx-6 mt-4 flex items-start gap-3.5 rounded-2xl border border-brand-200 bg-brand-50 px-5 py-4.5">
        <span className="ic flex-none text-[22px] text-brand-600">insights</span>
        <p className="m-0 min-w-0 text-[13px] leading-relaxed text-[#4c6673]">
          Vos trajets plus sûrs commencent par une meilleure information : réduire votre vitesse de 10 km/h dans les
          zones à risque améliore votre score de conduite de 12 points en moyenne.
        </p>
      </section>
    </div>
  )
}
