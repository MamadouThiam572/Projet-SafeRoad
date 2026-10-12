import { useCallback, useEffect, useState } from 'react'
import {
  ajouterObservationIncident,
  ApiError,
  changerStatutIncident,
  getHistoriqueIncident,
  type HistoriqueIncidentApi,
  type IncidentApi,
  type StatutIncidentApi,
} from '@/lib/api'
import { formatCoords } from '@/lib/regions'
import type { UserRole } from '@/types/auth'

interface Decision {
  vers: StatutIncidentApi
  libelle: string
  motif?: boolean
  danger?: boolean
}

/** Miroir de Incident.TRANSITIONS (le backend reste seul juge). Traitement : admin et super admin. */
const DECISIONS: Partial<Record<StatutIncidentApi, Decision[]>> = {
  nouveau: [
    { vers: 'en_cours', libelle: 'Prendre en charge' },
    { vers: 'valide', libelle: 'Valider techniquement' },
    { vers: 'rejete', libelle: 'Rejeter (faux positif)', motif: true, danger: true },
  ],
  en_cours: [
    { vers: 'valide', libelle: 'Valider techniquement' },
    { vers: 'rejete', libelle: 'Rejeter (faux positif)', motif: true, danger: true },
  ],
  valide: [{ vers: 'cloture', libelle: 'Clôturer' }],
}

const ROLE_LIBELLE: Record<string, string> = { admin: 'Admin régional', super_admin: 'Super admin' }

const dateHeure = (iso: string) => {
  const t = new Date(iso)
  const p2 = (n: number) => String(n).padStart(2, '0')
  return `${p2(t.getDate())}/${p2(t.getMonth() + 1)}/${t.getFullYear()} ${p2(t.getHours())}:${p2(t.getMinutes())}`
}

const mesure = (v: number | null | undefined, unite: string) => (v == null ? '—' : `${Math.round(v * 10) / 10} ${unite}`)

/**
 * Fiche d'un incident détecté par un boîtier : mesures des capteurs, décision (prise en
 * charge, validation technique, rejet motivé comme faux positif, clôture), observations et
 * historique. L'ANASER la consulte en lecture seule.
 */
