import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BOX_STATUS,
  DASHBOARD_KPIS,
  DRIVER_POSITION,
  DRIVING_SCORE,
  LIVE_ALERT,
  RADIUS_CHOICES,
  SCORE_ROWS,
} from '@/data/clientDashboard'
import { DRIVER_PROFILE, PREF_TOGGLES } from '@/data/clientProfile'
import { CLIENT_REPORTS } from '@/data/clientReports'
import { CLIENT_TRIPS } from '@/data/clientTrips'
import { CLIENT_ZONES, RISK_META } from '@/data/clientZones'
import { ClientZoneMap, type ClientZoneMapHandle } from '@/components/client/ClientZoneMap'
import { PATHS } from '@/routes/paths'

function alertBadge(count: number): { label: string; fg: string; bg: string } {
  if (count === 0) return { label: 'Aucune', fg: '#1f9d55', bg: '#e9f6ee' }
  if (count <= 2) return { label: `${count} alerte${count > 1 ? 's' : ''}`, fg: '#e8940c', bg: '#fdf4e6' }
  return { label: `${count} alertes`, fg: '#dc3a2f', bg: '#fdeeec' }
}

function scoreTint(score: number): string {
  if (score >= 90) return '#1f9d55'
  if (score >= 80) return '#e8940c'
  return '#dc3a2f'
}

function reportStatusTint(status: string): { fg: string; soft: string } {
  return status === 'Validé' ? { fg: '#1f9d55', soft: '#e9f6ee' } : { fg: '#e8940c', soft: '#fdf4e6' }
}

function firstName(fullName: string): string {
  return fullName.split(' ')[0]
}

const CIRC = 2 * Math.PI * 15.9

