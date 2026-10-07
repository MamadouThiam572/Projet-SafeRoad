import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ROAD_TYPE_LABELS, STATUS_META, type Locality } from '@/data/localities'

/** Centre géographique retenu pour cadrer tout le pays au premier chargement. */
const SENEGAL_CENTER: [number, number] = [14.5, -15.0]

/**
 * Zone validée : le glyphe "place" est déjà, en lui-même, une forme de
 * pastille/goutte — l'envelopper dans une deuxième forme de pastille aurait
 * fait un pin dans un pin. On le pose donc directement, en grand, dans la
 * couleur du statut.
 */
function pinIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<span class="ic" style="display:block;font-size:34px;line-height:1;color:${color};filter:drop-shadow(0 3px 5px rgba(0,0,0,.35));">place</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 32],
    popupAnchor: [0, -30],
  })
}

/** Les trois autres statuts : pastille de 26 px avec le glyphe correspondant (!, ?, ✓). */
function badgeIcon(color: string, glyph: string) {
  return L.divIcon({
    className: '',
    html: `<span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9999px;background:${color};color:#fff;font-size:13px;font-weight:800;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);">${glyph}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
  })
}

/** Remonte l'instance Leaflet au composant parent — MapContainer ne l'expose pas directement. */
function MapBridge({ onReady }: { onReady: (map: L.Map) => void }) {
  const map = useMap()
  useEffect(() => {
    onReady(map)
  }, [map, onReady])
  return null
}

function EvolutionValue({ pct }: { pct: number }) {
  const tone = pct > 0 ? 'text-danger-600' : pct < 0 ? 'text-success-600' : 'text-ink'
  const sign = pct > 0 ? '+' : ''
  return <p className={`m-0 text-[15px] font-extrabold ${tone}`}>{sign}{pct}%</p>
}

function LocalityCard({ loc }: { loc: Locality }) {
  const meta = STATUS_META[loc.status]
  return (
    <div className="max-h-[300px] w-[246px] overflow-y-auto pr-1">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 flex-none rounded-full ${meta.bgClass}`} />
        <p className="m-0 text-[10.5px] font-bold uppercase tracking-wide text-faint">{meta.label}</p>
      </div>
      <p className="m-0 mt-1.5 text-[14px] font-extrabold text-ink">{loc.name}</p>
      <p className="m-0 text-[11.5px] text-body">
        {loc.region} · {ROAD_TYPE_LABELS[loc.roadType]}
      </p>
      <p className="m-0 mt-0.5 text-[11px] text-faint">{loc.axisRange}</p>

      <div className="mt-3 grid grid-cols-2 gap-y-2">
        <div>
          <p className="m-0 text-[15px] font-extrabold text-ink">{loc.incidents30d}</p>
          <p className="m-0 text-[10px] text-faint">incidents / 30 j</p>
        </div>
        <div>
          <p className="m-0 text-[15px] font-extrabold text-ink">{loc.alerts30d}</p>
          <p className="m-0 text-[10px] text-faint">alertes</p>
        </div>
        <div>
          <p className="m-0 text-[15px] font-extrabold text-ink">{loc.events30d}</p>
          <p className="m-0 text-[10px] text-faint">événements</p>
        </div>
        <div>
          <EvolutionValue pct={loc.evolutionPct} />
          <p className="m-0 text-[10px] text-faint">évolution / 30 j</p>
        </div>
      </div>

      <p className="m-0 mt-3 text-[11px] leading-[1.5] text-body">
        <span className="font-bold text-ink">Périodes critiques : </span>
        {loc.criticalPeriods}
      </p>
      <p className="m-0 mt-1 text-[11px] text-body">
        <span className="font-bold text-ink">Boîtiers : </span>
        {loc.boitiers}
      </p>
      <p className="m-0 mt-1 text-[11px] text-body">
        <span className="font-bold text-ink">Dernière détection : </span>
        {loc.lastDetection}
      </p>

      {loc.riskTypes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {loc.riskTypes.map((t) => (
            <span key={t} className="rounded-full bg-page px-2 py-1 text-[10px] font-semibold text-body">
              {t}
            </span>
          ))}
        </div>
      )}

      {loc.status === 'validee' && (
        <div className="mt-3 border-t border-line pt-2.5">
          <p className="m-0 text-[11px] text-body">
            <span className="font-bold text-ink">Validée par : </span>
            {loc.validator}
          </p>
          <p className="m-0 mt-0.5 text-[11px] text-body">
            <span className="font-bold text-ink">Le : </span>
            {loc.validatedAt}
          </p>
          <p className="m-0 mt-1.5 text-[11px] italic leading-[1.5] text-body">« {loc.justification} »</p>
        </div>
      )}
    </div>
  )
}

