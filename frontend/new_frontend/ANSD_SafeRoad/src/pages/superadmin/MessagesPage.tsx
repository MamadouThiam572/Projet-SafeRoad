import { useMemo, useState } from 'react'
import { useEnDirect } from '@/hooks/useEnDirect'
import { ApiError, getMessagesContact, traiterMessageContact } from '@/lib/api'

const p2 = (n: number) => String(n).padStart(2, '0')
const dateHeure = (iso: string) => {
  const t = new Date(iso)
  return `${p2(t.getDate())}/${p2(t.getMonth() + 1)}/${t.getFullYear()} ${p2(t.getHours())}:${p2(t.getMinutes())}`
}

/** Messages reçus par le formulaire Contact du site public ; réponse par e-mail, puis « traité ». */
export function MessagesPage() {
  const { donnees, erreur, recharger } = useEnDirect(getMessagesContact, 60_000)
  const [afficherTraites, setAfficherTraites] = useState(false)
  const [enCours, setEnCours] = useState<number | null>(null)
  const [erreurAction, setErreurAction] = useState('')

  const messages = useMemo(
    () => (donnees ?? []).filter((m) => afficherTraites || !m.traite).sort((a, b) => b.date_creation.localeCompare(a.date_creation)),
    [donnees, afficherTraites],
  )
  const nonTraites = (donnees ?? []).filter((m) => !m.traite).length

  const traiter = async (id: number) => {
    setEnCours(id)
    setErreurAction('')
    try {
      await traiterMessageContact(id)
      await recharger()
    } catch (err) {
      setErreurAction(err instanceof ApiError ? err.message : 'Serveur injoignable : action non enregistrée.')
    } finally {
      setEnCours(null)
    }
  }

  return (
    <div className="pb-8">
      <section className="mx-6 mt-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[clamp(21px,2.6vw,26px)] font-extrabold leading-[1.15] tracking-[-0.026em] text-ink">Messages de contact</h1>
          <p className="mt-1.5 text-sm text-body">
            {nonTraites} message{nonTraites > 1 ? 's' : ''} à traiter, reçu{nonTraites > 1 ? 's' : ''} par le formulaire Contact du site.
          </p>
          {(erreur || erreurAction) && <p className="mt-1.5 text-xs font-semibold text-danger-600">{erreurAction || erreur}</p>}
        </div>
        <label className="flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-[12.5px] font-bold text-body">
          <input type="checkbox" checked={afficherTraites} onChange={(e) => setAfficherTraites(e.target.checked)} className="accent-brand-600" />
          Afficher les messages traités
        </label>
      </section>

      <section className="mx-6 mt-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="rounded-2xl border border-line bg-white px-5 py-12 text-center text-sm text-faint shadow-card">
            {donnees ? 'Aucun message à traiter.' : 'Chargement…'}
          </div>
        )}
        {messages.map((m) => (
          <article key={m.id} className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="m-0 text-[14.5px] font-extrabold text-ink">{m.nom}</p>
                <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[10.5px] font-bold text-brand-700">{m.sujet_libelle}</span>
                {m.traite && <span className="rounded-md bg-[#e9f6ee] px-2 py-0.5 text-[10.5px] font-bold text-success-600">Traité</span>}
              </div>
              <span className="text-[11.5px] font-semibold text-faint">{dateHeure(m.date_creation)}</span>
            </div>
            <p className="m-0 mt-2.5 whitespace-pre-line text-[13px] leading-relaxed text-body">{m.message}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <a href={`mailto:${m.email}?subject=${encodeURIComponent(`SafeRoad — ${m.sujet_libelle}`)}`} className="flex items-center gap-1.5 text-[12.5px] font-bold text-brand-600">
                <span className="ic text-base">mail</span>
                Répondre à {m.email}
              </a>
              {m.telephone && <span className="text-[12px] text-body">{m.telephone}</span>}
              {!m.traite && (
                <button
                  type="button"
                  disabled={enCours === m.id}
                  onClick={() => void traiter(m.id)}
                  className="ml-auto rounded-[10px] bg-brand-600 px-3.5 py-2 text-[12px] font-bold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  Marquer comme traité
                </button>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
