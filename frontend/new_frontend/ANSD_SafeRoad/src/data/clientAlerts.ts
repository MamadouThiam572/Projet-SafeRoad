import { ilYa } from '@/data/adminHome'
import type { AlerteConducteurApi } from '@/lib/api'
import type { RiskLevel } from '@/data/clientZones'

export type AlertKind = 'zone' | 'trajet'

export interface ClientAlert {
  id: string
  kind: AlertKind
  level: RiskLevel
  icon: string
  title: string
  desc: string
  place: string
  ago: string
  distance?: string
  /** Date ISO de l'alerte (pour le « non lu »). */
  date?: string
}

const LED: Record<AlerteConducteurApi['canal_led'], string> = { vert: 'verte', jaune: 'jaune', rouge: 'rouge' }

/**
 * Alerte de zone reçue (backend) -> carte de « Mes alertes ». Seules les zones reconnues par
 * l'ANASER déclenchent ces alertes ; les alertes dynamiques des capteurs restent sur le boîtier.
 */
export function alerteConducteurDepuisApi(a: AlerteConducteurApi, maintenant: number): ClientAlert {
  const signaux = [`LED ${LED[a.canal_led]}`]
  if (a.canal_buzzer_declenche) signaux.push('buzzer')
  if (a.canal_audio_declenche) signaux.push('message vocal')
  const ago = ilYa(a.date_creation, maintenant)
  const distance = a.distance_metres < 1000 ? `${Math.round(a.distance_metres)} m` : `${(a.distance_metres / 1000).toFixed(1).replace('.', ',')} km`
  return {
    id: String(a.id),
    kind: 'zone',
    level: a.niveau_danger,
    icon: a.niveau_danger === 'normale' ? 'info' : a.niveau_danger === 'critique' ? 'warning' : 'priority_high',
    title: a.niveau_danger === 'critique' ? 'Zone critique à proximité' : a.niveau_danger === 'vigilance' ? 'Zone de vigilance' : 'Zone à risque signalée',
    desc: `Vous êtes passé à ${distance} d'une zone reconnue par l'ANASER. Signal du boîtier : ${signaux.join(', ')}.`,
    place: [a.region_libelle, a.zone_nom].filter(Boolean).join(' · '),
    ago: ago.charAt(0).toUpperCase() + ago.slice(1),
    distance,
    date: a.date_creation,
  }
}
