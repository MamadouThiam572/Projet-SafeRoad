export interface ClientTrip {
  id: string
  route: string
  date: string
  duration: string
  km: number
  alerts: number
  score: number
}

/**
 * Historique des trajets du conducteur, du plus récent au plus ancien.
 * `score` (/100) reflète la conduite (respect des vitesses, freinages, zones
 * évitées) ; `alerts` compte les alertes déclenchées pendant le trajet.
 */
export const CLIENT_TRIPS: ClientTrip[] = [
  { id: 't1', route: 'Dakar → Thiès', date: '08/09/2026', duration: '1 h 05', km: 72, alerts: 3, score: 86 },
  { id: 't2', route: 'Thiès → Mbour', date: '07/09/2026', duration: '50 min', km: 58, alerts: 1, score: 92 },
  { id: 't3', route: 'Dakar → Rufisque', date: '06/09/2026', duration: '35 min', km: 26, alerts: 0, score: 96 },
  { id: 't4', route: 'Dakar → Saint-Louis', date: '04/09/2026', duration: '3 h 40', km: 264, alerts: 5, score: 74 },
  { id: 't5', route: 'Dakar → Kaolack', date: '02/09/2026', duration: '2 h 45', km: 192, alerts: 2, score: 88 },
  { id: 't6', route: 'Mbour → Dakar', date: '31/08/2026', duration: '1 h 15', km: 84, alerts: 1, score: 90 },
]
