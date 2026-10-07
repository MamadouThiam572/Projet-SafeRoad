import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { RISK_META, type ClientZone } from '@/data/clientZones'

const SENEGAL_CENTER: [number, number] = [14.5, -15.5]

function dotIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:${color};border:2.5px solid #fff;box-shadow:0 2px 7px rgba(6,35,52,.35);"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  })
}

function MapBridge({ onReady }: { onReady: (map: L.Map) => void }) {
  const map = useMap()
  useEffect(() => {
    onReady(map)
  }, [map, onReady])
  return null
}

function ZonePopup({ zone }: { zone: ClientZone }) {
  const meta = RISK_META[zone.level]
  return (
    <div className="w-[190px]">
      <p className="m-0 text-[13.5px] font-extrabold text-ink">{zone.name}</p>
      <p className={`m-0 mt-1 inline-block rounded-md px-2 py-1 text-[10.5px] font-bold ${meta.softClass} ${meta.textClass}`}>
        {meta.label}
      </p>
      <p className="m-0 mt-1.5 text-[11.5px] text-body">
        {zone.region} · {zone.distanceKm.toString().replace('.', ',')} km
      </p>
    </div>
  )
}

export interface ClientZoneMapHandle {
  focusZone: (id: string) => void
  flyTo: (lat: number, lng: number, zoom?: number) => void
}

interface DriverPosition {
  lat: number
  lng: number
  label?: string
}

interface ClientZoneMapProps {
  zones: ClientZone[]
  /** Quand fourni, affiche un marqueur bleu distinct pour la position du conducteur. */
  driverPosition?: DriverPosition
  center?: [number, number]
  zoom?: number
}

export const ClientZoneMap = forwardRef<ClientZoneMapHandle, ClientZoneMapProps>(function ClientZoneMap(
  { zones, driverPosition, center = SENEGAL_CENTER, zoom = 7 },
  ref,
) {
  const [map, setMap] = useState<L.Map | null>(null)
  const markerRefs = useRef(new Map<string, L.Marker>())

  useImperativeHandle(
    ref,
    () => ({
      focusZone(id: string) {
        const zone = zones.find((z) => z.id === id)
        if (!zone || !map) return
        map.flyTo([zone.lat, zone.lng], 10, { duration: 0.7 })
        map.once('moveend', () => {
          markerRefs.current.get(id)?.openPopup()
        })
      },
      flyTo(lat: number, lng: number, targetZoom = 11) {
        if (!map) return
        map.flyTo([lat, lng], targetZoom, { duration: 0.7 })
      },
    }),
    [map, zones],
  )

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: '#dceaf2' }}>
      <MapContainer center={center} zoom={zoom} className="h-full w-full">
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <MapBridge onReady={setMap} />

        {zones.map((zone) => (
          <Marker
            key={zone.id}
            position={[zone.lat, zone.lng]}
            icon={dotIcon(RISK_META[zone.level].colorHex)}
            ref={(instance) => {
              if (instance) markerRefs.current.set(zone.id, instance)
              else markerRefs.current.delete(zone.id)
            }}
          >
            <Popup minWidth={190} maxWidth={210}>
              <ZonePopup zone={zone} />
            </Popup>
          </Marker>
        ))}

        {driverPosition && (
          <Marker position={[driverPosition.lat, driverPosition.lng]} icon={dotIcon('#2b6cb0')}>
            <Popup minWidth={140}>
              <p className="m-0 text-[13px] font-bold text-ink">{driverPosition.label ?? 'Votre position'}</p>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      <div className="pointer-events-none absolute right-3.5 top-3.5 z-[500] rounded-xl bg-white p-3.5 shadow-[0_8px_24px_rgba(6,35,52,.18)]">
        <div className="flex flex-col gap-2">
          {(['critique', 'vigilance', 'normale'] as const).map((level) => (
            <span key={level} className="flex items-center gap-2.5 text-[11.5px] font-semibold text-ink">
              <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: RISK_META[level].colorHex }} />
              {RISK_META[level].label}
            </span>
          ))}
          {driverPosition && (
            <span className="flex items-center gap-2.5 text-[11.5px] font-semibold text-ink">
              <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: '#2b6cb0' }} />
              Votre position
            </span>
          )}
        </div>
      </div>
    </div>
  )
})
