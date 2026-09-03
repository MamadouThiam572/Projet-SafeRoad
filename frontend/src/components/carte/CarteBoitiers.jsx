import L from 'leaflet'
import { Circle, MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import '../../config/leafletIcons'
import { couleurNiveauDanger } from '../../utils/niveauDangerColor'

// Vue par défaut : le Sénégal dans son ensemble (pas seulement Dakar).
const CENTRE_SENEGAL = [14.4974, -14.4524]
const ZOOM_SENEGAL = 7
const BORNES_SENEGAL = [
  [11.8, -18.0],
  [16.8, -11.2],
]

// 📍 représente la position GPS du véhicule/boîtier suivi ; l'ancre au bas du glyphe
// fait pointer le pin vers ses coordonnées réelles (pas son centre).
const ICONE_VEHICULE = L.divIcon({
  className: 'carte-emoji-marqueur',
  html: '<span class="carte-emoji-marqueur__glyphe">📍</span>',
  iconSize: [26, 26],
  iconAnchor: [13, 26],
})

// 🔴 signale une zone à risque validée par un administrateur ET de niveau critique —
// pas une simple candidate en attente de vérification.
const ICONE_ZONE_CRITIQUE = L.divIcon({
  className: 'carte-emoji-marqueur',
  html: '<span class="carte-emoji-marqueur__glyphe carte-emoji-marqueur__glyphe--petit">🔴</span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

// Carte de position en temps réel : où se trouve actuellement le véhicule équipé du
// système embarqué SafeRoad (📍, position GPS la plus récente reçue du boîtier), et
// quelles zones à risque validées se trouvent autour de lui (cercle coloré par niveau ;
// 🔴 en plus sur les zones critiques pour un repérage immédiat). Ce n'est pas un
// inventaire de boîtiers : seules les positions réellement connues sont affichées, rien
// n'est inventé si un boîtier n'a jamais remonté de coordonnées.
export function CarteBoitiers({ boitiers, zones = [], hauteur = 'clamp(360px, 60vh, 640px)' }) {
  const positionnes = boitiers.filter((b) => b.derniere_latitude != null && b.derniere_longitude != null)
  // Une zone « à risque » au sens de cette carte est une zone validée par un administrateur —
  // une candidate encore en_attente n'est pas un risque confirmé.
  const zonesValidees = zones.filter((z) => z.statut_validation === 'validee')

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
      {zonesValidees.map((zone) => (
        <Circle
          key={`zone-${zone.id}`}
          center={[zone.latitude_centre, zone.longitude_centre]}
          radius={zone.rayon_metres}
          pathOptions={{ color: couleurNiveauDanger(zone.niveau_danger), fillOpacity: 0.25, weight: 1.5 }}
        >
          <Popup>
            <strong>{zone.nom || `Zone #${zone.id}`}</strong>
            <br />
            Niveau de danger : {zone.niveau_danger_libelle ?? zone.niveau_danger}
            <br />
            Incidents recensés : {zone.nombre_incidents}
          </Popup>
        </Circle>
      ))}
      {zonesValidees
        .filter((zone) => zone.niveau_danger === 'critique')
        .map((zone) => (
          <Marker
            key={`zone-critique-${zone.id}`}
            position={[zone.latitude_centre, zone.longitude_centre]}
            icon={ICONE_ZONE_CRITIQUE}
            interactive={false}
            keyboard={false}
          />
        ))}
      {positionnes.map((boitier) => (
        <Marker
          key={`boitier-${boitier.id}`}
          position={[boitier.derniere_latitude, boitier.derniere_longitude]}
          icon={ICONE_VEHICULE}
        >
          <Popup>
            <strong>{boitier.numero_immatriculation || `Boîtier ${boitier.id.slice(0, 8)}`}</strong>
            <br />
            {boitier.proprietaire_nom && (
              <>
                {boitier.proprietaire_nom}
                <br />
              </>
            )}
            Statut : {boitier.statut_libelle}
            {boitier.derniere_localisation_maj && (
              <>
                <br />
                Dernière position relevée le{' '}
                {new Date(boitier.derniere_localisation_maj).toLocaleString('fr-FR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </>
            )}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
