import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useEnDirect } from '@/hooks/useEnDirect'
import {
  ApiError,
  changerStatutDemande,
  enregistrerInstallation,
  getDemandesInstallation,
  getHistoriqueDemande,
  planifierRendezVous,
  type DemandeInstallationApi,
  type HistoriqueDemandeApi,
  type StatutDemande,
} from '@/lib/api'
import { regionLabel } from '@/lib/regions'

const STATUT_META: Record<StatutDemande, { label: string; soft: string; text: string; icon: string }> = {
  nouvelle: { label: 'Nouvelle', soft: '#fdeeec', text: '#dc3a2f', icon: 'fiber_new' },
  contactee: { label: 'Contactée', soft: '#fdf4e6', text: '#b4590a', icon: 'call' },
  rdv_planifie: { label: 'Rendez-vous planifié', soft: '#e8f0f9', text: '#2b6cb0', icon: 'event' },
  installee: { label: 'Installée', soft: '#e9f6ee', text: '#1a8248', icon: 'check_circle' },
  annulee: { label: 'Annulée', soft: '#f1f5f9', text: '#64748b', icon: 'cancel' },
}

const ORDRE: StatutDemande[] = ['nouvelle', 'contactee', 'rdv_planifie', 'installee', 'annulee']
const ROLE_LIBELLE: Record<string, string> = { admin: 'Admin régional', super_admin: 'Super admin' }

const p2 = (n: number) => String(n).padStart(2, '0')
const dateHeure = (iso: string) => {
  const t = new Date(iso)
  return `${p2(t.getDate())}/${p2(t.getMonth() + 1)}/${t.getFullYear()} ${p2(t.getHours())}:${p2(t.getMinutes())}`
}
const message = (err: unknown) => (err instanceof ApiError ? err.message : 'Serveur injoignable : action non enregistrée.')

const champ =
  'mt-1 w-full rounded-[10px] border-[1.5px] border-line-field bg-field px-3 py-2 text-[12.5px] text-ink outline-none focus:border-brand-600'
const etiquette = 'block text-[11.5px] font-bold text-body'

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold text-faint">{label}</dt>
      <dd className="m-0 mt-0.5 text-[12.5px] font-semibold text-ink">{children || '—'}</dd>
    </div>
  )
}

