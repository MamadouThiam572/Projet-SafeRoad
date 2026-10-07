import { useEffect, useRef } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { DEMO_ZONES, SENEGAL_BOUNDS, STATUS_META, type RiskZone, type ZoneStatus } from '@/data/riskZones'

/**
 * Icône de marqueur — un simple disque coloré (pas l'épingle bleue par
 * défaut de Leaflet) pour rester cohérent avec la légende du reste du site.
 * Construit en HTML brut : c'est ce que Leaflet affiche directement dans le
 * DOM de la carte, hors de l'arbre React, donc en CSS inline plutôt qu'en
 * classes Tailwind.
 */
function zoneIcon(status: ZoneStatus) {
  const { color } = STATUS_META[status]
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:${color};border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  })
}

/**
 * La colonne du hero (Accueil) se réorganise en CSS pur — 2 colonnes qui
 * s'empilent en 1 sous 692px (voir AccueilPage). Leaflet fige la taille de
 * sa carte au montage ; sans ça, la carte reste coupée/décentrée après un
 * redimensionnement du conteneur.
 */
function MapResizeHandler() {
  const map = useMap()
  const containerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const container = map.getContainer()
    containerRef.current = container
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(container)
    return () => observer.disconnect()
  }, [map])

  return null
}

interface SafeRoadMapProps {
  /** compact : vignette du hero (Accueil) — full : page Carte dédiée */
  variant?: 'compact' | 'full'
  zones?: RiskZone[]
  /**
   * false : désactive pan/zoom/popups et rend le calque inerte aux clics
   * (pointer-events-none) — pour un aperçu posé dans une carte cliquable
   * (DemoPanel) qui renvoie vers la page Carte, pas un deuxième widget à
   * piloter en parallèle du vrai.
   */
  interactive?: boolean
  /** true : retire l'arrondi/l'ombre/la largeur max propres au composant, pour un cadre déjà fourni par le parent (DemoPanel). */
  frameless?: boolean
}

export function SafeRoadMap({
  variant = 'full',
  zones = DEMO_ZONES,
  interactive = true,
  frameless = false,
}: SafeRoadMapProps) {
  const compact = variant === 'compact'

  const sizingClass = compact
    ? `relative aspect-[4/3] w-full ${frameless ? '' : 'ml-auto max-w-md overflow-hidden rounded-[20px] shadow-card'}`
    : `relative h-[70vh] min-h-[440px] w-full ${frameless ? '' : 'overflow-hidden rounded-[20px] shadow-card'}`

  return (
    <div className={`${sizingClass} ${interactive ? '' : 'pointer-events-none'}`}>
      <MapContainer
        bounds={SENEGAL_BOUNDS}
        boundsOptions={{ padding: compact ? [6, 6] : [24, 24] }}
        className="h-full w-full"
        /*
         * scrollWheelZoom désactivé en mode compact : le widget est posé
         * dans le flux de la page d'accueil, et une carte qui capte la
         * molette empêcherait de faire défiler la page en passant dessus.
         * Le zoom reste possible (boutons, double-clic, pincement tactile).
         * En mode non interactif, toutes les interactions sont coupées :
         * c'est un aperçu, le clic doit atteindre le lien qui l'entoure.
         */
        scrollWheelZoom={interactive && !compact}
        dragging={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        keyboard={interactive}
        zoomControl={interactive}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <MapResizeHandler />

        {zones.map((zone) => (
          <Marker key={zone.id} position={[zone.lat, zone.lng]} icon={zoneIcon(zone.status)}>
            {interactive && (
              <Popup>
                <div className="min-w-[180px]">
                  <p className="m-0 text-[13px] font-bold text-ink">{zone.name}</p>
                  <p className="m-0 text-[11.5px] text-body">{zone.region}</p>
                  <p className="mt-1.5 text-[12px] leading-[1.5] text-body">{zone.note}</p>
                </div>
              </Popup>
            )}
          </Marker>
        ))}
      </MapContainer>

      {!frameless && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] flex flex-col gap-1.5 rounded-xl bg-white/95 p-2.5 shadow-card backdrop-blur">
          <p className="m-0 px-0.5 text-[10px] font-extrabold uppercase tracking-wide text-faint">Légende des zones</p>
          {(Object.keys(STATUS_META) as ZoneStatus[]).map((key) => (
            <div key={key} className="flex items-center gap-1.5 text-[10.5px] font-semibold text-body">
              <span className={`h-2 w-2 rounded-full ${STATUS_META[key].dotClass}`} />
              {STATUS_META[key].label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
