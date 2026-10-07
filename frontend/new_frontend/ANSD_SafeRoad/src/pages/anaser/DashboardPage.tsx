import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ACTION_PREVUE_LABEL, ANASER_RETOURS, STATUT_RETOUR_META } from '@/data/anaserRetours'
import { PATHS } from '@/routes/paths'

/**
 * Chiffres de démonstration, dans le même esprit que data/adminHome.ts
 * (mock en attendant le branchement sur les endpoints Django
 * /api/v1/incidents/, /api/v1/zones/ et /api/v1/statistiques/).
 */
const NATIONAL_KPIS = [
  { key: 'incidents', icon: 'report', label: 'Incidents signalés', value: 28, tint: '#dc3a2f', soft: '#fdeeec' },
  { key: 'zones', icon: 'crisis_alert', label: 'Zones à risque', value: 15, tint: '#e8940c', soft: '#fdf4e6' },
  { key: 'retours', icon: 'campaign', label: 'Retours ANASER', value: ANASER_RETOURS.length, tint: '#2b6cb0', soft: '#e8f1fb' },
]

const QUICK_ACTIONS = [
  { icon: 'report', label: 'Consulter les incidents', to: PATHS.anaser.incidents },
  { icon: 'crisis_alert', label: 'Zones à risque', to: PATHS.anaser.zones },
  { icon: 'bar_chart', label: 'Statistiques', to: PATHS.anaser.statistiques },
  { icon: 'campaign', label: 'Soumettre un retour', to: PATHS.anaser.retours },
]

function firstName(fullName: string): string {
  return fullName.split(' ')[0]
}

export function DashboardPage() {
  const { user } = useAuth()

  const recentRetours = useMemo(() => ANASER_RETOURS.slice(0, 3), [])

  return (
    <div>
      <section className="relative mx-6 mt-3.5 flex min-h-[128px] items-center overflow-hidden rounded-2xl bg-navy-900">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'linear-gradient(96deg, rgba(6,35,52,.96) 0%, rgba(6,35,52,.86) 45%, rgba(6,35,52,.7) 100%)',
          }}
        />
        <div className="relative w-full p-7">
          <h1 className="text-[clamp(22px,3vw,28px)] font-extrabold leading-[1.15] tracking-[-0.026em] text-white">
            Bonjour {user ? firstName(user.firstName) : 'ANASER'} 👋
          </h1>
          <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-[rgba(234,244,248,0.86)]">
            Vue nationale — suivez les incidents et zones à risque remontés dans tout le pays, et soumettez vos
            retours officiels aux administrateurs.
          </p>
        </div>
      </section>

      <section className="mx-6 mt-4.5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {NATIONAL_KPIS.map((kpi) => (
          <div key={kpi.key} className="min-w-0 rounded-2xl border border-line bg-white p-4.5 shadow-card">
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
          </div>
        ))}
      </section>

      <section className="mx-6 mt-4.5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-card">
          <p className="m-0 mb-4 text-sm font-extrabold text-ink">Actions rapides</p>
          <div className="grid grid-cols-2 gap-3">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.label}
                to={action.to}
                className="flex flex-col items-start gap-2.5 rounded-xl border border-line p-4 transition-colors hover:border-brand-300 hover:bg-brand-50"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                  <span className="ic text-lg">{action.icon}</span>
                </span>
                <span className="text-[12.5px] font-bold text-ink">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-card">
          <div className="mb-3.5 flex items-center justify-between">
            <p className="m-0 text-sm font-extrabold text-ink">Mes retours ANASER</p>
            <Link to={PATHS.anaser.retours} className="text-xs font-bold text-brand-600">
              Voir tout →
            </Link>
          </div>
          <ul className="flex flex-col gap-3.5">
            {recentRetours.map((retour) => {
              const status = STATUT_RETOUR_META[retour.statut]
              return (
                <li key={retour.id} className="flex items-start gap-3">
                  <span
                    className="flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded-full"
                    style={{ background: status.soft, color: status.text }}
                  >
                    <span className="ic text-lg">campaign</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[13px] font-bold text-ink">
                      {retour.id} — {ACTION_PREVUE_LABEL[retour.actionPrevue]}
                    </p>
                    <p className="m-0 mt-0.5 text-[11.5px] text-body">{retour.cibleLabel}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[11px] font-medium text-faint">{retour.createdAt}</span>
                      <span
                        className="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                        style={{ background: status.soft, color: status.text }}
                      >
                        {status.label}
                      </span>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </section>
    </div>
  )
}
