import { Fragment } from 'react'
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { AdminZone, RiskLevel } from '@/data/adminHome'
import { CONNECTED_VEHICLES, VEHICLE_STATUS_META, type ConnectedVehicle } from '@/data/adminCarte'
import { offsetLatLng } from '@/lib/regions'

const LEVEL_META: Record<RiskLevel, { label: string; color: string; soft: string; text: string }> = {
  critique: { label: 'Critique', color: '#dc3a2f', soft: '#fdeeec', text: '#dc3a2f' },
  vigilance: { label: 'Vigilance', color: '#e8940c', soft: '#fdf4e6', text: '#e8940c' },
  normale: { label: 'Normal', color: '#1f9d55', soft: '#e9f6ee', text: '#1f9d55' },
}

function vehicleIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<span style="display:flex;align-items:center;justify-content:center;overflow:hidden;width:26px;height:26px;border-radius:9999px;background:${color};border:2.5px solid #fff;box-shadow:0 2px 8px rgba(6,35,52,.35);"><span class="ic" style="font-size:14px;line-height:1;color:#fff;">navigation</span></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
  })
}

interface RegionMapProps {
  /** Centre réel de la carte — le centre de la région connectée (src/lib/regions.ts), pas Dakar en dur. */
  center: [number, number]
  zones: AdminZone[]
  vehicles?: ConnectedVehicle[]
  showZones: boolean
  showVehicles: boolean
}

export function RegionMap({ center, zones, vehicles = CONNECTED_VEHICLES, showZones, showVehicles }: RegionMapProps) {
  return (
    <MapContainer center={center} zoom={12} className="h-full w-full" zoomControl={false}>
      <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      {showZones &&
        zones.map((zone) => {
          const meta = LEVEL_META[zone.level]
          return (
            <CircleMarker
              key={zone.id}
              center={offsetLatLng(center, zone.offset)}
              radius={10 + Math.min(zone.incidents / 3, 12)}
              pathOptions={{ color: '#fff', weight: 2, fillColor: meta.color, fillOpacity: 0.85 }}
            >
              <Popup>
                <div className="w-[190px]">
                  <p className="m-0 text-[13.5px] font-extrabold text-ink">{zone.name}</p>
                  <p
                    className="m-0 mt-1 inline-block rounded-md px-2 py-1 text-[10.5px] font-bold"
                    style={{ background: meta.soft, color: meta.text }}
                  >
                    Zone {meta.label.toLowerCase()}
                  </p>
                  <p className="m-0 mt-1.5 text-[11.5px] text-body">
                    {zone.incidents} incident{zone.incidents > 1 ? 's' : ''} · {zone.avgSpeed} km/h (moy.)
                  </p>
                  <p className="m-0 mt-1 text-[11px] text-faint">Dernière détection : {zone.lastDetection}</p>
                </div>
              </Popup>
            </CircleMarker>
          )
        })}

      {showVehicles &&
        vehicles.map((v) => {
          const meta = VEHICLE_STATUS_META[v.status]
          const path = v.path.map((point) => offsetLatLng(center, point))
          const current = path[path.length - 1]
          return (
            <Fragment key={v.id}>
              <Polyline
                positions={path}
                pathOptions={{
                  color: meta.color,
                  weight: 3,
                  opacity: 0.65,
                  dashArray: v.status === 'hors_ligne' ? '2 7' : undefined,
                }}
              />
              <Marker position={current} icon={vehicleIcon(meta.color)}>
                <Popup>
                  <div className="w-[190px]">
                    <p className="m-0 text-[13.5px] font-extrabold text-ink">{v.matricule}</p>
                    <p className="m-0 mt-0.5 text-[11.5px] text-body">{v.driverName}</p>
                    <p
                      className="m-0 mt-1 inline-block rounded-md px-2 py-1 text-[10.5px] font-bold"
                      style={{ background: meta.soft, color: meta.text }}
                    >
                      {meta.label}
                    </p>
                    <p className="m-0 mt-1.5 text-[11.5px] text-body">
                      {v.speed} km/h · {v.lastUpdate}
                    </p>
                  </div>
                </Popup>
              </Marker>
            </Fragment>
          )
        })}
    </MapContainer>
  )
}
