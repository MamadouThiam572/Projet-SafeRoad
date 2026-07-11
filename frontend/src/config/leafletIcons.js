import L from 'leaflet'
import icone2x from 'leaflet/dist/images/marker-icon-2x.png'
import icone from 'leaflet/dist/images/marker-icon.png'
import ombre from 'leaflet/dist/images/marker-shadow.png'

// Vite ne résout pas les chemins d'images par défaut de Leaflet : on les réimporte explicitement.
L.Icon.Default.mergeOptions({
  iconRetinaUrl: icone2x,
  iconUrl: icone,
  shadowUrl: ombre,
})
