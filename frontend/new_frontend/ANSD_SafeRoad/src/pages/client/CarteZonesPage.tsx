import { useMemo, useRef, useState } from 'react'
import { ClientZoneMap, type ClientZoneMapHandle } from '@/components/client/ClientZoneMap'
import {
  CLIENT_REGIONS,
  CLIENT_ZONES,
  RISK_META,
  ROAD_TYPE_LABELS_CLIENT,
  type ClientZone,
} from '@/data/clientZones'

const REGION_ALL = 'Toutes les régions'
const ROAD_TYPE_ALL = 'Tous les types'
const LEVEL_ALL = 'Tous les niveaux'

interface FilterState {
  region: string
  roadType: string
  level: string
}

const DEFAULT_FILTERS: FilterState = { region: REGION_ALL, roadType: ROAD_TYPE_ALL, level: LEVEL_ALL }

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-[10.5px] font-bold uppercase tracking-wide text-body">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-[45px] w-full appearance-none rounded-[10px] border-[1.5px] border-line-field bg-field px-3 text-[13px] font-medium text-ink outline-none focus:border-brand-600"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function ZoneRow({ zone, onFocus }: { zone: ClientZone; onFocus: (id: string) => void }) {
  const meta = RISK_META[zone.level]
  return (
    <button
      type="button"
      onClick={() => onFocus(zone.id)}
      className="flex w-full items-start gap-3 rounded-xl border border-line-soft bg-surface p-3.5 text-left transition-colors hover:border-brand-200 hover:bg-brand-50/40"
    >
      <span className="mt-1.5 h-2.5 w-2.5 flex-none rounded-full" style={{ background: meta.colorHex }} />
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[13px] font-extrabold text-ink">{zone.name}</p>
        <p className="m-0 mt-1 text-[11.5px] font-medium text-muted">{zone.region}</p>
        <span className={`mt-1.5 inline-block rounded-md px-2 py-1 text-[10px] font-bold ${meta.softClass} ${meta.textClass}`}>
          {meta.label}
        </span>
      </div>
      <span className="ic mt-0.5 flex-none text-lg text-icon-muted">chevron_right</span>
    </button>
  )
}

export function CarteZonesPage() {
  const [draft, setDraft] = useState<FilterState>(DEFAULT_FILTERS)
  const [applied, setApplied] = useState<FilterState>(DEFAULT_FILTERS)
  const mapRef = useRef<ClientZoneMapHandle>(null)

  const filteredZones = useMemo(() => {
    return CLIENT_ZONES.filter((z) => {
      if (applied.region !== REGION_ALL && z.region !== applied.region) return false
      if (applied.roadType !== ROAD_TYPE_ALL && ROAD_TYPE_LABELS_CLIENT[z.roadType] !== applied.roadType) return false
      if (applied.level !== LEVEL_ALL && RISK_META[z.level].label !== applied.level) return false
      return true
    })
  }, [applied])

  return (
    <div>
      <section className="mx-6 mt-5">
        <h1 className="text-[clamp(23px,2.8vw,30px)] font-extrabold leading-[1.15] tracking-[-0.026em] text-ink">
          Carte des zones à risque
        </h1>
        <p className="mt-2.5 text-sm leading-6 text-body">
          Consultez en temps réel les zones à risque sur votre secteur de circulation.
        </p>
      </section>

      <section className="mx-6 mt-4 rounded-2xl border border-line bg-white p-4 shadow-card sm:p-[18px]">
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto_auto]">
          <FilterSelect
            label="RÉGION"
            value={draft.region}
            onChange={(v) => setDraft((d) => ({ ...d, region: v }))}
            options={[REGION_ALL, ...CLIENT_REGIONS].map((r) => ({ value: r, label: r }))}
          />
          <FilterSelect
            label="TYPE DE ROUTE"
            value={draft.roadType}
            onChange={(v) => setDraft((d) => ({ ...d, roadType: v }))}
            options={[ROAD_TYPE_ALL, ...Object.values(ROAD_TYPE_LABELS_CLIENT)].map((r) => ({ value: r, label: r }))}
          />
          <FilterSelect
            label="NIVEAU DE RISQUE"
            value={draft.level}
            onChange={(v) => setDraft((d) => ({ ...d, level: v }))}
            options={[LEVEL_ALL, ...Object.values(RISK_META).map((m) => m.label)].map((r) => ({ value: r, label: r }))}
          />
          <button
            type="button"
            onClick={() => {
              setDraft(DEFAULT_FILTERS)
              setApplied(DEFAULT_FILTERS)
            }}
            className="h-[45px] whitespace-nowrap rounded-[10px] border border-line bg-page px-[18px] text-[13px] font-semibold text-body transition-colors hover:bg-line-soft"
          >
            Réinitialiser
          </button>
          <button
            type="button"
            onClick={() => setApplied(draft)}
            className="h-[45px] whitespace-nowrap rounded-[10px] bg-brand-600 px-[22px] text-[13px] font-bold text-white transition-colors hover:bg-brand-700"
          >
            Appliquer
          </button>
        </div>
      </section>

      <section className="mx-6 mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div
          className="relative overflow-hidden rounded-[18px] border border-line shadow-card"
          style={{ height: 'min(66vh, 560px)', minHeight: 400 }}
        >
          <ClientZoneMap ref={mapRef} zones={filteredZones} />
        </div>

        <div className="min-w-0 overflow-hidden rounded-[18px] border border-line bg-white shadow-card">
          <div className="flex items-center gap-3 border-b border-line-soft px-5 py-[18px]">
            <p className="m-0 flex-1 text-[15px] font-extrabold text-ink">Liste des zones</p>
            <span className="flex-none whitespace-nowrap rounded-md bg-brand-50 px-2.5 py-1.5 text-[11px] font-bold text-brand-700">
              {filteredZones.length} {filteredZones.length > 1 ? 'zones' : 'zone'}
            </span>
          </div>
          <div className="flex flex-col gap-2.5 p-3" style={{ maxHeight: 'min(58vh, 470px)', overflow: 'auto' }}>
            {filteredZones.map((zone) => (
              <ZoneRow key={zone.id} zone={zone} onFocus={(id) => mapRef.current?.focusZone(id)} />
            ))}
            {filteredZones.length === 0 && (
              <div className="px-4 py-9 text-center">
                <span className="ic text-3xl text-icon-muted">filter_alt_off</span>
                <p className="mt-2.5 text-[13.5px] font-extrabold text-ink">Aucune zone pour ces filtres</p>
                <p className="mt-1 text-xs leading-6 text-body">Réinitialisez pour revoir tout le réseau.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
