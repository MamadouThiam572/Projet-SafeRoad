import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DANGER_META } from '@/data/adminSignalements'
import { useEnDirect } from '@/hooks/useEnDirect'
import {
  ApiError,
  creerSignalement,
  getSignalements,
  supprimerSignalement,
  type SignalementApi,
  type StatutSignalementApi,
  type TypeDanger,
} from '@/lib/api'

const STATUT_BADGE: Record<StatutSignalementApi, { label: string; fg: string; bg: string; icon: string }> = {
  a_verifier: { label: 'Envoyé', fg: '#e8940c', bg: '#fdf4e6', icon: 'schedule' },
  en_verification: { label: 'En vérification', fg: '#2b6cb0', bg: '#e8f0f9', icon: 'search' },
  valide: { label: 'Validé', fg: '#1f9d55', bg: '#e9f6ee', icon: 'check_circle' },
  rejete: { label: 'Non retenu', fg: '#dc3a2f', bg: '#fdeeec', icon: 'cancel' },
}

type TabKey = 'tous' | 'en_cours' | 'valides' | 'rejetes'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'tous', label: 'Tous' },
  { key: 'en_cours', label: 'En cours' },
  { key: 'valides', label: 'Validés' },
  { key: 'rejetes', label: 'Non retenus' },
]

function matchesTab(key: TabKey, s: SignalementApi): boolean {
  if (key === 'tous') return true
  if (key === 'en_cours') return s.statut === 'a_verifier' || s.statut === 'en_verification'
  if (key === 'valides') return s.statut === 'valide'
  return s.statut === 'rejete'
}

const dateCourte = (iso: string) => {
  const t = new Date(iso)
  const p2 = (n: number) => String(n).padStart(2, '0')
  return `${p2(t.getDate())}/${p2(t.getMonth() + 1)}/${t.getFullYear()} ${p2(t.getHours())}:${p2(t.getMinutes())}`
}

function ReportCard({ report, onRetirer, busy }: { report: SignalementApi; onRetirer: (id: number) => void; busy: boolean }) {
  const status = STATUT_BADGE[report.statut]
  const danger = DANGER_META[report.type_danger]
  return (
    <div className="flex flex-wrap items-start gap-4 rounded-2xl border border-line bg-white p-5 shadow-card transition-shadow hover:shadow-card-hover sm:items-center sm:flex-nowrap">
      <span
        className="flex h-[46px] w-[46px] flex-none items-center justify-center overflow-hidden rounded-full"
        style={{ background: danger.soft, color: danger.tint }}
      >
        <span className="ic text-2xl">{danger.icon}</span>
      </span>

      <div className="min-w-0 flex-1 basis-[220px]">
        <p className="m-0 text-[15px] font-extrabold text-ink">{report.type_danger_libelle}</p>
        {report.description && <p className="m-0 mt-1.5 text-[12.5px] leading-relaxed text-body">{report.description}</p>}
        <div className="mt-2.5 flex flex-wrap gap-3.5">
          <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted">
            <span className="ic text-[15px]">place</span>
            {[report.localite, report.region_libelle].filter(Boolean).join(' · ')}
          </span>
          <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted">
            <span className="ic text-[15px]">event</span>
            {dateCourte(report.date_creation)}
          </span>
          {report.photo_url && (
            <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted">
              <span className="ic text-[15px]">photo_camera</span>
              Photo jointe
            </span>
          )}
        </div>
      </div>

      <span
        className="flex flex-none items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2.5 text-[11.5px] font-bold"
        style={{ color: status.fg, background: status.bg }}
      >
        <span className="ic text-[15px]">{status.icon}</span>
        {status.label}
      </span>
      {/* Retrait possible tant qu'aucun administrateur ne l'a pris en charge (règle du backend). */}
      {report.statut === 'a_verifier' && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onRetirer(report.id)}
          className="flex h-[42px] flex-none items-center gap-1.5 rounded-[11px] border border-line bg-page px-3 text-[12px] font-bold text-body transition-colors hover:bg-line-soft disabled:opacity-50"
        >
          <span className="ic text-lg">delete</span>
          Retirer
        </button>
      )}
    </div>
  )
}

const TYPES: TypeDanger[] = ['nid_de_poule', 'chaussee_degradee', 'signalisation_absente', 'chaussee_inondee', 'obstacle', 'autre']

