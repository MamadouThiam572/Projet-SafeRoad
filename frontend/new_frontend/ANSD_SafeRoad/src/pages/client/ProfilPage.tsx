import { useMemo, useState } from 'react'
import { CLIENT_REPORTS } from '@/data/clientReports'
import { DRIVER_PROFILE, PREF_TOGGLES, PROFILE_FIELDS } from '@/data/clientProfile'
import { CLIENT_TRIPS } from '@/data/clientTrips'

function initialValues(): Record<string, string> {
  return Object.fromEntries(PROFILE_FIELDS.map((f) => [f.key, f.value]))
}

function initialPrefs(): Record<string, boolean> {
  return Object.fromEntries(PREF_TOGGLES.map((p) => [p.key, p.defaultOn]))
}

function ToggleSwitch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      className="relative mt-0.5 h-6 w-[42px] flex-none rounded-full transition-colors"
      style={{ background: on ? '#0F766E' : '#cbd9e0' }}
    >
      <span
        className="absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all"
        style={{ left: on ? '21px' : '3px' }}
      />
    </button>
  )
}

export function ProfilPage() {
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState<Record<string, string>>(initialValues)
  const [prefs, setPrefs] = useState<Record<string, boolean>>(initialPrefs)

  const impactLine = useMemo(() => {
    const reports = CLIENT_REPORTS.length
    const trips = CLIENT_TRIPS.length
    return `Vos ${reports} signalement${reports > 1 ? 's' : ''} et vos ${trips} trajets alimentent la cartographie nationale des zones à risque.`
  }, [])

  function handleField(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    setEditing(false)
  }

  function handleCancel() {
    setValues(initialValues())
    setEditing(false)
  }

  return (
    <div>
      <section className="mx-6 mt-5">
        <h1 className="text-[clamp(23px,2.8vw,30px)] font-extrabold leading-[1.15] tracking-[-0.026em] text-ink">
          Mon profil
        </h1>
        <p className="mt-2.5 text-sm leading-6 text-body">Gérez vos informations personnelles et vos préférences.</p>
      </section>

      <section className="mx-6 mt-4.5 flex flex-wrap items-start gap-4.5 rounded-2xl border border-line bg-white p-5.5 shadow-card sm:items-center sm:flex-nowrap">
        <span className="flex h-[78px] w-[78px] flex-none items-center justify-center rounded-full bg-navy-900 text-[26px] font-extrabold text-brand-400">
          {DRIVER_PROFILE.initials}
        </span>
        <div className="min-w-0 flex-1 basis-[220px]">
          <p className="m-0 text-[19px] font-extrabold leading-tight text-ink">{DRIVER_PROFILE.name}</p>
          <p className="m-0 mt-2 text-[12.5px] font-semibold text-brand-600">{DRIVER_PROFILE.role}</p>
          <div className="mt-3 flex flex-wrap gap-4">
            <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-body">
              <span className="ic text-[17px] text-muted">mail</span>
              {DRIVER_PROFILE.email}
            </span>
            <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-body">
              <span className="ic text-[17px] text-muted">directions_car</span>
              {DRIVER_PROFILE.plate}
            </span>
          </div>
        </div>
        <span className="flex flex-none items-center gap-2 whitespace-nowrap rounded-full border border-brand-200 bg-brand-50 px-4 py-2.5 text-[11.5px] font-bold text-brand-700">
          <span className="ic text-base">verified</span>
          Compte vérifié
        </span>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className={`inline-flex min-h-[46px] flex-none items-center gap-2 whitespace-nowrap rounded-[11px] border-[1.5px] px-5 text-[13px] font-bold transition-colors ${
            editing
              ? 'border-line bg-page text-body hover:bg-line-soft'
              : 'border-line bg-white text-ink hover:bg-page'
          }`}
        >
          <span className="ic text-lg">{editing ? 'close' : 'edit'}</span>
          {editing ? 'Fermer' : 'Modifier'}
        </button>
      </section>

      <section className="mx-6 mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="min-w-0 rounded-2xl border border-line bg-white p-5.5 shadow-card">
          <p className="m-0 mb-5 text-[15px] font-extrabold text-ink">Informations personnelles</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PROFILE_FIELDS.map((field) => {
              const locked = field.readonly || !editing
              return (
                <label key={field.key} className="block min-w-0">
                  <span className="mb-2 block text-[10.5px] font-bold uppercase tracking-[0.04em] text-body">
                    {field.label}
                  </span>
                  <input
                    value={values[field.key]}
                    onChange={(e) => handleField(field.key, e.target.value)}
                    disabled={locked}
                    className={`w-full rounded-[10px] border-[1.5px] px-3.5 py-3 text-[13.5px] font-medium text-ink outline-none transition-colors focus:border-brand-600 ${
                      locked ? 'border-line bg-page text-body' : 'border-line-field bg-field'
                    }`}
                  />
                </label>
              )
            })}
          </div>
          {editing && (
            <div className="mt-5 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={handleSave}
                className="min-h-[46px] flex-1 basis-[140px] rounded-[10px] bg-brand-600 text-[13.5px] font-bold text-white transition-colors hover:bg-brand-700"
              >
                Enregistrer les modifications
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="min-h-[46px] flex-1 basis-[100px] rounded-[10px] border border-line bg-page text-[13.5px] font-semibold text-body transition-colors hover:bg-line-soft"
              >
                Annuler
              </button>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="rounded-2xl border border-line bg-white p-5.5 shadow-card">
            <p className="m-0 mb-4.5 text-[15px] font-extrabold text-ink">Préférences</p>
            <div className="flex flex-col gap-0.5">
              {PREF_TOGGLES.map((pref) => (
                <div key={pref.key} className="flex items-start gap-3.5 rounded-[10px] px-2 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold leading-snug text-ink">{pref.label}</span>
                    <span className="mt-0.5 block text-[11.5px] leading-snug text-body">{pref.desc}</span>
                  </span>
                  <ToggleSwitch
                    on={prefs[pref.key]}
                    onClick={() => setPrefs((p) => ({ ...p, [pref.key]: !p[pref.key] }))}
                    label={pref.label}
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-3.5 border-t border-line-soft pt-4">
              <label className="block">
                <span className="mb-2 block text-[10.5px] font-bold uppercase tracking-[0.04em] text-body">
                  Type d’alertes
                </span>
                <select
                  defaultValue="Toutes"
                  className="w-full rounded-[10px] border-[1.5px] border-line-field bg-field px-3.5 py-3 text-[13px] font-medium text-ink outline-none"
                >
                  <option>Toutes</option>
                  <option>Critiques seulement</option>
                  <option>Critiques et vigilance</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-[10.5px] font-bold uppercase tracking-[0.04em] text-body">
                  Langue
                </span>
                <select
                  defaultValue="Français"
                  className="w-full rounded-[10px] border-[1.5px] border-line-field bg-field px-3.5 py-3 text-[13px] font-medium text-ink outline-none"
                >
                  <option>Français</option>
                  <option>Wolof</option>
                  <option>English</option>
                </select>
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-white p-5.5 shadow-card">
            <p className="m-0 mb-4 text-[15px] font-extrabold text-ink">Sécurité</p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="m-0 text-[13px] font-bold text-ink">Mot de passe</p>
                <p className="m-0 mt-1.5 text-[11.5px] font-medium text-muted">Modifié il y a 3 mois</p>
              </div>
              <button
                type="button"
                className="min-h-[44px] flex-none whitespace-nowrap rounded-[9px] border border-brand-200 bg-brand-50 px-4 text-[12.5px] font-bold text-brand-600 transition-colors hover:bg-brand-100"
              >
                Modifier le mot de passe
              </button>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-navy-900 p-5.5">
            <div className="pointer-events-none absolute -right-[50px] -top-10 h-40 w-40 rounded-full bg-brand-400/[0.09]" />
            <div className="relative flex items-start gap-3.5">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px] bg-brand-400/[0.16] text-brand-400">
                <span className="ic text-[22px]">shield</span>
              </span>
              <div className="min-w-0">
                <p className="m-0 text-sm font-extrabold text-white">Ensemble, plus de sécurité sur nos routes</p>
                <p className="m-0 mt-2 text-[12.5px] leading-relaxed text-[rgba(234,244,248,0.7)]">{impactLine}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
