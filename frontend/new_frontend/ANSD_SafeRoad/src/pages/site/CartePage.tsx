import { useMemo, useRef, useState } from 'react'
import { LocalityMap, type LocalityMapHandle } from '@/components/carte/LocalityMap'
import {
  LOCALITIES,
  REGIONS,
  ROAD_TYPE_LABELS,
  STATUS_META,
  type RoadType,
  type ZoneStatus,
} from '@/data/localities'
import { useNarrowGrid } from '@/hooks/useNarrowGrid'

const ROAD_TYPES: RoadType[] = ['autoroute', 'nationale', 'regionale', 'voirie_urbaine']
const STATUSES: ZoneStatus[] = ['validee', 'a_examiner', 'observation', 'normale']
const PERIODS = ['24 dernières heures', '7 derniers jours', '30 derniers jours', '12 derniers mois'] as const

const REGION_ALL = 'Toutes les régions'
const ROAD_TYPE_ALL = 'Tous les types'
const STATUS_ALL = 'Tous les statuts'

interface FilterState {
  region: string
  roadType: string
  status: string
  /** Présent mais inopérant — voir fiche §6 : le registre ne porte qu'un agrégat sur 30 jours. */
  period: string
}

const DEFAULT_FILTERS: FilterState = {
  region: REGION_ALL,
  roadType: ROAD_TYPE_ALL,
  status: STATUS_ALL,
  period: '30 derniers jours',
}

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
    <label className="block">
      <span className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wide text-faint">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-[41px] w-full appearance-none rounded-[11px] border-[1.5px] border-line-field bg-field px-3 pr-8 text-sm font-medium text-ink outline-none focus:border-brand-600"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="ic pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-lg text-faint">
          expand_more
        </span>
      </div>
    </label>
  )
}

function CounterCard({
  value,
  label,
  toneClass,
  bgClass,
  borderClass,
}: {
  value: number
  label: string
  toneClass: string
  bgClass: string
  borderClass: string
}) {
  return (
    <div
      className={`rounded-[14px] border border-line ${bgClass} border-l-4 ${borderClass} p-4 shadow-card transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-card-hover`}
    >
      <p className={`m-0 text-[24px] font-extrabold ${toneClass}`}>{value}</p>
      <p className="mt-1 text-[12.5px] font-semibold text-body">{label}</p>
    </div>
  )
}