export interface LocalityMapHandle {
  /** Recentre à zoom 10 (700ms) sur la localité, puis ouvre sa fiche une fois le déplacement terminé. */
  focusLocality: (id: string) => void
}

interface LocalityMapProps {
  localities: Locality[]
}

/**
 * Carte dédiée à la page Carte — distincte de SafeRoadMap (page d'accueil) :
 * marqueurs à deux formes (épingle / pastille glyphe), disques d'influence
 * en rayon réel, fiche détaillée, double-clic désactivé, zoom personnalisé
 * (facteur ×1,6, 300 ms), et une méthode impérative pour que la liste
 * latérale puisse recentrer la carte sans dupliquer sa propre logique.
 */
export const LocalityMap = forwardRef<LocalityMapHandle, LocalityMapProps>(function LocalityMap(
  { localities },
  ref,
) {
  const [map, setMap] = useState<L.Map | null>(null)
  const markerRefs = useRef(new Map<string, L.Marker>())

  useImperativeHandle(
    ref,
    () => ({
      focusLocality(id: string) {
        const loc = localities.find((l) => l.id === id)
        if (!loc || !map) return
        map.flyTo([loc.lat, loc.lng], 10, { duration: 0.7 })
        map.once('moveend', () => {
          markerRefs.current.get(id)?.openPopup()
        })
      },
    }),
    [map, localities],
  )

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-[20px]"
      style={{ background: '#DCEAF2', boxShadow: '0 8px 30px rgba(15,35,45,.18)' }}
    >
      {/* Le zoom par défaut de Leaflet anime en ~250ms ; la fiche demande 300ms. */}
      <style>{'.sr-carte-map .leaflet-zoom-anim .leaflet-zoom-animated{transition-duration:300ms;}'}</style>

      <MapContainer
        center={SENEGAL_CENTER}
        zoom={7}
        zoomControl={false}
        doubleClickZoom={false}
        zoomSnap={0}
        zoomDelta={Math.log2(1.6)}
        className="sr-carte-map h-full w-full"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <MapBridge onReady={setMap} />

        {localities.map((loc) => {
          const meta = STATUS_META[loc.status]
          const radius = meta.baseRadiusM + Math.min(loc.incidents30d, 40) * 15
          return (
            <Circle
              key={`${loc.id}-circle`}
              center={[loc.lat, loc.lng]}
              radius={radius}
              pathOptions={{ color: meta.color, fillColor: meta.color, fillOpacity: 0.14, weight: 1, opacity: 0.35 }}
            />
          )
        })}

        {localities.map((loc) => {
          const meta = STATUS_META[loc.status]
          const icon = loc.status === 'validee' ? pinIcon(meta.color) : badgeIcon(meta.color, meta.glyph)
          return (
            <Marker
              key={loc.id}
              position={[loc.lat, loc.lng]}
              icon={icon}
              ref={(instance) => {
                if (instance) markerRefs.current.set(loc.id, instance)
                else markerRefs.current.delete(loc.id)
              }}
            >
              <Popup minWidth={250} maxWidth={274}>
                <LocalityCard loc={loc} />
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>

      {/*
       * Boutons +/- personnalisés (32px, coin supérieur gauche) plutôt que
       * le contrôle Leaflet par défaut, pour tenir le gabarit exact de la
       * fiche — ils réutilisent le zoomDelta configuré sur la carte (×1,6).
       */}
      {map && (
        <div className="absolute left-3 top-3 z-[1000] flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => map.zoomIn()}
            aria-label="Zoomer"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-lg font-bold text-ink shadow-card transition-colors hover:bg-page"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => map.zoomOut()}
            aria-label="Dézoomer"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-lg font-bold text-ink shadow-card transition-colors hover:bg-page"
          >
            −
          </button>
        </div>
      )}
    </div>
  )
})
