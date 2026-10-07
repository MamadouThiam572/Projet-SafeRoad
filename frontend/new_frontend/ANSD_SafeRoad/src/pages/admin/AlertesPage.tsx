import { useMemo, useState } from 'react'
import {
  ADMIN_ALERTS,
  ALERT_SOURCE_LABEL,
  ALERT_STATUS_META,
  type AdminAlert,
  type AlertSource,
  type AlertStatus,
} from '@/data/adminAlerts'
import { useAuth } from '@/context/AuthContext'
import type { RiskLevel } from '@/data/adminHome'

const LEVEL_META: Record<RiskLevel, { label: string; color: string; soft: string; text: string }> = {
  critique: { label: 'Critique', color: '#dc3a2f', soft: '#fdeeec', text: '#dc3a2f' },
  vigilance: { label: 'Vigilance', color: '#e8940c', soft: '#fdf4e6', text: '#e8940c' },
  normale: { label: 'Normal', color: '#1f9d55', soft: '#e9f6ee', text: '#1f9d55' },
}

type SourceTabKey = 'toutes' | AlertSource

const TABS: { key: SourceTabKey; label: string }[] = [
  { key: 'toutes', label: 'Toutes' },
  { key: 'zone', label: 'Zones' },
  { key: 'vehicule', label: 'Véhicules' },
  { key: 'boitier', label: 'Boîtiers' },
]

function tabCount(key: SourceTabKey, alerts: AdminAlert[]): number {
  if (key === 'toutes') return alerts.length
  return alerts.filter((a) => a.source === key).length
}

function nextStatus(status: AlertStatus): AlertStatus | null {
  if (status === 'nouvelle') return 'en_cours'
  if (status === 'en_cours') return 'traitee'
  return null
}

function nextActionLabel(status: AlertStatus): string {
  return status === 'nouvelle' ? 'Prendre en charge' : 'Marquer résolue'
}

function AlertCard({ alert, onAdvance }: { alert: AdminAlert; onAdvance: (id: string) => void }) {
  const level = LEVEL_META[alert.level]
  const status = ALERT_STATUS_META[alert.status]
  const source = ALERT_SOURCE_LABEL[alert.source]
  const action = nextStatus(alert.status)

  return (
    <div className="flex flex-wrap items-start gap-4 rounded-2xl border border-line bg-white p-5 shadow-card transition-shadow hover:shadow-card-hover sm:items-center sm:flex-nowrap">
      <span
        className="relative flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[13px]"
        style={{ background: level.soft, color: level.text }}
      >
        <span className="ic text-2xl">{alert.icon}</span>
        {alert.status === 'nouvelle' && (
          <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-danger-600" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="m-0 text-[15px] font-extrabold text-ink">{alert.title}</p>
          <span className="rounded-md bg-page px-2 py-0.5 text-[10px] font-bold text-faint">{source}</span>
        </div>
        <p className="m-0 mt-1.5 text-sm leading-6 text-body">{alert.desc}</p>
        <div className="mt-2.5 flex flex-wrap gap-4">
          <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted">
            <span className="ic text-[15px]">place</span>
            {alert.place}
          </span>
          <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted">
            <span className="ic text-[15px]">schedule</span>
            {alert.ago}
          </span>
          {alert.meta && (
            <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted">
              <span className="ic text-[15px]">directions_car</span>
              {alert.meta}
            </span>
          )}
        </div>
      </div>

      <span
        className="flex-none whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-bold"
        style={{ background: level.soft, color: level.text }}
      >
        {level.label}
      </span>
      <span
        className="flex-none whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-bold"
        style={{ background: status.soft, color: status.text }}
      >
        {status.label}
      </span>

      {action ? (
        <button
          type="button"
          onClick={() => onAdvance(alert.id)}
          className="flex-none whitespace-nowrap rounded-full bg-brand-600 px-4 py-2.5 text-[11.5px] font-bold text-white transition-colors hover:bg-brand-700"
        >
          {nextActionLabel(alert.status)}
        </button>
      ) : (
        <span className="flex-none text-[11.5px] font-bold text-success-600">
          <span className="ic align-middle text-base">check_circle</span>
        </span>
      )}
    </div>
  )
}

export function AlertesPage() {
  const { user } = useAuth()
  const region = user?.region ?? 'Dakar'
  const [alerts, setAlerts] = useState<AdminAlert[]>(ADMIN_ALERTS)
  const [tab, setTab] = useState<SourceTabKey>('toutes')
  const [hideResolved, setHideResolved] = useState(false)

  const filtered = useMemo(() => {
    let list = tab === 'toutes' ? alerts : alerts.filter((a) => a.source === tab)
    if (hideResolved) list = list.filter((a) => a.status !== 'traitee')
    return list
  }, [alerts, tab, hideResolved])

  const nouvelles = alerts.filter((a) => a.status === 'nouvelle').length
  const enCours = alerts.filter((a) => a.status === 'en_cours').length
  const traitees = alerts.filter((a) => a.status === 'traitee').length

  const handleAdvance = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a
        const next = nextStatus(a.status)
        return next ? { ...a, status: next } : a
      }),
    )
  }

  return (
    <div>
      <section className="mx-6 mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[clamp(23px,2.8vw,30px)] font-extrabold leading-[1.15] tracking-[-0.026em] text-ink">
            Alertes
          </h1>
          <p className="mt-2.5 text-sm leading-6 text-body">
            Zones, véhicules et boîtiers de {region} — suivez et traitez les alertes de votre région.
          </p>
        </div>
        <div className="flex flex-none flex-wrap gap-2.5">
          <span className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-[12px] font-bold text-danger-700">
            {nouvelles} nouvelle{nouvelles > 1 ? 's' : ''}
          </span>
          <span className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-[12px] font-bold text-warning-600">
            {enCours} en cours
          </span>
          <span className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-[12px] font-bold text-success-600">
            {traitees} traitée{traitees > 1 ? 's' : ''}
          </span>
        </div>
      </section>

      <section className="mx-6 mt-4 flex flex-wrap items-center gap-2.5">
        {TABS.map((t) => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap rounded-full border-[1.5px] px-5 py-3 text-[12.5px] font-bold transition-colors ${
                active
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-line bg-white text-body hover:border-brand-200'
              }`}
            >
              {t.label} ({tabCount(t.key, alerts)})
            </button>
          )
        })}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setHideResolved((v) => !v)}
          className={`whitespace-nowrap rounded-full border-[1.5px] px-[18px] py-3 text-[12.5px] font-bold transition-colors ${
            hideResolved
              ? 'border-brand-600 bg-brand-50 text-brand-700'
              : 'border-line bg-white text-body hover:border-brand-200'
          }`}
        >
          Masquer les traitées
        </button>
      </section>

      <section className="mx-6 mt-4 flex flex-col gap-3 pb-2">
        {filtered.map((alert) => (
          <AlertCard key={alert.id} alert={alert} onAdvance={handleAdvance} />
        ))}

        {filtered.length === 0 && (
          <div className="rounded-2xl border border-line bg-white px-5 py-14 text-center shadow-card">
            <span className="ic text-4xl text-success-600">notifications_off</span>
            <p className="mt-3.5 text-[15px] font-extrabold text-ink">Aucune alerte dans cette catégorie</p>
            <p className="mt-1.5 text-sm leading-6 text-body">Tout est sous contrôle pour l'instant.</p>
          </div>
        )}
      </section>
    </div>
  )
}