export function FicheIncident({
  incident,
  role,
  onFermer,
  onChange,
}: {
  incident: IncidentApi
  role?: UserRole
  onFermer: () => void
  onChange: () => void
}) {
  const [historique, setHistorique] = useState<HistoriqueIncidentApi[]>([])
  const [texte, setTexte] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState('')
  const peutTraiter = role === 'sous_admin' || role === 'super_admin'

  const charger = useCallback(() => {
    getHistoriqueIncident(incident.id).then(setHistorique, () => setHistorique([]))
  }, [incident.id])

  useEffect(() => {
    charger()
  }, [charger])

  const executer = async (appel: () => Promise<unknown>) => {
    setEnvoi(true)
    setErreur('')
    try {
      await appel()
      setTexte('')
      onChange()
      charger()
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Action non enregistrée : serveur injoignable.')
    } finally {
      setEnvoi(false)
    }
  }

  const decider = (d: Decision) => {
    if (d.motif && !texte.trim()) {
      setErreur('Écrivez le motif du rejet dans le champ ci-dessous.')
      return
    }
    void executer(() => changerStatutIncident(incident.id, d.vers, texte.trim()))
  }

  const decisions = peutTraiter ? (DECISIONS[incident.statut as StatutIncidentApi] ?? []) : []

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4" onMouseDown={onFermer}>
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="m-0 text-[17px] font-extrabold text-ink">
              INC-{incident.id} — {incident.type_incident_libelle}
            </p>
            <p className="m-0 mt-1 text-[12px] text-faint">
              Détecté le {dateHeure(incident.horodatage)} par le boîtier SR-{incident.boitier.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <button type="button" onClick={onFermer} className="ic text-xl text-faint hover:text-ink" aria-label="Fermer">
            close
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
          <span className="rounded-md bg-page px-2 py-1 text-body">Gravité : {incident.niveau_gravite_libelle}</span>
          <span className="rounded-md bg-brand-50 px-2 py-1 text-brand-700">{incident.statut_libelle}</span>
          {!incident.position_fiable && <span className="rounded-md bg-[#fdf4e6] px-2 py-1 text-warning-600">Position GPS douteuse</span>}
          {incident.zone && <span className="rounded-md bg-[#f1eafe] px-2 py-1 text-[#7c3aed]">Zone Z-{incident.zone}</span>}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-[12px] sm:grid-cols-3">
          {[
            ['Position', formatCoords(incident.latitude, incident.longitude)],
            ['Vitesse GPS', mesure(incident.vitesse_gps, 'km/h')],
            ['Vitesse radar', mesure(incident.vitesse_radar, 'km/h')],
            ['Satellites', incident.nombre_satellites ?? '—'],
            ['HDOP', mesure(incident.hdop, '')],
            ['Obstacle (ultrason)', mesure(incident.distance_hcsr04, 'cm')],
            ['Reçu par le serveur', dateHeure(incident.recu_le)],
          ].map(([label, valeur]) => (
            <div key={label as string}>
              <dt className="font-semibold text-faint">{label}</dt>
              <dd className="m-0 mt-0.5 font-bold text-ink">{valeur}</dd>
            </div>
          ))}
        </dl>

        {peutTraiter && (
          <div className="mt-5 rounded-xl border border-line bg-page p-4">
            <label className="block text-[11.5px] font-bold text-body" htmlFor="obs-incident">
              Observation (obligatoire pour un rejet)
            </label>
            <textarea
              id="obs-incident"
              rows={2}
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              placeholder="Ex. : dos-d'âne connu à cet endroit, capteur à recalibrer…"
              className="mt-1.5 w-full rounded-[10px] border-[1.5px] border-line-field bg-white px-3 py-2 text-[12.5px] text-ink outline-none focus:border-brand-600"
            />
            <div className="mt-2.5 flex flex-wrap gap-2">
              {decisions.map((d) => (
                <button
                  key={d.vers}
                  type="button"
                  disabled={envoi}
                  onClick={() => decider(d)}
                  className={`rounded-[10px] px-3.5 py-2 text-[12px] font-bold disabled:opacity-50 ${
                    d.danger ? 'border border-danger-600 bg-white text-danger-600' : 'bg-brand-600 text-white hover:bg-brand-700'
                  }`}
                >
                  {d.libelle}
                </button>
              ))}
              <button
                type="button"
                disabled={envoi || !texte.trim()}
                onClick={() => void executer(() => ajouterObservationIncident(incident.id, texte.trim()))}
                className="rounded-[10px] border border-line bg-white px-3.5 py-2 text-[12px] font-bold text-body disabled:opacity-50"
              >
                Ajouter l'observation seule
              </button>
            </div>
            {decisions.length === 0 && (
              <p className="m-0 mt-2 text-[11.5px] text-faint">Plus de décision possible : l'incident est {incident.statut_libelle.toLowerCase()}.</p>
            )}
          </div>
        )}
        {erreur && <p className="m-0 mt-2 text-[11.5px] font-semibold text-danger-600">{erreur}</p>}

        <p className="m-0 mb-2 mt-5 text-xs font-extrabold text-ink">Historique</p>
        <ul className="flex flex-col gap-2">
          <li className="text-[12px] text-body">
            <span className="text-faint">{dateHeure(incident.recu_le)} — </span>Reçu du boîtier
          </li>
          {historique.map((h) => (
            <li key={h.id} className="text-[12px] text-body">
              <span className="text-faint">{dateHeure(h.date)} — </span>
              {h.statut_nouveau ? `${h.statut_precedent_libelle} → ${h.statut_nouveau_libelle}` : 'Observation'} par{' '}
              {h.acteur_nom ?? 'compte supprimé'} ({ROLE_LIBELLE[h.role_acteur] ?? h.role_acteur})
              {h.texte ? ` : « ${h.texte} »` : ''}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
