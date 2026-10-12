import { useCallback, useEffect, useState } from 'react'
import { ApiError, changerStatutZone, getHistoriqueZone, type HistoriqueZoneApi, type StatutZone, type ZoneApi } from '@/lib/api'
import { STATUT_ZONE_META, STATUTS_A_VALIDER } from '@/lib/zones'
import type { UserRole } from '@/types/auth'

type Acteur = 'technique' | 'anaser' | 'administration'

interface Transition {
  vers: StatutZone
  acteur: Acteur
  libelle: string
  icone: string
  motif?: boolean
  danger?: boolean
}

/**
 * Miroir de Zone.TRANSITIONS (backend, qui reste seul juge) : seules les décisions permises
 * au rôle connecté sont proposées. Technique = admin régional et super admin ; ANASER =
 * reconnaissance officielle ; administration = super admin (archivage).
 */
const TRANSITIONS: Record<StatutZone, Transition[]> = {
  proposee: [
    { vers: 'en_verification', acteur: 'technique', libelle: 'Lancer la vérification', icone: 'manage_search' },
    { vers: 'validee_technique', acteur: 'technique', libelle: 'Valider techniquement', icone: 'verified' },
    { vers: 'rejetee', acteur: 'technique', libelle: 'Rejeter', icone: 'cancel', motif: true, danger: true },
  ],
  en_verification: [
    { vers: 'validee_technique', acteur: 'technique', libelle: 'Valider techniquement', icone: 'verified' },
    { vers: 'rejetee', acteur: 'technique', libelle: 'Rejeter', icone: 'cancel', motif: true, danger: true },
  ],
  validee_technique: [
    { vers: 'soumise_anaser', acteur: 'technique', libelle: "Soumettre à l'ANASER", icone: 'send' },
    { vers: 'rejetee', acteur: 'technique', libelle: 'Rejeter', icone: 'cancel', motif: true, danger: true },
  ],
  soumise_anaser: [
    { vers: 'reconnue', acteur: 'anaser', libelle: 'Reconnaître officiellement', icone: 'verified_user' },
    { vers: 'en_verification', acteur: 'anaser', libelle: 'Demander un complément', icone: 'help', motif: true },
    { vers: 'rejetee', acteur: 'anaser', libelle: 'Rejeter', icone: 'cancel', motif: true, danger: true },
  ],
  reconnue: [{ vers: 'archivee', acteur: 'administration', libelle: 'Archiver', icone: 'archive' }],
  rejetee: [{ vers: 'archivee', acteur: 'administration', libelle: 'Archiver', icone: 'archive' }],
  archivee: [],
}

const ACTEURS: Record<Acteur, UserRole[]> = {
  technique: ['sous_admin', 'super_admin'],
  anaser: ['anaser'],
  administration: ['super_admin'],
}

const dateHeure = (iso: string) => {
  const t = new Date(iso)
  const p2 = (n: number) => String(n).padStart(2, '0')
  return `${p2(t.getDate())}/${p2(t.getMonth() + 1)}/${t.getFullYear()} ${p2(t.getHours())}:${p2(t.getMinutes())}`
}

const ROLE_LIBELLE: Record<string, string> = { admin: 'Admin régional', super_admin: 'Super admin', anaser: 'ANASER' }

/**
 * Décisions possibles sur une zone pour le rôle connecté + historique des décisions (qui,
 * quand, sur quelles bases). Une décision motivée demande un commentaire avant l'envoi.
 */