/** Actions possibles selon le statut : contacter, planifier le rendez-vous, installer, annuler. */
function Actions({ d, onFait }: { d: DemandeInstallationApi; onFait: (reponse: Partial<DemandeInstallationApi> & { boitier_api_key?: string }) => void }) {
  const [mode, setMode] = useState<'rdv' | 'installation' | 'annulation' | null>(null)
  const [rdvDate, setRdvDate] = useState('')
  const [rdvLieu, setRdvLieu] = useState(d.rdv_lieu)
  const [cni, setCni] = useState('')
  const [email, setEmail] = useState(d.email)
  const [immat, setImmat] = useState(d.immatriculation)
  const [commentaire, setCommentaire] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState('')

  const executer = async (appel: () => Promise<Partial<DemandeInstallationApi> & { boitier_api_key?: string }>) => {
    setEnvoi(true)
    setErreur('')
    try {
      onFait(await appel())
    } catch (err) {
      setErreur(message(err))
    } finally {
      setEnvoi(false)
    }
  }

  const soumettre = (e: FormEvent) => {
    e.preventDefault()
    if (mode === 'rdv') {
      void executer(() =>
        planifierRendezVous(d.id, { rdv_date: new Date(rdvDate).toISOString(), rdv_lieu: rdvLieu.trim(), commentaire: commentaire.trim() }),
      )
    } else if (mode === 'installation') {
      void executer(() =>
        enregistrerInstallation(d.id, {
          numero_cni: cni.trim(),
          ...(email.trim() ? { email: email.trim() } : {}),
          immatriculation: immat.trim(),
          commentaire: commentaire.trim(),
        }),
      )
    } else if (mode === 'annulation') {
      void executer(() => changerStatutDemande(d.id, 'annulee', commentaire.trim()))
    }
  }

  if (d.statut === 'installee' || d.statut === 'annulee') return null
  const bouton = 'rounded-[10px] px-3.5 py-2 text-[12px] font-bold disabled:opacity-50'

  return (
    <div className="rounded-xl border border-line bg-page p-4">
      {!mode ? (
        <div className="flex flex-wrap gap-2">
          {d.statut === 'nouvelle' && (
            <button type="button" disabled={envoi} onClick={() => void executer(() => changerStatutDemande(d.id, 'contactee'))} className={`${bouton} border border-brand-600 bg-white text-brand-600`}>
              Marquer comme contactée
            </button>
          )}
          <button type="button" onClick={() => setMode('rdv')} className={`${bouton} bg-brand-600 text-white hover:bg-brand-700`}>
            {d.statut === 'rdv_planifie' ? 'Déplacer le rendez-vous' : 'Planifier le rendez-vous'}
          </button>
          {d.statut === 'rdv_planifie' && (
            <button type="button" onClick={() => setMode('installation')} className={`${bouton} bg-success-600 text-white`}>
              Enregistrer l'installation
            </button>
          )}
          <button type="button" onClick={() => setMode('annulation')} className={`${bouton} border border-danger-600 bg-white text-danger-600`}>
            Annuler la demande
          </button>
        </div>
      ) : (
        <form onSubmit={soumettre} className="flex flex-col gap-3">
          {mode === 'rdv' && (
            <>
              <label className={etiquette}>
                Date et heure du rendez-vous
                <input type="datetime-local" required value={rdvDate} onChange={(e) => setRdvDate(e.target.value)} className={champ} />
              </label>
              <label className={etiquette}>
                Lieu
                <input required maxLength={200} value={rdvLieu} onChange={(e) => setRdvLieu(e.target.value)} placeholder="Ex. : agence SafeRoad de Thiès" className={champ} />
              </label>
              <p className="m-0 text-[11px] text-faint">Le demandeur est prévenu par e-mail (s'il en a donné un) : pièce d'identité et carte grise à apporter.</p>
            </>
          )}
          {mode === 'installation' && (
            <>
              <label className={etiquette}>
                Numéro de la pièce d'identité (CNI), vérifiée sur place
                <input required maxLength={30} value={cni} onChange={(e) => setCni(e.target.value)} className={champ} />
              </label>
              <label className={etiquette}>
                E-mail du conducteur (son compte et son invitation)
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={champ} />
              </label>
              <label className={etiquette}>
                Immatriculation du véhicule
                <input maxLength={30} value={immat} onChange={(e) => setImmat(e.target.value)} className={champ} />
              </label>
              <p className="m-0 text-[11px] text-faint">
                Crée le compte conducteur (invitation par e-mail), enregistre le boîtier dans la région et le lui affecte.
              </p>
            </>
          )}
          <label className={etiquette}>
            {mode === 'annulation' ? "Motif de l'annulation (obligatoire)" : 'Commentaire (facultatif)'}
            <textarea rows={2} required={mode === 'annulation'} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} className={champ} />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={envoi} className={`${bouton} ${mode === 'annulation' ? 'bg-danger-600' : 'bg-brand-600'} text-white`}>
              {envoi ? 'Envoi…' : 'Confirmer'}
            </button>
            <button type="button" onClick={() => setMode(null)} className={`${bouton} border border-line bg-white text-body`}>
              Retour
            </button>
          </div>
        </form>
      )}
      {erreur && <p className="m-0 mt-2 text-[11.5px] font-semibold text-danger-600">{erreur}</p>}
    </div>
  )
}

/**
 * Demandes d'installation déposées sur le site public (« Demander un boîtier »). Admin régional :
 * celles de sa région ; `national` : toutes (super admin). Parcours : contact, rendez-vous,
 * installation sur place (création du compte conducteur et du boîtier), ou annulation motivée.
 */