/**
 * Formulaire de signalement : la position vient du GPS du téléphone (la région en est déduite
 * par le backend), la photo est facultative (JPEG/PNG/WebP, 5 Mo max).
 */
function NouveauSignalement({ onFermer, onEnvoye }: { onFermer: () => void; onEnvoye: () => void }) {
  const [type, setType] = useState<TypeDanger>('nid_de_poule')
  const [description, setDescription] = useState('')
  const [localite, setLocalite] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [position, setPosition] = useState<GeolocationPosition | null>(null)
  const [etatGps, setEtatGps] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState('')

  const localiser = () => {
    if (!('geolocation' in navigator)) {
      setEtatGps("Ce navigateur ne donne pas accès à la position.")
      return
    }
    setEtatGps('Localisation en cours…')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition(pos)
        setEtatGps('')
      },
      () => setEtatGps("Position refusée ou indisponible : autorisez la localisation puis réessayez."),
      { enableHighAccuracy: true, timeout: 15_000 },
    )
  }

  const envoyer = async (e: FormEvent) => {
    e.preventDefault()
    if (!position) {
      setErreur("Ajoutez d'abord votre position : c'est elle qui situe le danger.")
      return
    }
    const donnees = new FormData()
    donnees.append('type_danger', type)
    donnees.append('description', description.trim())
    donnees.append('localite', localite.trim())
    donnees.append('latitude', String(position.coords.latitude))
    donnees.append('longitude', String(position.coords.longitude))
    donnees.append('precision_metres', String(Math.round(position.coords.accuracy)))
    if (photo) donnees.append('photo', photo)
    setEnvoi(true)
    setErreur('')
    try {
      await creerSignalement(donnees)
      onEnvoye()
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Envoi impossible : serveur injoignable.')
    } finally {
      setEnvoi(false)
    }
  }

  const champ = 'mt-1.5 w-full rounded-xl border-[1.5px] border-line-field bg-field px-3.5 py-2.5 text-[13px] text-ink outline-none focus:border-brand-600'

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-[rgba(6,35,52,0.55)] p-4" onClick={onFermer}>
      <form
        onSubmit={(e) => void envoyer(e)}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-[480px] overflow-y-auto rounded-2xl bg-white p-6 shadow-card"
      >
        <div className="flex items-center justify-between">
          <p className="m-0 text-[17px] font-extrabold text-ink">Signaler un danger</p>
          <button type="button" onClick={onFermer} className="ic text-xl text-faint hover:text-ink" aria-label="Fermer">
            close
          </button>
        </div>

        <label className="mt-4 block text-[12.5px] font-bold text-body">
          Type de danger
          <select value={type} onChange={(e) => setType(e.target.value as TypeDanger)} className={champ}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {DANGER_META[t].label}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-4">
          <p className="m-0 text-[12.5px] font-bold text-body">Position du danger</p>
          {position ? (
            <p className="m-0 mt-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-success-600">
              <span className="ic text-base">my_location</span>
              Position enregistrée (précision ± {Math.round(position.coords.accuracy)} m)
            </p>
          ) : (
            <button
              type="button"
              onClick={localiser}
              className="mt-1.5 flex items-center gap-2 rounded-xl border-[1.5px] border-brand-600 px-4 py-2.5 text-[12.5px] font-bold text-brand-600 hover:bg-brand-50"
            >
              <span className="ic text-base">my_location</span>
              Utiliser ma position actuelle
            </button>
          )}
          {etatGps && <p className="m-0 mt-1.5 text-[11.5px] font-semibold text-faint">{etatGps}</p>}
          <p className="m-0 mt-1.5 text-[11px] text-faint">Faites le signalement sur place, une fois arrêté en sécurité.</p>
        </div>

        <label className="mt-4 block text-[12.5px] font-bold text-body">
          Lieu (facultatif)
          <input value={localite} onChange={(e) => setLocalite(e.target.value)} maxLength={150} placeholder="Ex. : RN1, sortie de Mbour" className={champ} />
        </label>

        <label className="mt-4 block text-[12.5px] font-bold text-body">
          Description (facultatif)
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Ce que vous avez constaté" className={champ} />
        </label>

        <label className="mt-4 block text-[12.5px] font-bold text-body">
          Photo (facultatif — JPEG, PNG ou WebP, 5 Mo max)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            className="mt-1.5 block w-full text-[12px] text-body"
          />
        </label>

        {erreur && <p className="m-0 mt-3 text-xs font-semibold text-danger-600">{erreur}</p>}

        <button
          type="submit"
          disabled={envoi}
          className="mt-5 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-[13.5px] font-bold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          <span className="ic text-lg">send</span>
          {envoi ? 'Envoi…' : 'Envoyer le signalement'}
        </button>
      </form>
    </div>
  )
}

