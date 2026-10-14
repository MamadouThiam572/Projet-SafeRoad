import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, getJournalActivite, type LigneJournalApi } from '@/lib/api'
import { REGIONS } from '@/lib/regions'

/**
 * Super Admin → Historique : journal de toutes les décisions et actions de la plateforme
 * (zones, signalements, incidents, boîtiers, demandes d'installation), avec leur auteur, son
 * rôle et le motif. Données réelles : GET /journal-activite/.
 */

const CATEGORIES: { cle: LigneJournalApi['categorie']; label: string; icon: string; tint: string; soft: string }[] = [
  { cle: 'zone', label: 'Zones', icon: 'location_on', tint: '#7c3aed', soft: '#f1eafe' },
  { cle: 'signalement', label: 'Signalements', icon: 'campaign', tint: '#2b6cb0', soft: '#e8f0f9' },
  { cle: 'incident', label: 'Incidents', icon: 'warning', tint: '#dc3a2f', soft: '#fdeeec' },
  { cle: 'boitier', label: 'Boîtiers', icon: 'memory', tint: '#1f9d55', soft: '#e9f6ee' },
  { cle: 'demande', label: 'Demandes', icon: 'assignment', tint: '#e8940c', soft: '#fdf4e6' },
]
const META = Object.fromEntries(CATEGORIES.map((c) => [c.cle, c]))
const PERIODES = [
  { jours: 7, label: '7 derniers jours' },
  { jours: 30, label: '30 derniers jours' },
  { jours: 90, label: '3 derniers mois' },
  { jours: 365, label: '12 derniers mois' },
]
const PAR_PAGE = 15

const p2 = (n: number) => String(n).padStart(2, '0')
const dateHeure = (iso: string) => {
  const t = new Date(iso)
  return { date: `${p2(t.getDate())}/${p2(t.getMonth() + 1)}/${t.getFullYear()}`, heure: `${p2(t.getHours())}:${p2(t.getMinutes())}` }
}

