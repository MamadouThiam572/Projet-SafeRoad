/**
 * Utilitaires de filtrage par période, partagés entre les pages qui ont un
 * sélecteur « Période » (Incidents, Historique…).
 *
 * Les dates de démonstration ne sont pas tenues à jour en continu : au lieu
 * de comparer à la date système réelle (ce qui viderait le filtre par
 * défaut dès que les données de démo prennent de l'âge), on calcule chaque
 * période par rapport à la date la plus récente réellement présente dans le
 * jeu de données concerné. Le jour le plus récent du jeu de données joue le
 * rôle de « aujourd'hui » pour ce filtre.
 */

/** Parse une date au format français JJ/MM/AAAA, ou une chaîne ISO (YYYY-MM-DD[THH:mm]), en Date à minuit local. */
export function parseLocalDate(value: string): Date {
  if (value.includes('/')) {
    const [day, month, year] = value.split('/').map(Number)
    return new Date(year, month - 1, day)
  }
  const d = new Date(value)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Date la plus récente parmi une série de dates (JJ/MM/AAAA ou ISO). */
export function latestDate(values: string[]): Date {
  return (
    values.reduce<Date | null>((max, v) => {
      const d = parseLocalDate(v)
      return !max || d > max ? d : max
    }, null) ?? new Date()
  )
}

/** Nombre de jours entiers entre `reference` et `value` (positif si `value` est dans le passé). */
export function daysSince(reference: Date, value: string): number {
  const d = parseLocalDate(value)
  return Math.round((reference.getTime() - d.getTime()) / 86_400_000)
}