export function DemandesPage({ national = false }: { national?: boolean }) {
  const { user } = useAuth()
  const { donnees, erreur, recharger } = useEnDirect(getDemandesInstallation, 30_000)
  const demandes = useMemo(() => donnees ?? [], [donnees])
  const [filtre, setFiltre] = useState<'ouvertes' | StatutDemande | 'toutes'>('ouvertes')
  const [choisie, setChoisie] = useState<number | null>(null)
  const [historique, setHistorique] = useState<{ id: number; lignes: HistoriqueDemandeApi[] }>({ id: 0, lignes: [] })
  const [cle, setCle] = useState<{ boitier: string | null; valeur: string } | null>(null)

  const liste = useMemo(
    () =>
      demandes.filter((d) =>
        filtre === 'toutes' ? true : filtre === 'ouvertes' ? ['nouvelle', 'contactee', 'rdv_planifie'].includes(d.statut) : d.statut === filtre,
      ),
    [demandes, filtre],
  )
  const selection = demandes.find((d) => d.id === choisie) ?? liste[0] ?? null
  const selectionId = selection?.id ?? 0
  const selectionMaj = selection?.date_maj ?? ''

  useEffect(() => {
    if (!selectionId) return
    let actif = true
    getHistoriqueDemande(selectionId).then(
      (lignes) => actif && setHistorique({ id: selectionId, lignes }),
      () => actif && setHistorique({ id: selectionId, lignes: [] }),
    )
    return () => {
      actif = false
    }
  }, [selectionId, selectionMaj])

  const compte = (s: StatutDemande) => demandes.filter((d) => d.statut === s).length

  return (
    <div className="pb-8">
      <section className="mx-6 mt-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[clamp(21px,2.6vw,26px)] font-extrabold leading-[1.15] tracking-[-0.026em] text-ink">Demandes d'installation</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-body">
            Demandes de boîtier déposées sur le site {national ? 'dans tout le pays' : `pour la région de ${regionLabel(user?.region)}`}. Contactez
            le demandeur, fixez le rendez-vous, puis enregistrez l'installation : le compte du conducteur est alors créé et il reçoit son
            invitation par e-mail.
          </p>
          {erreur && <p className="mt-1.5 text-xs font-semibold text-danger-600">{erreur}</p>}
        </div>
      </section>

      <section className="mx-6 mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {ORDRE.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFiltre(s)}
            className={`rounded-2xl border bg-white p-4 text-left shadow-card ${filtre === s ? 'border-brand-600' : 'border-line'}`}
          >
            <span className="ic text-xl" style={{ color: STATUT_META[s].text }}>
              {STATUT_META[s].icon}
            </span>
            <p className="m-0 mt-1 text-2xl font-extrabold text-ink">{compte(s)}</p>
            <p className="m-0 text-xs font-semibold text-body">{STATUT_META[s].label}</p>
          </button>
        ))}
      </section>

      {cle && (
        <section className="mx-6 mt-4 rounded-2xl border-2 border-warning-600 bg-[#fdf4e6] p-5">
          <p className="m-0 text-sm font-extrabold text-ink">Installation enregistrée — clé API du boîtier (affichée une seule fois)</p>
          {cle.boitier && <p className="m-0 mt-2 text-[12px] text-body">Identifiant du boîtier (UUID) : <code className="font-bold">{cle.boitier}</code></p>}
          <p className="m-0 mt-1 break-all text-[12px] text-body">
            Clé API : <code className="font-bold">{cle.valeur}</code>
          </p>
          <p className="m-0 mt-2 text-[11.5px] text-faint">Copiez-la maintenant dans la configuration du boîtier. Elle ne sera plus jamais affichée (régénérable depuis la page Boîtiers).</p>
          <button type="button" onClick={() => setCle(null)} className="mt-3 rounded-[10px] bg-ink px-3.5 py-2 text-[12px] font-bold text-white">
            J'ai copié la clé
          </button>
        </section>
      )}

      <section className="mx-6 mt-4 grid grid-cols-1 items-start gap-4 xl:grid-cols-[1fr_1.2fr]">
        <div className="min-w-0 rounded-2xl border border-line bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-5 py-4">
            <p className="m-0 text-sm font-extrabold text-ink">Demandes ({liste.length})</p>
            <select value={filtre} onChange={(e) => setFiltre(e.target.value as typeof filtre)} className="rounded-full border border-line bg-white px-3 py-1.5 text-[11px] font-bold text-body">
              <option value="ouvertes">En cours de traitement</option>
              <option value="toutes">Toutes</option>
              {ORDRE.map((s) => (
                <option key={s} value={s}>
                  {STATUT_META[s].label}
                </option>
              ))}
            </select>
          </div>
          <ul className="flex max-h-[560px] flex-col gap-1 overflow-y-auto p-3">
            {liste.length === 0 && <li className="px-2 py-3 text-[12px] text-faint">{donnees ? 'Aucune demande.' : 'Chargement…'}</li>}
            {liste.map((d) => {
              const m = STATUT_META[d.statut]
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => setChoisie(d.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${selection?.id === d.id ? 'bg-page' : 'hover:bg-page'}`}
                  >
                    <span className="ic flex h-9 w-9 flex-none items-center justify-center rounded-full text-lg" style={{ background: m.soft, color: m.text }}>
                      {m.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate text-[13px] font-bold text-ink">
                        {d.prenom} {d.nom}
                      </p>
                      <p className="m-0 mt-0.5 truncate text-[11px] text-faint">
                        {d.commune} · {d.region_libelle} · {d.type_vehicule_libelle} · {dateHeure(d.date_creation)}
                      </p>
                    </div>
                    <span className="flex-none rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ background: m.soft, color: m.text }}>
                      {m.label}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {selection && (
          <div className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="m-0 text-[15px] font-extrabold text-ink">
                Demande #{selection.id} — {selection.prenom} {selection.nom}
              </p>
              <span className="rounded-md px-2 py-1 text-[11px] font-bold" style={{ background: STATUT_META[selection.statut].soft, color: STATUT_META[selection.statut].text }}>
                {STATUT_META[selection.statut].label}
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
              <Info label="Téléphone">{selection.telephone}</Info>
              <Info label="E-mail">{selection.email}</Info>
              <Info label="Région">{selection.region_libelle}</Info>
              <Info label="Commune / adresse">{[selection.commune, selection.adresse].filter(Boolean).join(', ')}</Info>
              <Info label="Véhicule">
                {selection.type_vehicule_libelle}
                {selection.nombre_vehicules > 1 ? ` × ${selection.nombre_vehicules}` : ''}
              </Info>
              <Info label="Immatriculation">{selection.immatriculation}</Info>
              <Info label="Disponibilités">{selection.disponibilites}</Info>
              <Info label="Contact d'urgence">
                {[selection.contact_urgence_nom, selection.contact_urgence_telephone].filter(Boolean).join(' · ')}
              </Info>
              {selection.rdv_date && (
                <Info label="Rendez-vous">
                  {dateHeure(selection.rdv_date)} — {selection.rdv_lieu}
                </Info>
              )}
              {selection.numero_cni && <Info label="CNI vérifiée">{selection.numero_cni}</Info>}
            </dl>
            {selection.message && <p className="m-0 mt-3 rounded-xl bg-page p-3 text-[12.5px] italic text-body">« {selection.message} »</p>}

            <div className="mt-4">
              <Actions
                key={`${selection.id}-${selection.statut}`}
                d={selection}
                onFait={(reponse) => {
                  if (reponse.boitier_api_key) setCle({ boitier: reponse.boitier ?? null, valeur: reponse.boitier_api_key })
                  void recharger()
                }}
              />
            </div>

            <p className="m-0 mb-2 mt-5 text-xs font-extrabold text-ink">Historique</p>
            <ul className="flex flex-col gap-2">
              <li className="text-[12px] text-body">
                <span className="text-faint">{dateHeure(selection.date_creation)} — </span>Demande déposée sur le site
              </li>
              {(historique.id === selection.id ? historique.lignes : []).map((h) => (
                <li key={h.id} className="text-[12px] text-body">
                  <span className="text-faint">{dateHeure(h.date)} — </span>
                  {h.statut_nouveau_libelle} par {h.acteur_nom ?? 'compte supprimé'} ({ROLE_LIBELLE[h.role_acteur] ?? h.role_acteur})
                  {h.commentaire ? ` : « ${h.commentaire} »` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
