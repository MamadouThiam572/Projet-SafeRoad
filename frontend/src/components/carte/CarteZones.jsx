import { Circle, MapContainer, Popup, TileLayer } from 'react-leaflet'
import '../../config/leafletIcons'
import { couleurNiveauDanger } from '../../utils/niveauDangerColor'

const CENTRE_DAKAR = [14.6928, -17.4467]

export function CarteZones({ zones }) {
  return (
    <MapContainer center={CENTRE_DAKAR} zoom={12} style={{ height: '500px', width: '100%' }}>
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