export function HistoriquePage() {
  const [jours, setJours] = useState(30)
  const [region, setRegion] = useState('')
  const [categorie, setCategorie] = useState('')
  const [recherche, setRecherche] = useState('')
  const [lignes, setLignes] = useState<LigneJournalApi[] | null>(null)
  const [erreur, setErreur] = useState('')
  const [page, setPage] = useState(1)

  // Toutes catégories chargées une fois ; catégorie et recherche filtrent sur place.
  const charger = useCallback(async () => {
    try {
      setLignes((await getJournalActivite(jours, '', region)).lignes)
      setErreur('')
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Serveur injoignable : vérifiez que le backend est lancé.')
    }
  }, [jours, region])

  useEffect(() => {
    void charger()
  }, [charger])

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    return (lignes ?? []).filter(
      (l) =>
        (!categorie || l.categorie === categorie) &&
        (!q || `${l.objet} ${l.action} ${l.commentaire} ${l.acteur}`.toLowerCase().includes(q)),
    )
  }, [lignes, categorie, recherche])

  const pages = Math.max(1, Math.ceil(filtrees.length / PAR_PAGE))
  const courante = Math.min(page, pages)
  const visibles = filtrees.slice((courante - 1) * PAR_PAGE, courante * PAR_PAGE)

  const exporter = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
    const csv =
      '﻿' +
      [
        ['Date', 'Heure', 'Catégorie', 'Objet', 'Région', 'Action', 'Motif / observation', 'Acteur', 'Rôle'],
        ...filtrees.map((l) => {
          const { date, heure } = dateHeure(l.date)
          return [date, heure, META[l.categorie]?.label ?? l.categorie, l.objet, l.region_libelle ?? '', l.action, l.commentaire, l.acteur, l.role]
        }),
      ]
        .map((r) => r.map(esc).join(';'))
        .join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `historique-saferoad-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
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
            <span className="ic text-[26px]">history</span>
          </span>
          <div className="min-w-0">
            <h1 className="text-[clamp(24px,2.8vw,32px)] font-extrabold leading-[1.1] tracking-[-0.026em] text-navy-900">Historique</h1>
            <p className="mt-1 text-[13.5px] leading-relaxed text-info-600">
              Journal des décisions et actions : qui a fait quoi, quand, et sur quelles bases.
            </p>
          </div>
        </div>
        <div className="ml-auto flex flex-col items-end gap-1.5">
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <button type="button" onClick={() => void charger()} className={headBtn}>
              <span className="ic text-xl text-info-600">refresh</span>
              Actualiser
            </button>
            <button type="button" onClick={exporter} disabled={filtrees.length === 0} className={headBtn}>
              <span className="ic text-xl text-info-600">download</span>
              Exporter
            </button>
          </div>
          {erreur && <p className="m-0 text-[11px] font-semibold text-danger-600">{erreur}</p>}
        </div>
      </section>

      <section className="mx-6 mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {CATEGORIES.map((c) => {
          const actif = categorie === c.cle
          return (
            <button
              key={c.cle}
              type="button"
              onClick={() => {
                setCategorie(actif ? '' : c.cle)
                setPage(1)
              }}
              className={`flex min-w-0 items-center gap-3.5 rounded-xl border bg-white p-4 text-left shadow-card ${actif ? 'border-brand-600' : 'border-line'}`}
            >
              <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full" style={{ background: c.soft, color: c.tint }}>
                <span className="ic text-[26px]">{c.icon}</span>
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-bold text-ink">{c.label}</span>
                <span className="block text-[26px] font-extrabold leading-none tracking-tight text-navy-900">
                  {lignes ? lignes.filter((l) => l.categorie === c.cle).length : '…'}
                </span>
                <span className="mt-1 block text-[11px] font-medium text-info-600">actions sur la période</span>
              </span>
            </button>
          )
        })}
      </section>

      <section className="mx-6 mt-4 grid grid-cols-1 gap-3.5 rounded-xl border border-line bg-white p-4 shadow-card md:grid-cols-[2fr_1fr_1fr_1fr]">
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-ink">Recherche</span>
          <input
            value={recherche}
            onChange={(e) => {
              setRecherche(e.target.value)
              setPage(1)
            }}
            placeholder="Objet, action, motif, acteur…"
            className="w-full rounded-[9px] border-[1.5px] border-line-field bg-field px-3 py-2 text-[12.5px] font-medium text-ink outline-none placeholder:text-faint focus:border-brand-600"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-ink">Période</span>
          <select value={jours} onChange={(e) => setJours(Number(e.target.value))} className={selectCls}>
            {PERIODES.map((p) => (
              <option key={p.jours} value={p.jours}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-ink">Région</span>
          <select value={region} onChange={(e) => setRegion(e.target.value)} className={selectCls}>
            <option value="">Toutes les régions</option>
            {REGIONS.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-ink">Catégorie</span>
          <select
            value={categorie}
            onChange={(e) => {
              setCategorie(e.target.value)
              setPage(1)
            }}
            className={selectCls}
          >
            <option value="">Toutes</option>
            {CATEGORIES.map((c) => (
              <option key={c.cle} value={c.cle}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="mx-6 mt-4 overflow-hidden rounded-xl border border-line bg-white shadow-card">
        <p className="m-0 border-b border-line-soft px-5 py-3.5 text-[14.5px] font-extrabold text-navy-900">
          Journal d'activité <span className="font-medium text-body">({filtrees.length})</span>
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-line-soft text-[10.5px] font-bold uppercase tracking-wide text-faint">
                <th className="px-5 py-3">Date</th>
                <th className="px-3 py-3">Catégorie</th>
                <th className="px-3 py-3">Objet</th>
                <th className="px-3 py-3">Action</th>
                <th className="px-3 py-3">Motif / observation</th>
                <th className="px-5 py-3">Acteur</th>
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-faint">
                    {lignes ? 'Aucune action sur la période pour ces filtres.' : 'Chargement…'}
                  </td>
                </tr>
              )}
              {visibles.map((l, i) => {
                const m = META[l.categorie]
                const { date, heure } = dateHeure(l.date)
                return (
                  <tr key={`${l.date}-${i}`} className="border-b border-line-soft last:border-0 hover:bg-page">
                    <td className="px-5 py-3 text-body">
                      <p className="m-0 font-semibold text-ink">{date}</p>
                      <p className="m-0 text-[11px] text-faint">{heure}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: m?.soft, color: m?.tint }}>
                        <span className="ic text-sm">{m?.icon}</span>
                        {m?.label}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <p className="m-0 font-semibold text-ink">{l.objet}</p>
                      <p className="m-0 text-[11px] text-faint">{l.region_libelle ?? '—'}</p>
                    </td>
                    <td className="px-3 py-3 font-medium text-ink">{l.action}</td>
                    <td className="max-w-[280px] px-3 py-3 text-body">{l.commentaire || <span className="text-faint">—</span>}</td>
                    <td className="px-5 py-3">
                      <p className="m-0 font-semibold text-ink">{l.acteur}</p>
                      <p className="m-0 text-[11px] text-faint">{l.role}</p>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-line-soft px-5 py-3 text-[12px] text-body">
            <span>
              Page {courante} sur {pages}
            </span>
            <div className="flex gap-2">
              <button type="button" disabled={courante === 1} onClick={() => setPage(courante - 1)} className="rounded-lg border border-line px-3 py-1.5 font-bold disabled:opacity-40">
                Précédent
              </button>
              <button type="button" disabled={courante === pages} onClick={() => setPage(courante + 1)} className="rounded-lg border border-line px-3 py-1.5 font-bold disabled:opacity-40">
                Suivant
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
