import { useMemo, useState, type FormEvent } from 'react'
import {
  ACTION_PREVUE_LABEL,
  ANASER_RETOURS,
  STATUT_RETOUR_META,
  type ActionPrevue,
  type CibleType,
  type RetourAnaser,
  type StatutRetour,
} from '@/data/anaserRetours'

type StatutTabKey = 'toutes' | StatutRetour

const TABS: { key: StatutTabKey; label: string }[] = [
  { key: 'toutes', label: 'Tous' },
  { key: 'nouveau', label: 'Nouveaux' },
  { key: 'en_cours', label: 'En cours' },
  { key: 'traite', label: 'Traités' },
]

const ACTION_OPTIONS: ActionPrevue[] = ['signalisation', 'ralentisseur', 'eclairage', 'autre']

function todayLabel(): string {
  return new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function emptyForm() {
  return {
    cibleType: 'zone' as CibleType,
    cibleLabel: '',
    actionPrevue: 'signalisation' as ActionPrevue,
    commentaire: '',
  }
}

export function RetoursPage() {
  const [retours, setRetours] = useState<RetourAnaser[]>(ANASER_RETOURS)
  const [tab, setTab] = useState<StatutTabKey>('toutes')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm())

  const filtered = useMemo(
    () => (tab === 'toutes' ? retours : retours.filter((r) => r.statut === tab)),
    [retours, tab],
  )

  const counts = {
    nouveau: retours.filter((r) => r.statut === 'nouveau').length,
    en_cours: retours.filter((r) => r.statut === 'en_cours').length,
    traite: retours.filter((r) => r.statut === 'traite').length,
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.cibleLabel.trim() || !form.commentaire.trim()) return

    const nextId = `SR-${String(retours.length + 1).padStart(3, '0')}`
    const nouveau: RetourAnaser = {
      id: nextId,
      cibleType: form.cibleType,
      cibleLabel: form.cibleLabel.trim(),
      actionPrevue: form.actionPrevue,
      commentaire: form.commentaire.trim(),
      statut: 'nouveau',
      createdAt: todayLabel(),
    }

    // TODO backend : remplacer par createAlerteAnaser(nouveau) — voir src/lib/api.ts
    setRetours((prev) => [nouveau, ...prev])
    setForm(emptyForm())
    setShowForm(false)
  }

  function handleDelete(id: string) {
    // TODO backend : appeler deleteAlerteAnaser(id) — voir src/lib/api.ts
    setRetours((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div>
      <section className="mx-6 mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[clamp(23px,2.8vw,30px)] font-extrabold leading-[1.15] tracking-[-0.026em] text-ink">
            Alertes ANASER
          </h1>
          <p className="mt-2.5 text-sm leading-6 text-body">
            Vos retours officiels sur les zones à risque et incidents — vue nationale.
          </p>
        </div>
        <div className="flex flex-none flex-wrap items-center gap-2.5">
          <span className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-[12px] font-bold text-danger-700">
            {counts.nouveau} nouveau{counts.nouveau > 1 ? 'x' : ''}
          </span>
          <span className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-[12px] font-bold text-warning-600">
            {counts.en_cours} en cours
          </span>
          <span className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-[12px] font-bold text-success-600">
            {counts.traite} traité{counts.traite > 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 whitespace-nowrap rounded-full bg-brand-600 px-4 py-2.5 text-[12.5px] font-bold text-white transition-colors hover:bg-brand-700"
          >
            <span className="ic text-base">add</span>
            Soumettre un retour
          </button>
        </div>
      </section>

      {showForm && (
        <section className="mx-6 mt-4">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5 shadow-card"
          >
            <p className="m-0 text-sm font-extrabold text-ink">Nouveau retour officiel</p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-body">
                Concerne
                <select
                  value={form.cibleType}
                  onChange={(e) => setForm((f) => ({ ...f, cibleType: e.target.value as CibleType }))}
                  className="rounded-xl border border-line px-3 py-2.5 text-sm font-semibold text-ink"
                >
                  <option value="zone">Une zone à risque</option>
                  <option value="incident">Un incident</option>
                </select>
              </label>

              <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-body">
                Action recommandée
                <select
                  value={form.actionPrevue}
                  onChange={(e) => setForm((f) => ({ ...f, actionPrevue: e.target.value as ActionPrevue }))}
                  className="rounded-xl border border-line px-3 py-2.5 text-sm font-semibold text-ink"
                >
                  {ACTION_OPTIONS.map((a) => (
                    <option key={a} value={a}>
                      {ACTION_PREVUE_LABEL[a]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-body">
              Localisation (zone ou incident concerné)
              <input
                value={form.cibleLabel}
                onChange={(e) => setForm((f) => ({ ...f, cibleLabel: e.target.value }))}
                placeholder="Ex : RN1 — Km 45 (Dakar)"
                className="rounded-xl border border-line px-3 py-2.5 text-sm font-semibold text-ink"
                required
              />
            </label>

            <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-body">
              Commentaire
              <textarea
                value={form.commentaire}
                onChange={(e) => setForm((f) => ({ ...f, commentaire: e.target.value }))}
                rows={3}
                placeholder="Décrivez l'observation et l'action recommandée…"
                className="resize-none rounded-xl border border-line px-3 py-2.5 text-sm text-ink"
                required
              />
            </label>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-full border border-line px-4 py-2.5 text-[12.5px] font-bold text-body"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="rounded-full bg-brand-600 px-5 py-2.5 text-[12.5px] font-bold text-white hover:bg-brand-700"
              >
                Envoyer le retour
              </button>
            </div>
          </form>
        </section>
      )}

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
              {t.label}
            </button>
          )
        })}
      </section>

      <section className="mx-6 mt-4 flex flex-col gap-3 pb-8">
        {filtered.map((retour) => {
          const status = STATUT_RETOUR_META[retour.statut]
          return (
            <div
              key={retour.id}
              className="flex flex-wrap items-start gap-4 rounded-2xl border border-line bg-white p-5 shadow-card sm:items-center sm:flex-nowrap"
            >
              <span
                className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[13px]"
                style={{ background: status.soft, color: status.text }}
              >
                <span className="ic text-2xl">campaign</span>
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="m-0 text-[15px] font-extrabold text-ink">
                    {retour.id} — {ACTION_PREVUE_LABEL[retour.actionPrevue]}
                  </p>
                  <span className="rounded-md bg-page px-2 py-0.5 text-[10px] font-bold text-faint">
                    {retour.cibleType === 'zone' ? 'Zone' : 'Incident'}
                  </span>
                </div>
                <p className="m-0 mt-1.5 text-sm leading-6 text-body">{retour.commentaire}</p>
                <div className="mt-2.5 flex flex-wrap gap-4">
                  <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted">
                    <span className="ic text-[15px]">place</span>
                    {retour.cibleLabel}
                  </span>
                  <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted">
                    <span className="ic text-[15px]">schedule</span>
                    {retour.createdAt}
                  </span>
                </div>
              </div>

              <span
                className="flex-none whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-bold"
                style={{ background: status.soft, color: status.text }}
              >
                {status.label}
              </span>

              <button
                type="button"
                onClick={() => handleDelete(retour.id)}
                className="flex-none rounded-full border border-line px-3 py-2 text-[11px] font-bold text-danger-700 hover:bg-danger-50"
              >
                Supprimer
              </button>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="rounded-2xl border border-line bg-white px-5 py-14 text-center shadow-card">
            <span className="ic text-4xl text-icon-muted">campaign</span>
            <p className="mt-3.5 text-[15px] font-extrabold text-ink">Aucun retour dans cette catégorie</p>
            <p className="mt-1.5 text-sm leading-6 text-body">Utilisez « Soumettre un retour » pour en créer un.</p>
          </div>
        )}
      </section>
    </div>
  )
}
