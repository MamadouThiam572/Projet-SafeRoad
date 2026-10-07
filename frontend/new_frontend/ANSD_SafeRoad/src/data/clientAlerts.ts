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
}

/**
 * Historique d'alertes du conducteur — « zone » = détectée sur une zone à
 * risque cartographiée, « trajet » = détectée par le boîtier depuis le
 * comportement du véhicule (freinage, etc.). Les deux alimentent le même
 * fil, mais les onglets permettent de les distinguer.
 */
export const CLIENT_ALERTS: ClientAlert[] = [
  {
    id: 'al1',
    kind: 'zone',
    level: 'critique',
    icon: 'warning',
    title: 'Zone critique à proximité',
    desc: 'Vous approchez d’une zone à risque sur la RN1 à 2,5 km.',
    place: 'Thiès · RN1 — Km 45',
    ago: 'Il y a 5 min',
    distance: '2,5 km',
  },
  {
    id: 'al2',
    kind: 'trajet',
    level: 'vigilance',
    icon: 'priority_high',
    title: 'Freinage brusque détecté',
    desc: 'Un véhicule devant vous a freiné brusquement.',
    place: 'Dakar · RN1',
    ago: 'Il y a 12 min',
  },
  {
    id: 'al3',
    kind: 'zone',
    level: 'vigilance',
    icon: 'priority_high',
    title: 'Zone de vigilance',
    desc: 'Ralentissement du trafic dans votre direction.',
    place: 'Dakar · A1',
    ago: 'Il y a 26 min',
    distance: '6,4 km',
  },
  {
    id: 'al4',
    kind: 'zone',
    level: 'normale',
    icon: 'check_circle',
    title: 'Retour à la normale',
    desc: 'La zone précédente en alerte est maintenant sous contrôle.',
    place: 'Thiès · RN2',
    ago: 'Il y a 1 h',
  },
]
