import { Circle, MapContainer, Popup, TileLayer } from 'react-leaflet'
import '../../config/leafletIcons'
import { couleurNiveauDanger } from '../../utils/niveauDangerColor'

// Vue par défaut : le Sénégal dans son ensemble (pas seulement Dakar).
const CENTRE_SENEGAL = [14.4974, -14.4524]
const ZOOM_SENEGAL = 7
const BORNES_SENEGAL = [
  [11.8, -18.0],
  [16.8, -11.2],
]

export function CarteZones({ zones, hauteur = 'clamp(360px, 60vh, 640px)' }) {
  return (
    <MapContainer
      center={CENTRE_SENEGAL}
      zoom={ZOOM_SENEGAL}
      minZoom={6}
      maxBounds={BORNES_SENEGAL}
      maxBoundsViscosity={0.6}
      style={{ height: hauteur, width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {zones.map((zone) => (
        <Circle
          key={zone.id}
          center={[zone.latitude_centre, zone.longitude_centre]}
          radius={zone.rayon_metres}
          pathOptions={{ color: couleurNiveauDanger(zone.niveau_danger), fillOpacity: 0.35 }}
        >
          <Popup>
            <strong>{zone.nom || `Zone #${zone.id}`}</strong>
            <br />
            Niveau de danger : {zone.niveau_danger}
            <br />
            Incidents recensés : {zone.nombre_incidents}
          </Popup>
        </Circle>
      ))}
    </MapContainer>
  )
}
