import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useEnDirect } from '@/hooks/useEnDirect'
import { ApiError, getNotifications, marquerNotificationLue, marquerToutesNotificationsLues, type NotificationApi } from '@/lib/api'
import { PATHS } from '@/routes/paths'

/** Super Admin → Notifications : événements qui demandent l'attention de l'administration. */

const TYPE_META: Record<string, { icon: string; tint: string; soft: string }> = {
  incident_critique: { icon: 'warning', tint: '#dc3a2f', soft: '#fdeeec' },
  nouvelle_zone: { icon: 'location_on', tint: '#7c3aed', soft: '#f1eafe' },
  zone_a_valider: { icon: 'fact_check', tint: '#e8940c', soft: '#fdf4e6' },
  zone_soumise_anaser: { icon: 'send', tint: '#7c3aed', soft: '#f1eafe' },
  decision_anaser: { icon: 'verified_user', tint: '#1f9d55', soft: '#e9f6ee' },
  nouveau_signalement: { icon: 'campaign', tint: '#2b6cb0', soft: '#e8f0f9' },
  nouvelle_demande: { icon: 'assignment', tint: '#0e9f8e', soft: '#e0f5f2' },
  sync_echouee: { icon: 'sync_problem', tint: '#dc3a2f', soft: '#fdeeec' },
  feedback_anaser: { icon: 'forum', tint: '#2b6cb0', soft: '#e8f0f9' },
  boitier_inconnu: { icon: 'memory', tint: '#e8940c', soft: '#fdf4e6' },
}
const DEFAUT = { icon: 'notifications', tint: '#2b6cb0', soft: '#e8f0f9' }

const p2 = (n: number) => String(n).padStart(2, '0')
const dateHeure = (iso: string) => {
  const t = new Date(iso)
  return `${p2(t.getDate())}/${p2(t.getMonth() + 1)}/${t.getFullYear()} ${p2(t.getHours())}:${p2(t.getMinutes())}`
}

/** Page de l'application où traiter l'objet de la notification. */
function lienDe(n: NotificationApi): { to: string; label: string } | null {
  if (n.incident) return { to: `${PATHS.superAdmin.incidents}?q=INC-${p2(n.incident)}`, label: "Voir l'incident" }
  if (n.zone) return { to: PATHS.superAdmin.zones, label: 'Voir la zone' }
  if (n.signalement) return { to: `${PATHS.superAdmin.signalements}?q=SIG-${p2(n.signalement)}`, label: 'Voir le signalement' }
  if (n.boitier) return { to: `${PATHS.superAdmin.monitoring}?q=SR-${n.boitier.slice(0, 8).toUpperCase()}`, label: 'Voir le boîtier' }
  if (n.type_notification === 'nouvelle_demande') return { to: PATHS.superAdmin.demandes, label: 'Voir les demandes' }
  if (n.type_notification === 'boitier_inconnu') return { to: PATHS.superAdmin.boitiers, label: 'Créer sa fiche' }
  return null
}

