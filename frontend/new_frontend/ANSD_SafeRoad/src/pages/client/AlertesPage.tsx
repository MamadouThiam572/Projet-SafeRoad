import { useMemo, useState } from 'react'
import { alerteConducteurDepuisApi, type ClientAlert } from '@/data/clientAlerts'
import { RISK_META } from '@/data/clientZones'
import { useEnDirect } from '@/hooks/useEnDirect'
import { getAlertesConducteur } from '@/lib/api'

/** Dernière lecture du fil (préférence locale à ce navigateur). */
const CLE_LU = 'saferoad_alertes_lues_le'
function lireDerniereLecture(): number {
  try {
    return Number(localStorage.getItem(CLE_LU)) || 0
  } catch {
    return 0
  }
}

const BADGE_LABEL: Record<ClientAlert['level'], string> = {
  critique: 'Critique',
  vigilance: 'Vigilance',
  normale: 'Normal',
}

type TabKey = 'toutes' | 'critique' | 'vigilance'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'toutes', label: 'Toutes' },
  { key: 'critique', label: 'Critiques' },
  { key: 'vigilance', label: 'Vigilance' },
]

function tabCount(key: TabKey, alerts: ClientAlert[]): number {
  if (key === 'toutes') return alerts.length
  return alerts.filter((a) => a.level === key).length
}

function AlertCard({ alert, unread }: { alert: ClientAlert; unread: boolean }) {
  const meta = RISK_META[alert.level]
  return (
    <div className="flex flex-wrap items-start gap-4 rounded-2xl border border-line bg-white p-5 shadow-card transition-shadow hover:shadow-card-hover sm:items-center sm:flex-nowrap">
      <span
        className="relative flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[13px]"
        style={{ background: meta.colorHex + '1a', color: meta.colorHex }}
      >
        <span className="ic text-2xl">{alert.icon}</span>
        {unread && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-danger-600" />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="m-0 text-[15px] font-extrabold text-ink">{alert.title}</p>
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
          {alert.distance && (
            <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted">
              <span className="ic text-[15px]">straighten</span>
              {alert.distance}
            </span>
          )}
        </div>
      </div>

      <span
        className={`flex-none whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-bold ${meta.softClass} ${meta.textClass}`}
      >
        {BADGE_LABEL[alert.level]}
      </span>
      <button
        type="button"
        className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[11px] border border-line bg-page text-body transition-colors hover:bg-line-soft"
        aria-label="Voir le détail"
      >
        <span className="ic text-xl">chevron_right</span>
      </button>
    </div>
  )
}

export function AlertesPage() {
  const [tab, setTab] = useState<TabKey>('toutes')
  const { donnees, erreur, maj } = useEnDirect(getAlertesConducteur, 15_000)
  const CLIENT_ALERTS = useMemo(() => (donnees ?? []).map((a) => alerteConducteurDepuisApi(a, maj)), [donnees, maj])
  const [luLe, setLuLe] = useState(lireDerniereLecture)
  const nonLue = (a: ClientAlert) => !!a.date && Date.parse(a.date) > luLe
  const nbNonLues = CLIENT_ALERTS.filter(nonLue).length

  const toutLire = () => {
    const t = Date.now()
    setLuLe(t)
    try {
      localStorage.setItem(CLE_LU, String(t))
    } catch {
      // Stockage indisponible (navigation privée) : le « lu » ne vaut que pour cette visite.
    }
  }

  const filtered = useMemo(() => {
    if (tab === 'toutes') return CLIENT_ALERTS
    return CLIENT_ALERTS.filter((a) => a.level === tab)
  }, [tab, CLIENT_ALERTS])

  return (
    <div>
      <section className="mx-6 mt-5">
        <h1 className="text-[clamp(23px,2.8vw,30px)] font-extrabold leading-[1.15] tracking-[-0.026em] text-ink">
          Mes alertes
        </h1>
        <p className="mt-2.5 text-sm leading-6 text-body">
          Les alertes émises par votre boîtier à l'approche des zones à risque reconnues par l'ANASER.
        </p>
        {erreur && <p className="mt-2 text-xs font-semibold text-danger-600">{erreur}</p>}
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
              {t.label} ({tabCount(t.key, CLIENT_ALERTS)})
            </button>
          )
        })}
        <div className="flex-1" />
        <button
          type="button"
          onClick={toutLire}
          disabled={nbNonLues === 0}
          className="whitespace-nowrap rounded-full border border-brand-200 bg-brand-50 px-[18px] py-3 text-[12.5px] font-bold text-brand-700 transition-colors hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Tout marquer comme lu
        </button>
      </section>

      <section className="mx-6 mt-4 flex flex-col gap-3">
        {filtered.map((alert) => (
          <AlertCard key={alert.id} alert={alert} unread={nonLue(alert)} />
        ))}

        {filtered.length === 0 && (
          <div className="rounded-2xl border border-line bg-white px-5 py-14 text-center shadow-card">
            <span className="ic text-4xl text-success-600">notifications_off</span>
            <p className="mt-3.5 text-[15px] font-extrabold text-ink">
              {donnees ? 'Aucune alerte dans cette catégorie' : 'Chargement des alertes…'}
            </p>
            <p className="mt-1.5 text-sm leading-6 text-body">Bonne route — rien à signaler pour l’instant.</p>
          </div>
        )}
      </section>
    </div>
  )
}