export function SignalementsPage() {
  const [tab, setTab] = useState<TabKey>('tous')
  const [params, setParams] = useSearchParams()
  const formulaireOuvert = params.get('nouveau') === '1'
  const { donnees, erreur, recharger } = useEnDirect(getSignalements, 30_000)
  const reports = useMemo(() => donnees ?? [], [donnees])
  const [retrait, setRetrait] = useState<number | null>(null)
  const [message, setMessage] = useState('')

  const filtered = useMemo(() => reports.filter((r) => matchesTab(tab, r)), [tab, reports])

  const ouvrir = () => setParams({ nouveau: '1' })
  const fermer = () => setParams({})

  const retirer = async (id: number) => {
    setRetrait(id)
    setMessage('')
    try {
      await supprimerSignalement(id)
      await recharger()
      setMessage('Signalement retiré.')
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Retrait impossible : serveur injoignable.')
    } finally {
      setRetrait(null)
    }
  }

  return (
    <div>
      <section className="mx-6 mt-5 flex flex-wrap items-end justify-between gap-3.5">
        <div className="min-w-0">
          <h1 className="text-[clamp(23px,2.8vw,30px)] font-extrabold leading-[1.15] tracking-[-0.026em] text-ink">
            Mes signalements
          </h1>
          <p className="mt-2.5 text-sm leading-6 text-body">
            Contribuez à la sécurité routière en signalant les dangers que vous rencontrez.
          </p>
          {(erreur || message) && <p className="mt-1.5 text-xs font-semibold text-body">{message || erreur}</p>}
        </div>
        <button
          type="button"
          onClick={ouvrir}
          className="inline-flex min-h-[46px] items-center gap-2.5 whitespace-nowrap rounded-xl bg-brand-600 px-[22px] text-[13.5px] font-bold text-white shadow-[0_8px_22px_rgba(14,158,122,0.24)] transition-colors hover:bg-brand-700"
        >
          <span className="ic text-[19px]">add</span>
          Nouveau signalement
        </button>
      </section>

      <section className="mx-6 mt-4 flex flex-wrap gap-2.5">
        {TABS.map((t) => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap rounded-full border-[1.5px] px-5 py-3 text-[12.5px] font-bold transition-colors ${
                active
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-line bg-white text-body hover:border-brand-200'
              }`}
            >
              {t.label} ({reports.filter((r) => matchesTab(t.key, r)).length})
            </button>
          )
        })}
      </section>

      <section className="mx-6 mt-4 flex flex-col gap-3">
        {filtered.map((report) => (
          <ReportCard key={report.id} report={report} onRetirer={(id) => void retirer(id)} busy={retrait === report.id} />
        ))}

        {filtered.length === 0 && (
          <div className="rounded-2xl border border-line bg-white px-5 py-14 text-center shadow-card">
            <span className="ic text-4xl text-icon-muted">flag</span>
            <p className="mt-3.5 text-[15px] font-extrabold text-ink">
              {donnees ? 'Aucun signalement dans cette catégorie' : 'Chargement…'}
            </p>
            <p className="mt-1.5 text-sm leading-6 text-body">
              Vos remontées aident les administrateurs à confirmer les zones à risque.
            </p>
            <button
              type="button"
              onClick={ouvrir}
              className="mt-5 inline-flex min-h-[46px] items-center rounded-xl bg-brand-600 px-6 text-[13.5px] font-bold text-white transition-colors hover:bg-brand-700"
            >
              Signaler un danger
            </button>
          </div>
        )}
      </section>

      {formulaireOuvert && (
        <NouveauSignalement
          onFermer={fermer}
          onEnvoye={() => {
            fermer()
            setTab('tous')
            setMessage('Signalement envoyé : un administrateur de la région va le vérifier.')
            void recharger()
          }}
        />
      )}
    </div>
  )
}