export function AccueilPage() {
  const navigate = useNavigate()
  const mapRef = useRef<ClientZoneMapHandle>(null)

  const [liveAlertVisible, setLiveAlertVisible] = useState(true)
  const [radius, setRadius] = useState<(typeof RADIUS_CHOICES)[number]>(20)
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(PREF_TOGGLES.map((p) => [p.key, p.defaultOn])),
  )
  const [preAlert, setPreAlert] = useState(2)
  const [testing, setTesting] = useState(false)
  const [clock, setClock] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  const today = useMemo(() => {
    const label = clock.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    return label.charAt(0).toUpperCase() + label.slice(1)
  }, [clock])

  const timeLabel = useMemo(
    () => clock.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    [clock],
  )

  const nearbyZones = useMemo(
    () =>
      CLIENT_ZONES.filter((z) => z.distanceKm <= radius)
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, 5),
    [radius],
  )

  const recentTrips = CLIENT_TRIPS.slice(0, 5)
  const recentReports = CLIENT_REPORTS.slice(0, 3)

  function handleTestBox() {
    setTesting(true)
    setTimeout(() => setTesting(false), 2000)
  }

  return (
    <div>
      <section
        className="relative mx-6 mt-3.5 flex min-h-[132px] items-center overflow-hidden rounded-2xl bg-navy-900 bg-cover bg-center"
        style={{
          backgroundImage:
            'linear-gradient(96deg, rgba(6,35,52,.92) 0%, rgba(6,35,52,.72) 38%, rgba(6,35,52,.34) 70%, rgba(6,35,52,.5) 100%)',
        }}
      >
        <div className="grid w-full grid-cols-1 gap-5 p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <h1 className="text-[clamp(24px,3vw,32px)] font-extrabold leading-[1.15] tracking-[-0.026em] text-white">
              Bonjour {firstName(DRIVER_PROFILE.name)} 👋
            </h1>
            <p className="mt-2.5 text-sm leading-relaxed text-[rgba(234,244,248,0.86)]">
              Vos alertes sont actives. Bonne route et prudence sur la RN1.
            </p>
          </div>
          <div className="grid grid-cols-2 overflow-hidden rounded-[14px] bg-[rgba(255,255,255,0.94)] backdrop-blur">
            <div className="flex items-center gap-3 px-5 py-4">
              <span className="flex h-10 w-10 flex-none items-center justify-center overflow-hidden rounded-[11px] bg-brand-50 text-brand-600">
                <span className="ic text-[22px]">directions_car</span>
              </span>
              <div>
                <p className="m-0 text-[15px] font-extrabold text-ink">{DRIVER_PROFILE.plate}</p>
                <p className="m-0 mt-1.5 text-[11.5px] font-medium text-muted">Boîtier {DRIVER_PROFILE.boxId}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 border-l border-line px-5 py-4">
              <span className="flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded-[10px] bg-info-50 text-info-600">
                <span className="ic text-xl">calendar_month</span>
              </span>
              <div>
                <p className="m-0 text-[12.5px] font-semibold text-ink">{today}</p>
                <p className="m-0 mt-1.5 text-[13px] font-bold text-body">{timeLabel}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {liveAlertVisible && (
        <section className="mx-6 mt-4 flex flex-wrap items-center gap-4 rounded-2xl border border-[#f7cfca] border-l-[5px] border-l-danger-600 bg-white p-5 shadow-[0_6px_22px_rgba(220,58,47,0.1)]">
          <span className="flex h-[46px] w-[46px] flex-none items-center justify-center overflow-hidden rounded-full bg-danger-600 text-white">
            <span className="ic text-2xl">warning</span>
          </span>
          <div className="min-w-0 flex-1 basis-[260px]">
            <p className="m-0 text-[15.5px] font-extrabold text-danger-600">{LIVE_ALERT.title}</p>
            <p className="m-0 mt-1.5 text-[13px] leading-relaxed text-body">{LIVE_ALERT.detail}</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => navigate(PATHS.client.carte)}
              className="min-h-[44px] rounded-[10px] bg-danger-600 px-[18px] text-[13px] font-bold text-white transition-colors hover:bg-danger-700"
            >
              Voir sur la carte
            </button>
            <button
              type="button"
              onClick={() => setLiveAlertVisible(false)}
              className="min-h-[44px] rounded-[10px] border border-line bg-page px-[18px] text-[13px] font-semibold text-body transition-colors hover:bg-line-soft"
            >
              Ignorer
            </button>
          </div>
        </section>
      )}

      <section className="mx-6 mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {DASHBOARD_KPIS.map((kpi) => (
          <div key={kpi.label} className="min-w-0 rounded-2xl border border-line bg-white p-4.5 shadow-card">
            <div className="flex items-center gap-3.5">
              <span
                className="flex h-[46px] w-[46px] flex-none items-center justify-center overflow-hidden rounded-full"
                style={{ background: kpi.soft, color: kpi.tint }}
              >
                <span className="ic text-2xl">{kpi.icon}</span>
              </span>
              <div className="min-w-0">
                <p className="m-0 text-[26px] font-extrabold leading-none tracking-tight text-ink">{kpi.value}</p>
                <p className="m-0 mt-1.5 text-xs font-semibold text-body">{kpi.label}</p>
              </div>
            </div>
            <p className="m-0 mt-3.5 text-[11px] leading-relaxed text-faint">{kpi.note}</p>
          </div>
        ))}
      </section>

      <section className="mx-6 mt-4.5 grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-card">
          <div className="mb-4 flex flex-wrap items-start gap-3.5">
            <span className="flex h-10 w-10 flex-none items-center justify-center overflow-hidden rounded-[11px] bg-brand-50 text-brand-600">
              <span className="ic text-[22px]">near_me</span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="m-0 text-base font-extrabold text-ink">Zones à risque autour de moi</p>
              <p className="m-0 mt-1.5 text-[12.5px] leading-snug text-body">
                Votre position et les zones signalées à proximité, en temps réel.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {RADIUS_CHOICES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRadius(r)}
                  className={`min-h-10 whitespace-nowrap rounded-full border-[1.5px] px-3.5 text-[11.5px] font-bold transition-colors ${
                    radius === r
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-line bg-white text-body hover:border-brand-200'
                  }`}
                >
                  {r} km
                </button>
              ))}
            </div>
          </div>

          <div className="relative h-[340px] overflow-hidden rounded-[14px]">
            <ClientZoneMap
              ref={mapRef}
              zones={CLIENT_ZONES}
              driverPosition={DRIVER_POSITION}
              center={[DRIVER_POSITION.lat, DRIVER_POSITION.lng]}
              zoom={10}
            />
            <button
              type="button"
              onClick={() => mapRef.current?.flyTo(DRIVER_POSITION.lat, DRIVER_POSITION.lng, 11)}
              className="absolute bottom-3 left-3 z-[500] inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-full bg-navy-900 px-5 text-[12.5px] font-bold text-white shadow-[0_8px_22px_rgba(6,35,52,0.34)] transition-colors hover:bg-brand-600"
            >
              <span className="ic text-[17px]">my_location</span>
              Recentrer sur moi
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-2.5">
            {nearbyZones.map((zone) => {
              const meta = RISK_META[zone.level]
              return (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => mapRef.current?.focusZone(zone.id)}
                  className="flex min-w-0 items-start gap-3.5 rounded-xl border border-line-soft bg-surface p-3.5 text-left transition-colors hover:border-brand-200 hover:bg-[#f4fbf8] sm:items-center"
                >
                  <span className="mt-1.5 h-2.5 w-2.5 flex-none rounded-full sm:mt-0" style={{ background: meta.colorHex }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-extrabold text-ink">{zone.name}</span>
                    <span className="mt-1 block text-[11.5px] font-medium text-muted">
                      {zone.region} · à {zone.distanceKm.toString().replace('.', ',')} km
                    </span>
                  </span>
                  <span className="flex-none whitespace-nowrap text-xs font-extrabold" style={{ color: meta.colorHex }}>
                    {zone.distanceKm.toString().replace('.', ',')} km
                  </span>
                  <span className="ic flex-none text-lg text-icon-muted">chevron_right</span>
                </button>
              )
            })}

            {nearbyZones.length === 0 && (
              <div className="rounded-xl border border-line-soft bg-surface px-5 py-8 text-center">
                <span className="ic text-3xl text-success-600">verified</span>
                <p className="mt-2.5 text-[13.5px] font-bold text-ink">Aucune zone à risque dans ce rayon</p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-body">
                  Élargissez le rayon pour voir les zones plus éloignées.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="relative overflow-hidden rounded-2xl bg-navy-900 p-5.5">
            <div className="pointer-events-none absolute -right-[60px] -top-[50px] h-[190px] w-[190px] rounded-full bg-brand-400/[0.09]" />
            <div className="relative">
              <p className="m-0 mb-1 text-[14.5px] font-extrabold text-white">Mon score de conduite</p>
              <p className="m-0 mb-4.5 text-xs text-[rgba(234,244,248,0.65)]">30 derniers jours</p>
              <div className="flex items-center gap-4.5">
                <svg viewBox="0 0 42 42" className="h-24 w-24 flex-none -rotate-90">
                  <circle cx="21" cy="21" r="15.9" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="5" />
                  <circle
                    cx="21"
                    cy="21"
                    r="15.9"
                    fill="none"
                    stroke="#25c79a"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={`${(DRIVING_SCORE.value / 100) * CIRC} ${CIRC}`}
                  />
                </svg>
                <div className="min-w-0">
                  <p className="m-0 text-[34px] font-extrabold leading-none tracking-tight text-white">
                    {DRIVING_SCORE.value}
                    <span className="text-[17px] text-[rgba(234,244,248,0.55)]">/100</span>
                  </p>
                  <p className="m-0 mt-2.5 text-[12.5px] font-bold text-brand-400">{DRIVING_SCORE.label}</p>
                </div>
              </div>
              <div className="mt-5 flex flex-col gap-2.5 border-t border-white/10 pt-4.5">
                {SCORE_ROWS.map((row) => (
                  <div key={row.label}>
                    <div className="mb-1.5 flex items-center justify-between gap-2.5">
                      <span className="text-xs font-semibold text-[rgba(234,244,248,0.72)]">{row.label}</span>
                      <span className="text-xs font-extrabold" style={{ color: row.tint }}>
                        {row.value}
                      </span>
                    </div>
                    <span className="block h-1.5 overflow-hidden rounded-full bg-white/10">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${row.pct}%`, background: row.tint }}
                      />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="ic flex-none text-[21px] text-brand-600">tune</span>
              <p className="m-0 text-[15px] font-extrabold text-ink">Mes préférences d’alerte</p>
            </div>
            <div className="flex flex-col gap-0.5">
              {PREF_TOGGLES.map((pref) => {
                const on = prefs[pref.key]
                return (
                  <button
                    key={pref.key}
                    type="button"
                    onClick={() => setPrefs((p) => ({ ...p, [pref.key]: !p[pref.key] }))}
                    className="flex items-start gap-3.5 rounded-[10px] px-2 py-3 text-left transition-colors hover:bg-surface"
                  >
                    <span
                      className="relative mt-0.5 h-6 w-[42px] flex-none rounded-full transition-colors"
                      style={{ background: on ? '#0F766E' : '#cbd9e0' }}
                    >
                      <span
                        className="absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all"
                        style={{ left: on ? '21px' : '3px' }}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold leading-snug text-ink">{pref.label}</span>
                      <span className="mt-0.5 block text-[11.5px] leading-snug text-body">{pref.desc}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="mt-4 border-t border-line-soft pt-4">
              <div className="mb-2.5 flex items-baseline justify-between gap-2.5">
                <span className="text-[11.5px] font-bold uppercase tracking-[0.03em] text-ink">
                  Distance de pré-alerte
                </span>
                <span className="text-[13px] font-extrabold text-brand-600">
                  {preAlert.toString().replace('.', ',')} km
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={5}
                step={0.5}
                value={preAlert}
                onChange={(e) => setPreAlert(Number(e.target.value))}
                className="w-full accent-brand-600"
              />
              <p className="m-0 mt-2.5 text-[11.5px] leading-relaxed text-muted">
                Vous serez prévenu à cette distance avant d’entrer dans une zone.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-6 mt-4.5 grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-line bg-white shadow-card">
          <div className="flex items-center gap-2.5 border-b border-line-soft px-5 py-4.5">
            <span className="ic flex-none text-[21px] text-info-600">route</span>
            <p className="m-0 min-w-0 flex-1 text-[15px] font-extrabold text-ink">Mes derniers trajets</p>
            <button
              type="button"
              onClick={() => navigate(PATHS.client.trajets)}
              className="flex-none text-[11.5px] font-bold text-brand-600 transition-colors hover:text-brand-700"
            >
              Voir tous ›
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="bg-surface">
                  <th className="px-5 py-3 text-left text-[10.5px] font-extrabold tracking-[0.05em] text-muted">
                    DATE
                  </th>
                  <th className="px-3 py-3 text-left text-[10.5px] font-extrabold tracking-[0.05em] text-muted">
                    TRAJET
                  </th>
                  <th className="px-3 py-3 text-left text-[10.5px] font-extrabold tracking-[0.05em] text-muted">
                    DISTANCE
                  </th>
                  <th className="px-3 py-3 text-left text-[10.5px] font-extrabold tracking-[0.05em] text-muted">
                    ALERTES
                  </th>
                  <th className="px-3 py-3 text-left text-[10.5px] font-extrabold tracking-[0.05em] text-muted">
                    SCORE
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {recentTrips.map((trip) => {
                  const alert = alertBadge(trip.alerts)
                  return (
                    <tr key={trip.id} className="border-t border-page transition-colors hover:bg-surface">
                      <td className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold text-ink">{trip.date}</td>
                      <td className="px-3 py-3.5 text-xs font-medium text-body">{trip.route}</td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-xs font-medium text-body">{trip.km} km</td>
                      <td className="px-3 py-3.5">
                        <span
                          className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-[11px] font-bold"
                          style={{ color: alert.fg, background: alert.bg }}
                        >
                          {alert.label}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-[12.5px] font-extrabold" style={{ color: scoreTint(trip.score) }}>
                        {trip.score}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="ic text-lg text-icon-muted">chevron_right</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
            <div className="flex items-center gap-2.5 border-b border-line-soft px-5 py-4.5">
              <span className="ic flex-none text-[21px] text-danger-600">flag</span>
              <p className="m-0 min-w-0 flex-1 text-[15px] font-extrabold text-ink">Mes signalements</p>
              <span className="flex-none whitespace-nowrap rounded-md bg-brand-50 px-2.5 py-1.5 text-[11px] font-bold text-brand-700">
                {CLIENT_REPORTS.length} signalements
              </span>
            </div>
            <div className="flex flex-col gap-2.5 p-3">
              {recentReports.map((report) => {
                const status = reportStatusTint(report.status)
                return (
                  <div
                    key={report.id}
                    className="flex min-w-0 items-center gap-3 rounded-xl border border-line-soft bg-surface p-3.5"
                  >
                    <span
                      className="flex h-[34px] w-[34px] flex-none items-center justify-center overflow-hidden rounded-[10px]"
                      style={{ background: report.soft, color: report.tint }}
                    >
                      <span className="ic text-lg">{report.icon}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 text-[12.5px] font-bold text-ink">{report.type}</p>
                      <p className="m-0 mt-1 text-[11.5px] font-medium text-muted">
                        {report.place} · {report.date}
                      </p>
                    </div>
                    <span
                      className="flex-none whitespace-nowrap rounded-md px-2.5 py-1.5 text-[10.5px] font-bold"
                      style={{ color: status.fg, background: status.soft }}
                    >
                      {report.status}
                    </span>
                  </div>
                )
              })}

              <button
                type="button"
                className="mt-1 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-[11px] bg-danger-600 text-[13.5px] font-bold text-white transition-colors hover:bg-danger-700"
              >
                <span className="ic text-lg">add</span>
                Signaler un danger
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="ic flex-none text-[21px] text-brand-600">sensors</span>
              <p className="m-0 text-[15px] font-extrabold text-ink">Mon boîtier</p>
            </div>
            <div className="flex flex-col gap-3">
              <span className="flex items-center justify-between gap-2.5 text-[12.5px] font-medium text-body">
                Identifiant
                <b className="font-extrabold text-ink">{BOX_STATUS.id}</b>
              </span>
              <span className="flex items-center justify-between gap-2.5 text-[12.5px] font-medium text-body">
                Statut
                <b className="flex items-center gap-2 font-extrabold text-success-600">
                  <span className="h-2 w-2 rounded-full bg-success-600" />
                  En ligne
                </b>
              </span>
              <span className="flex items-center justify-between gap-2.5 text-[12.5px] font-medium text-body">
                Batterie
                <b className="font-extrabold text-ink">{BOX_STATUS.battery} %</b>
              </span>
              <span className="flex items-center justify-between gap-2.5 text-[12.5px] font-medium text-body">
                Dernière transmission
                <b className="font-extrabold text-ink">{BOX_STATUS.lastSeen}</b>
              </span>
            </div>
            <button
              type="button"
              className="mt-4.5 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-[10px] bg-brand-600 text-[13px] font-bold text-white transition-colors hover:bg-brand-700"
            >
              <span className="ic text-lg">monitor_heart</span>
              Monitoring temps réel
            </button>
            <button
              type="button"
              onClick={handleTestBox}
              disabled={testing}
              className="mt-2.5 min-h-[46px] w-full rounded-[10px] border border-line bg-page text-[13px] font-bold text-ink transition-colors hover:bg-line-soft disabled:cursor-not-allowed disabled:opacity-70"
            >
              {testing ? 'Test envoyé ✓' : 'Tester le boîtier'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
