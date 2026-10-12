import { useEnDirect } from '@/hooks/useEnDirect'
import { getIncidentsRecents, type IncidentApi } from '@/lib/api'

const GRAVITE: Record<IncidentApi['niveau_gravite'], { cls: string }> = {
  critique: { cls: 'bg-danger-50 text-danger-700' },
  moyen: { cls: 'bg-warning-50 text-warning-600' },
  faible: { cls: 'bg-success-50 text-success-600' },
}

const heure = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })

/**
 * Derniers incidents réellement reçus des boîtiers (backend : écoute MQTT ou API), rafraîchis
 * toutes les 5 s. Le backend ne renvoie que ceux que le compte a le droit de voir (filtre régional).
 */
export function IncidentsEnDirect() {
  const { donnees, erreur, maj } = useEnDirect(getIncidentsRecents, 5000)
  const incidents = donnees ?? []

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 flex items-center gap-2 text-[15px] font-extrabold text-ink">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-600 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success-600" />
          </span>
          Incidents en direct
        </p>
        <p className="m-0 text-[11px] font-medium text-faint">
          Données réelles des boîtiers · mise à jour {new Date(maj).toLocaleTimeString('fr-FR')}
        </p>
      </div>
      {erreur && <p className="m-0 mt-2 text-[12px] font-semibold text-danger-600">{erreur}</p>}

      {incidents.length === 0 ? (
        <p className="m-0 mt-3 text-[13px] text-body">
          Aucun incident reçu pour l’instant. Ils apparaissent ici dès que le boîtier détecte un événement en roulant.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-[12.5px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-faint">
                <th className="px-2 py-2 font-bold">Heure</th>
                <th className="px-2 py-2 font-bold">Événement</th>
                <th className="px-2 py-2 font-bold">Gravité</th>
                <th className="px-2 py-2 font-bold">Vitesse</th>
                <th className="px-2 py-2 font-bold">Position</th>
                <th className="px-2 py-2 font-bold">Boîtier</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((i) => {
                const vitesse = i.vitesse_radar ?? i.vitesse_gps
                return (
                  <tr key={i.id} className="border-t border-line-soft">
                    <td className="whitespace-nowrap px-2 py-2 font-mono text-ink">{heure(i.horodatage)}</td>
                    <td className="px-2 py-2 font-semibold text-ink">{i.type_incident_libelle}</td>
                    <td className="px-2 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${GRAVITE[i.niveau_gravite].cls}`}>
                        {i.niveau_gravite_libelle}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-body">{vitesse != null ? `${Math.round(vitesse)} km/h` : '—'}</td>
                    <td className="px-2 py-2">
                      <a
                        href={`https://maps.google.com/?q=${i.latitude},${i.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-brand-600 hover:text-brand-700"
                      >
                        Voir sur la carte
                      </a>
                      {!i.position_fiable && <span className="ml-1.5 text-[11px] text-warning-600">(GPS imprécis)</span>}
                    </td>
                    <td className="px-2 py-2 font-mono text-body">{i.boitier.slice(0, 8).toUpperCase()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