export function DecisionZone({ zone, role, onChange }: { zone: ZoneApi; role?: UserRole; onChange: (z: ZoneApi) => void }) {
  const [historique, setHistorique] = useState<HistoriqueZoneApi[]>([])
  const [enCours, setEnCours] = useState<Transition | null>(null)
  const [motif, setMotif] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState('')

  const chargerHistorique = useCallback(() => {
    getHistoriqueZone(zone.id).then(setHistorique, () => setHistorique([]))
  }, [zone.id])

  // Le parent remonte le composant (key) à chaque changement de zone ou de statut : pas d'état à
  // réinitialiser ici, seulement l'historique à recharger.
  useEffect(() => {
    chargerHistorique()
  }, [chargerHistorique])

  const possibles = TRANSITIONS[zone.statut_validation].filter((t) => role && ACTEURS[t.acteur].includes(role))

  async function decider(t: Transition) {
    if (t.motif && !motif.trim()) {
      setEnCours(t)
      return
    }
    setEnvoi(true)
    setErreur('')
    try {
      onChange(await changerStatutZone(zone.id, t.vers, motif.trim()))
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Décision non enregistrée : serveur injoignable.')
    } finally {
      setEnvoi(false)
    }
  }

  const statut = STATUT_ZONE_META[zone.statut_validation]

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 text-xs font-extrabold text-ink">Validation</p>
        <span className="rounded-md px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: statut.soft, color: statut.text }}>
          {statut.label}
        </span>
      </div>

      {possibles.length === 0 ? (
        <p className="m-0 mt-2 text-[11.5px] text-faint">
          {zone.statut_validation === 'soumise_anaser'
            ? "En attente de la décision officielle de l'ANASER."
            : STATUTS_A_VALIDER.includes(zone.statut_validation)
              ? "En attente de la validation technique d'un administrateur."
              : 'Aucune décision à prendre sur cette zone.'}
        </p>
      ) : enCours ? (
        <div className="mt-2.5">
          <label className="text-[11.5px] font-bold text-body" htmlFor="motif-zone">
            {enCours.libelle} — motif (obligatoire)
          </label>
          <textarea
            id="motif-zone"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            rows={3}
            placeholder="Sur quelles bases ? (constat terrain, données insuffisantes, travaux terminés…)"
            className="mt-1.5 w-full rounded-[10px] border border-line bg-white px-3 py-2 text-[12px] text-ink outline-none focus:border-brand-400"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={envoi || !motif.trim()}
              onClick={() => void decider(enCours)}
              className={`flex-1 rounded-[10px] py-2 text-[12px] font-bold text-white disabled:opacity-50 ${enCours.danger ? 'bg-danger-600 hover:bg-danger-700' : 'bg-brand-600 hover:bg-brand-700'}`}
            >
              {envoi ? 'Envoi…' : 'Confirmer'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEnCours(null)
                setMotif('')
              }}
              className="rounded-[10px] border border-line px-3 py-2 text-[12px] font-bold text-body hover:bg-page"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2.5 flex flex-col gap-2">
          {possibles.map((t) => (
            <button
              key={t.vers}
              type="button"
              disabled={envoi}
              onClick={() => void decider(t)}
              className={`flex w-full items-center justify-center gap-2 rounded-[10px] py-2.5 text-[12.5px] font-bold transition-colors disabled:opacity-50 ${
                t.danger
                  ? 'border border-danger-600 bg-white text-danger-600 hover:bg-[#fdeeec]'
                  : 'bg-brand-600 text-white hover:bg-brand-700'
              }`}
            >
              <span className="ic text-base">{t.icone}</span>
              {t.libelle}
            </button>
          ))}
        </div>
      )}
      {erreur && <p className="m-0 mt-2 text-[11px] font-semibold text-danger-600">{erreur}</p>}

      <p className="m-0 mb-2 mt-4 text-xs font-extrabold text-ink">Historique des décisions</p>
      {historique.length === 0 ? (
        <p className="m-0 text-[11.5px] text-faint">Aucune décision pour l'instant (zone détectée par le système).</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {[...historique].reverse().map((h) => (
            <li key={h.id} className="rounded-xl bg-page p-3 text-[11.5px] text-body">
              <p className="m-0 font-bold text-ink">
                {h.statut_precedent_libelle} → {h.statut_nouveau_libelle}
              </p>
              {h.commentaire && <p className="m-0 mt-1">{h.commentaire}</p>}
              <p className="m-0 mt-1 text-[10.5px] font-semibold text-faint">
                {h.acteur_nom ?? 'Compte supprimé'} ({ROLE_LIBELLE[h.role_acteur] ?? h.role_acteur}) — {dateHeure(h.date)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