export function CartePage() {
  const [draft, setDraft] = useState<FilterState>(DEFAULT_FILTERS)
  const [applied, setApplied] = useState<FilterState>(DEFAULT_FILTERS)
  const [gridRef, isNarrow] = useNarrowGrid<HTMLDivElement>(820)
  const mapRef = useRef<LocalityMapHandle>(null)

  /*
   * Un seul prédicat, appliqué une fois sur « Appliquer » plutôt qu'à
   * chaque frappe — sinon la carte clignoterait pendant qu'on compose un
   * croisement de plusieurs critères. Liste et carte lisent ce même
   * résultat : elles ne peuvent donc pas diverger (fiche §4).
   */
  const filtered = useMemo(() => {
    return LOCALITIES.filter((loc) => {
      if (applied.region !== REGION_ALL && loc.region !== applied.region) return false
      if (applied.roadType !== ROAD_TYPE_ALL && loc.roadType !== applied.roadType) return false
      if (applied.status !== STATUS_ALL && loc.status !== applied.status) return false
      return true
    })
  }, [applied])

  const counters = useMemo(
    () => ({
      validee: filtered.filter((l) => l.status === 'validee').length,
      aExaminer: filtered.filter((l) => l.status === 'a_examiner').length,
      observation: filtered.filter((l) => l.status === 'observation').length,
      boitiers: filtered.reduce((sum, l) => sum + l.boitiers, 0),
    }),
    [filtered],
  )

  return (
    <div className="bg-field pb-16">
      {/* Bandeau d'en-tête coloré — dégradé navy → turquoise SafeRoad, pour casser l'uniformité du fond gris-bleu. */}
      <div className="bg-linear-to-r from-navy-900 to-brand-700 pb-10 pt-10">
        <div className="mx-auto max-w-[1400px] px-[26px]">
          <span className="text-kicker text-brand-200">Carte publique</span>
          <h1 className="text-section-title mt-2 text-white">Carte des zones à risque</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-[1.7] text-white/80">
            Consultez en temps réel les zones à risque identifiées sur le réseau routier sénégalais.
          </p>
        </div>
      </div>

      <div
        ref={gridRef}
        className={
          isNarrow
            ? 'mx-auto flex max-w-[1400px] flex-col gap-[22px] px-[26px] pt-8'
            : 'mx-auto grid max-w-[1400px] items-start gap-[22px] px-[26px] pt-8 [grid-template-columns:minmax(270px,330px)_minmax(0,1fr)]'
        }
      >
        {/* Colonne de commandes */}
        <div className="flex flex-col gap-[18px]">
          <div className="rounded-[18px] border border-line bg-white p-[22px] shadow-card">
            <p className="text-card-title m-0 text-ink">Filtres</p>
            <div className="mt-4 flex flex-col gap-3.5">
              <FilterSelect
                label="Région"
                value={draft.region}
                onChange={(v) => setDraft((d) => ({ ...d, region: v }))}
                options={[REGION_ALL, ...REGIONS].map((r) => ({ value: r, label: r }))}
              />
              <FilterSelect
                label="Type de route"
                value={draft.roadType}
                onChange={(v) => setDraft((d) => ({ ...d, roadType: v }))}
                options={[
                  { value: ROAD_TYPE_ALL, label: ROAD_TYPE_ALL },
                  ...ROAD_TYPES.map((t) => ({ value: t, label: ROAD_TYPE_LABELS[t] })),
                ]}
              />
              <FilterSelect
                label="Statut de la zone"
                value={draft.status}
                onChange={(v) => setDraft((d) => ({ ...d, status: v }))}
                options={[
                  { value: STATUS_ALL, label: STATUS_ALL },
                  ...STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label })),
                ]}
              />
              <FilterSelect
                label="Période"
                value={draft.period}
                onChange={(v) => setDraft((d) => ({ ...d, period: v }))}
                options={PERIODS.map((p) => ({ value: p, label: p }))}
              />
            </div>

            <button
              type="button"
              onClick={() => setApplied(draft)}
              className="mt-4 flex h-[41px] w-full items-center justify-center rounded-[11px] bg-brand-600 text-sm font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-card-hover"
            >
              Appliquer
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(DEFAULT_FILTERS)
                setApplied(DEFAULT_FILTERS)
              }}
              className="mt-2 flex h-9 w-full items-center justify-center rounded-[9px] text-center text-sm font-semibold text-faint transition-colors duration-200 hover:bg-page hover:text-body"
            >
              Réinitialiser
            </button>
          </div>

          <div className="rounded-[18px] border border-line bg-white p-[22px] shadow-card">
            <p className="text-card-title m-0 text-ink">Légende</p>
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <span className="ic flex-none text-2xl text-danger-600">place</span>
                <span className="text-[13px] font-semibold text-body">{STATUS_META.validee.label}</span>
              </div>
              {(['observation', 'a_examiner', 'normale'] as ZoneStatus[]).map((s) => (
                <div key={s} className="flex items-center gap-2.5">
                  <span
                    className={`flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-[12px] font-extrabold text-white ${STATUS_META[s].bgClass}`}
                  >
                    {STATUS_META[s].glyph}
                  </span>
                  <span className="text-[13px] font-semibold text-body">{STATUS_META[s].label}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11.5px] text-faint">Cliquez sur un marqueur pour ouvrir la fiche de la localité.</p>
          </div>

          <div className="rounded-[18px] border border-line bg-white p-[22px] shadow-card">
            <p className="text-card-title m-0 text-ink">Zones affichées</p>
            <p className="mt-1 text-[12px] text-faint">{filtered.length} localités correspondant aux filtres</p>
            <div className="mt-3 flex max-h-[330px] flex-col gap-1 overflow-y-auto">
              {filtered.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => mapRef.current?.focusLocality(loc.id)}
                  className="group flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors duration-200 hover:bg-page"
                >
                  <span
                    className={`h-[9px] w-[9px] flex-none rounded-full transition-transform duration-200 group-hover:scale-125 ${STATUS_META[loc.status].bgClass}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-extrabold text-ink">{loc.name}</span>
                    <span className="block truncate text-[11.5px] text-faint">
                      {loc.region} · {loc.incidents30d} incidents · {loc.lastDetection}
                    </span>
                  </span>
                  <span className="ic flex-none text-base text-faint transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-brand-600">
                    chevron_right
                  </span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-3 py-4 text-center text-[12.5px] text-faint">Aucune localité ne correspond à ces filtres.</p>
              )}
            </div>
          </div>
        </div>

        {/* Colonne cartographique */}
        <div className="flex flex-col gap-[14px]">
          <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
            <CounterCard
              value={counters.validee}
              label="Zones à risque validées"
              toneClass="text-danger-600"
              bgClass="bg-danger-50"
              borderClass="border-l-danger-600"
            />
            <CounterCard
              value={counters.aExaminer}
              label="Localités à examiner"
              toneClass="text-[#7c3aed]"
              bgClass="bg-[#7c3aed]/10"
              borderClass="border-l-[#7c3aed]"
            />
            <CounterCard
              value={counters.observation}
              label="En observation"
              toneClass="text-warning-600"
              bgClass="bg-warning-50"
              borderClass="border-l-warning-600"
            />
            <CounterCard
              value={counters.boitiers}
              label="Boîtiers actifs"
              toneClass="text-ink"
              bgClass="bg-brand-50"
              borderClass="border-l-brand-600"
            />
          </div>

          <div style={{ height: 'min(72vh, 660px)', minHeight: 440 }}>
            <LocalityMap ref={mapRef} localities={filtered} />
          </div>

          <p className="text-[11.5px] text-faint">
            Données de démonstration. L'architecture prévoit le branchement de la couche zones sur l'API SafeRoad
            (mêmes champs, mêmes statuts, dernière détection en direct).
          </p>
        </div>
      </div>
    </div>
  )
}
