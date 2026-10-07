import { useMemo, useState } from 'react'
import { RegionMap } from '@/components/admin/RegionMap'
import { useAuth } from '@/context/AuthContext'
import { ADMIN_REGION_ZONES, type RiskLevel } from '@/data/adminHome'
import { CONNECTED_VEHICLES, VEHICLE_STATUS_META, type VehicleStatus } from '@/data/adminCarte'
import { regionCenter, regionLabel } from '@/lib/regions'

const LEVEL_META: Record<RiskLevel, { label: string; color: string }> = {
  critique: { label: 'Critique', color: '#dc3a2f' },
  vigilance: { label: 'Vigilance', color: '#e8940c' },
  normale: { label: 'Normal', color: '#1f9d55' },
}

const VEHICLE_LEVELS: VehicleStatus[] = ['en_route', 'stationne', 'hors_ligne']

/** Hauteur réelle du bandeau d'en-tête (Header) partagé par les layouts Dashboard — mesurée précisément. */
const HEADER_HEIGHT_PX = 75

function LayerToggle({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: string
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl border-[1.5px] px-3 py-2 text-[12px] font-bold transition-colors ${
        active ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-line text-faint hover:border-line-field'
      }`}
    >
      <span className="ic text-base">{icon}</span>
      {label}
    </button>
  )
}

export function CarteRegionalePage() {
  const { user } = useAuth()
  const region = regionLabel(user?.region)
  const center = useMemo(() => regionCenter(user?.region), [user?.region])
  const [showZones, setShowZones] = useState(true)
  const [showVehicles, setShowVehicles] = useState(true)

  const activeVehicles = CONNECTED_VEHICLES.filter((v) => v.status === 'en_route').length

  return (
    <div className="relative -mb-8" style={{ height: `calc(100vh - ${HEADER_HEIGHT_PX}px)` }}>
      <RegionMap center={center} zones={ADMIN_REGION_ZONES} showZones={showZones} showVehicles={showVehicles} />

      {/* Bandeau flottant supérieur : titre + compteurs, et bascule des calques */}
      <div className="pointer-events-none absolute inset-x-4 top-4 z-[1000] flex flex-wrap items-start justify-between gap-3">
        <div className="pointer-events-auto rounded-2xl border border-line bg-white/95 px-4 py-3 shadow-card backdrop-blur">
          <h1 className="m-0 text-[17px] font-extrabold text-ink">Carte régionale</h1>
          <p className="m-0 mt-0.5 text-[12px] font-semibold text-body">
            Vue 360° · {region} · {ADMIN_REGION_ZONES.length} zones à risque · {activeVehicles} véhicule
            {activeVehicles > 1 ? 's' : ''} en circulation
          </p>
        </div>

        <div className="pointer-events-auto flex flex-col gap-2 rounded-2xl border border-line bg-white/95 p-3 shadow-card backdrop-blur">
          <p className="m-0 px-1 text-[10.5px] font-bold uppercase tracking-wide text-faint">Calques</p>
          <LayerToggle
            active={showZones}
            icon="crisis_alert"
            label="Zones à risque"
            onClick={() => setShowZones((v) => !v)}
          />
          <LayerToggle
            active={showVehicles}
            icon="directions_car"
            label="Véhicules connectés"
            onClick={() => setShowVehicles((v) => !v)}
          />
        </div>
      </div>

      {/* Légende flottante inférieure */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-[1000] rounded-2xl border border-line bg-white/95 px-4 py-3.5 shadow-card backdrop-blur">
        <p className="m-0 mb-2 text-[10.5px] font-bold uppercase tracking-wide text-faint">Légende</p>
        <div className="flex flex-col gap-1.5">
          {(Object.keys(LEVEL_META) as RiskLevel[]).map((level) => (
            <span key={level} className="flex items-center gap-2.5 text-[11.5px] font-semibold text-ink">
              <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: LEVEL_META[level].color }} />
              {LEVEL_META[level].label}
            </span>
          ))}
          <span className="my-1 h-px bg-line-soft" />
          {VEHICLE_LEVELS.map((status) => (
            <span key={status} className="flex items-center gap-2.5 text-[11.5px] font-semibold text-ink">
              <span
                className="h-2.5 w-2.5 flex-none rounded-full"
                style={{ background: VEHICLE_STATUS_META[status].color }}
              />
              {VEHICLE_STATUS_META[status].label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
