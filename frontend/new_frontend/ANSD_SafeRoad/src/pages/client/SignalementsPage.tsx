import { useMemo, useState } from 'react'
import { CLIENT_REPORTS, type ClientReport, type ReportStatus } from '@/data/clientReports'

function statusBadge(status: ReportStatus): { fg: string; bg: string; icon: string } {
  if (status === 'Validé') return { fg: '#1f9d55', bg: '#e9f6ee', icon: 'check_circle' }
  return { fg: '#e8940c', bg: '#fdf4e6', icon: 'schedule' }
}

type TabKey = 'tous' | 'en_cours' | 'valides'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'tous', label: 'Tous' },
  { key: 'en_cours', label: 'En cours' },
  { key: 'valides', label: 'Validés' },
]

function matchesTab(key: TabKey, report: ClientReport): boolean {
  if (key === 'tous') return true
  if (key === 'en_cours') return report.status === 'En cours'
  return report.status === 'Validé'
}

function tabCount(key: TabKey, reports: ClientReport[]): number {
  return reports.filter((r) => matchesTab(key, r)).length
}

function ReportCard({ report }: { report: ClientReport }) {
  const status = statusBadge(report.status)
  return (
    <div className="flex flex-wrap items-start gap-4 rounded-2xl border border-line bg-white p-5 shadow-card transition-shadow hover:shadow-card-hover sm:items-center sm:flex-nowrap">
      <span
        className="flex h-[46px] w-[46px] flex-none items-center justify-center overflow-hidden rounded-full"
        style={{ background: report.soft, color: report.tint }}
      >
        <span className="ic text-2xl">{report.icon}</span>
      </span>

      <div className="min-w-0 flex-1 basis-[220px]">
        <p className="m-0 text-[15px] font-extrabold text-ink">{report.type}</p>
        <p className="m-0 mt-1.5 text-[12.5px] leading-relaxed text-body">{report.desc}</p>
        <div className="mt-2.5 flex flex-wrap gap-3.5">
          <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted">
            <span className="ic text-[15px]">place</span>
            {report.place}
          </span>
          <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted">
            <span className="ic text-[15px]">event</span>
            {report.date}
          </span>
        </div>
      </div>

      <span
        className="flex flex-none items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2.5 text-[11.5px] font-bold"
        style={{ color: status.fg, background: status.bg }}
      >
        <span className="ic text-[15px]">{status.icon}</span>
        {report.status}
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

export function SignalementsPage() {
  const [tab, setTab] = useState<TabKey>('tous')

  const filtered = useMemo(() => CLIENT_REPORTS.filter((r) => matchesTab(tab, r)), [tab])

  return (
    <div>
      <section className="mx-6 mt-5 flex flex-wrap items-end justify-between gap-3.5">
        <div className="min-w-0">
          <h1 className="text-[clamp(23px,2.8vw,30px)] font-extrabold leading-[1.15] tracking-[-0.026em] text-ink">
            Mes signalements
          </h1>
          <p className="mt-2.5 text-sm leading-6 text-body">
            Contribuez à la sécurité routière en signalant les dangers que vous rencontrez.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex min-h-[46px] items-center gap-2.5 whitespace-nowrap rounded-xl bg-brand-600 px-[22px] text-[13.5px] font-bold text-white shadow-[0_8px_22px_rgba(14,158,122,0.24)] transition-colors hover:bg-brand-700"
        >
          <span className="ic text-[19px]">add</span>
          Nouveau signalement
        </button>
      </section>

      <section className="mx-6 mt-4 flex flex-wrap gap-2.5">
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
              {t.label} ({tabCount(t.key, CLIENT_REPORTS)})
            </button>
          )
        })}
      </section>

      <section className="mx-6 mt-4 flex flex-col gap-3">
        {filtered.map((report) => (
          <ReportCard key={report.id} report={report} />
        ))}

        {filtered.length === 0 && (
          <div className="rounded-2xl border border-line bg-white px-5 py-14 text-center shadow-card">
            <span className="ic text-4xl text-icon-muted">flag</span>
            <p className="mt-3.5 text-[15px] font-extrabold text-ink">Aucun signalement dans cette catégorie</p>
            <p className="mt-1.5 text-sm leading-6 text-body">
              Vos remontées aident les autorités à prioriser les interventions.
            </p>
            <button
              type="button"
              className="mt-5 inline-flex min-h-[46px] items-center rounded-xl bg-brand-600 px-6 text-[13.5px] font-bold text-white transition-colors hover:bg-brand-700"
            >
              Signaler un danger
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