export function NotificationsPage() {
  const { donnees, erreur, maj, recharger } = useEnDirect(getNotifications, 30_000)
  const notifications = useMemo(
    () => [...(donnees ?? [])].sort((a, b) => b.date_creation.localeCompare(a.date_creation)),
    [donnees],
  )
  const [statut, setStatut] = useState<'toutes' | 'non_lues' | 'lues'>('toutes')
  const [type, setType] = useState('tous')
  const [recherche, setRecherche] = useState('')
  const [message, setMessage] = useState('')

  const types = useMemo(() => {
    const m = new Map<string, string>()
    for (const n of notifications) m.set(n.type_notification, n.type_notification_libelle)
    return [...m].sort((a, b) => a[1].localeCompare(b[1], 'fr'))
  }, [notifications])

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    return notifications.filter(
      (n) =>
        (statut === 'toutes' || (statut === 'lues') === n.lue) &&
        (type === 'tous' || n.type_notification === type) &&
        (!q || n.message.toLowerCase().includes(q) || n.type_notification_libelle.toLowerCase().includes(q)),
    )
  }, [notifications, statut, type, recherche])

  const aujourdHui = new Date().toISOString().slice(0, 10)
  const nonLues = notifications.filter((n) => !n.lue).length
  const kpis = [
    { cle: 'total', icon: 'notifications', tint: '#2b6cb0', soft: '#e8f0f9', label: 'Notifications', valeur: notifications.length, sub: 'Reçues au total' },
    { cle: 'non_lues', icon: 'mark_email_unread', tint: '#dc3a2f', soft: '#fdeeec', label: 'Non lues', valeur: nonLues, sub: 'À consulter' },
    { cle: 'jour', icon: 'today', tint: '#1f9d55', soft: '#e9f6ee', label: "Aujourd'hui", valeur: notifications.filter((n) => n.date_creation.slice(0, 10) === aujourdHui).length, sub: 'Reçues ce jour' },
    { cle: 'types', icon: 'category', tint: '#7c3aed', soft: '#f1eafe', label: 'Types', valeur: types.length, sub: "Catégories d'événements" },
  ]

  const action = async (appel: () => Promise<unknown>, succes: string) => {
    try {
      await appel()
      setMessage(succes)
      await recharger()
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Action impossible : serveur injoignable.')
    }
  }

  const selectCls =
    'w-full cursor-pointer rounded-[9px] border-[1.5px] border-line-field bg-white px-2.5 py-2 text-[12.5px] font-medium text-ink outline-none focus:border-brand-600'
  const headBtn =
    'inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-line bg-white px-4 py-3 text-[12.5px] font-bold text-ink shadow-card transition-colors hover:bg-page disabled:opacity-50'

  return (
    <div className="pb-8">
      <section className="mx-6 mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-navy-900 text-white">
            <span className="ic text-[26px]">notifications</span>
          </span>
          <div className="min-w-0">
            <h1 className="text-[clamp(24px,2.8vw,32px)] font-extrabold leading-[1.1] tracking-[-0.026em] text-navy-900">Notifications</h1>
            <p className="mt-1 text-[13.5px] leading-relaxed text-info-600">
              Événements de la plateforme qui demandent votre attention : incidents critiques, zones, signalements, demandes, boîtiers.
            </p>
          </div>
        </div>
        <div className="ml-auto flex flex-col items-end gap-1.5">
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <button type="button" onClick={() => void recharger()} className={headBtn}>
              <span className="ic text-xl text-info-600">refresh</span>
              Actualiser
            </button>
            <button
              type="button"
              disabled={nonLues === 0}
              onClick={() => void action(marquerToutesNotificationsLues, 'Toutes les notifications sont marquées comme lues.')}
              className={headBtn}
            >
              <span className="ic text-xl text-info-600">done_all</span>
              Tout marquer comme lu
            </button>
          </div>
          <p className="m-0 text-[10.5px] font-medium text-faint">
            Dernière mise à jour : {new Date(maj).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
          </p>
          {(erreur || message) && <p className="m-0 text-[11px] font-semibold text-body">{message || erreur}</p>}
        </div>
      </section>

      <section className="mx-6 mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.cle} className="flex min-w-0 items-center gap-3.5 rounded-xl border border-line bg-white p-4 shadow-card">
            <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full" style={{ background: k.soft, color: k.tint }}>
              <span className="ic text-[26px]">{k.icon}</span>
            </span>
            <div className="min-w-0">
              <p className="m-0 text-[13px] font-bold text-ink">{k.label}</p>
              <p className="m-0 mt-0.5 text-[26px] font-extrabold leading-none tracking-tight text-navy-900">{donnees ? k.valeur : '…'}</p>
              <p className="m-0 mt-1.5 text-[11px] font-medium text-info-600">{k.sub}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="mx-6 mt-4 grid grid-cols-1 gap-3.5 rounded-xl border border-line bg-white p-4 shadow-card md:grid-cols-[2fr_1fr_1fr]">
        <label className="relative block">
          <span className="mb-1 block text-[11px] font-bold text-ink">Recherche</span>
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher dans les notifications…"
            className="w-full rounded-[9px] border-[1.5px] border-line-field bg-field px-3 py-2 text-[12.5px] font-medium text-ink outline-none placeholder:text-faint focus:border-brand-600"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-ink">Statut</span>
          <select value={statut} onChange={(e) => setStatut(e.target.value as typeof statut)} className={selectCls}>
            <option value="toutes">Toutes</option>
            <option value="non_lues">Non lues</option>
            <option value="lues">Lues</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-ink">Type</span>
          <select value={type} onChange={(e) => setType(e.target.value)} className={selectCls}>
            <option value="tous">Tous les types</option>
            {types.map(([cle, libelle]) => (
              <option key={cle} value={cle}>
                {libelle}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="mx-6 mt-4 rounded-xl border border-line bg-white shadow-card">
        <p className="m-0 border-b border-line-soft px-5 py-3.5 text-[14.5px] font-extrabold text-navy-900">
          Liste des notifications <span className="font-medium text-body">({filtrees.length})</span>
        </p>
        <ul className="m-0 flex list-none flex-col p-0">
          {filtrees.length === 0 && (
            <li className="px-5 py-10 text-center text-[12.5px] text-faint">{donnees ? 'Aucune notification pour ces filtres.' : 'Chargement…'}</li>
          )}
          {filtrees.map((n) => {
            const meta = TYPE_META[n.type_notification] ?? DEFAUT
            const lien = lienDe(n)
            return (
              <li key={n.id} className={`flex flex-wrap items-center gap-3.5 border-b border-line-soft px-5 py-3.5 last:border-0 ${n.lue ? '' : 'bg-[#f6fbff]'}`}>
                <span className="relative flex h-10 w-10 flex-none items-center justify-center rounded-full" style={{ background: meta.soft, color: meta.tint }}>
                  <span className="ic text-xl">{meta.icon}</span>
                  {!n.lue && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-danger-600" />}
                </span>
                <div className="min-w-0 flex-1 basis-[260px]">
                  <p className={`m-0 text-[13px] text-ink ${n.lue ? 'font-medium' : 'font-bold'}`}>{n.message}</p>
                  <p className="m-0 mt-1 flex flex-wrap items-center gap-2 text-[11px] text-faint">
                    <span className="rounded-md px-1.5 py-0.5 font-bold" style={{ background: meta.soft, color: meta.tint }}>
                      {n.type_notification_libelle}
                    </span>
                    {dateHeure(n.date_creation)}
                  </p>
                </div>
                <div className="flex flex-none items-center gap-2">
                  {lien && (
                    <Link to={lien.to} className="rounded-lg border border-line px-3 py-1.5 text-[11.5px] font-bold text-info-600 hover:bg-page">
                      {lien.label}
                    </Link>
                  )}
                  {!n.lue && (
                    <button
                      type="button"
                      onClick={() => void action(() => marquerNotificationLue(n.id), 'Notification marquée comme lue.')}
                      className="rounded-lg bg-brand-600 px-3 py-1.5 text-[11.5px] font-bold text-white hover:bg-brand-700"
                    >
                      Marquer comme lue
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
