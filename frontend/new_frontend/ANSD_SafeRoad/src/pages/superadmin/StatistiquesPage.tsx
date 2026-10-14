import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { ApiError, getStatistiquesDetaillees, type RepartitionApi, type StatistiquesDetailleesApi } from '@/lib/api'
import { REGIONS } from '@/lib/regions'

/**
 * Super Admin → Statistiques : analyse des données SafeRoad (incidents des boîtiers,
 * signalements des conducteurs, alertes, zones) sur une période, une région et une localité
 * (zone). Données réelles : GET /statistiques/detaillees/.
 */

const PERIODES: { jours: number; label: string }[] = [
  { jours: 7, label: '7 derniers jours' },
  { jours: 30, label: '30 derniers jours' },
  { jours: 90, label: '3 derniers mois' },
  { jours: 365, label: '12 derniers mois' },
]

type TypeDonnees = 'tous' | 'incidents' | 'signalements' | 'zones'
type Pas = 'jour' | 'semaine' | 'mois'

/** Ordre catégoriel fixe (validé daltonisme) ; « Autre » reste un gris neutre volontaire. */
const CATEGORIES = ['#2b6cb0', '#e8940c', '#0e9f8e', '#7c3aed', '#d9a40c']
const AUTRE = '#94a3b8'
const SERIE_INCIDENTS = '#2b6cb0'
const SERIE_SIGNALEMENTS = '#0e9f8e'
const GRAVITE_COULEUR: Record<string, string> = { critique: '#dc3a2f', moyen: '#e8940c', vigilance: '#e8940c', faible: '#1f9d55', normale: '#1f9d55' }
const ZONES_COULEUR: Record<string, string> = { a_valider: '#e8940c', soumises: '#7c3aed', reconnues: '#1f9d55', rejetees: '#dc3a2f' }

const nf = new Intl.NumberFormat('fr-FR')
const fmt = (n: number) => nf.format(n).replace(/\s/g, ' ')
const p2 = (n: number) => String(n).padStart(2, '0')
const jjmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

function formatNow(instant: number): string {
  const d = new Date(instant)
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}

/** Agrège la série journalière par semaine (7 jours) ou par mois. */
function regrouper(series: StatistiquesDetailleesApi['series'], pas: Pas, champ: 'incidents' | 'signalements') {
  if (pas === 'jour') return series.map((j) => ({ label: jjmm(j.date), valeur: j[champ] }))
  const groupes = new Map<string, number>()
  series.forEach((j, i) => {
    const cle = pas === 'mois' ? `${MOIS[Number(j.date.slice(5, 7)) - 1]} ${j.date.slice(2, 4)}` : `sem. ${jjmm(series[Math.floor(i / 7) * 7].date)}`
    groupes.set(cle, (groupes.get(cle) ?? 0) + j[champ])
  })
  return [...groupes].map(([label, valeur]) => ({ label, valeur }))
}

/** Plie au-delà de 5 catégories dans « Autre », couleurs dans l'ordre fixe. */
function parts(rep: RepartitionApi[]) {
  const tete = rep.slice(0, 5).map((r, i) => ({ ...r, couleur: CATEGORIES[i] }))
  const reste = rep.slice(5)
  if (reste.length) {
    const nombre = reste.reduce((a, r) => a + r.nombre, 0)
    const pourcentage = Math.round(reste.reduce((a, r) => a + r.pourcentage, 0) * 10) / 10
    tete.push({ cle: 'autre', libelle: 'Autre', nombre, pourcentage, couleur: AUTRE })
  }
  return tete
}

/* ------------------------------------------------------------------ */
/* Graphiques                                                          */
/* ------------------------------------------------------------------ */

function Carte({ titre, droite, children, className = '' }: { titre: string; droite?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-xl border border-line bg-white p-4 shadow-card ${className}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-[14.5px] font-extrabold text-navy-900">{titre}</p>
        {droite}
      </div>
      {children}
    </section>
  )
}

function SelecteurPas({ pas, onChange }: { pas: Pas; onChange: (p: Pas) => void }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-line text-[11px] font-bold">
      {(['jour', 'semaine', 'mois'] as Pas[]).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`px-3 py-1.5 capitalize ${pas === p ? 'bg-brand-600 text-white' : 'bg-white text-body hover:bg-page'}`}
        >
          {p}
        </button>
      ))}
    </div>
  )
}

/** Courbe + aire légère, une seule série (pas de légende : le titre la nomme), réticule au survol. */
function Courbe({ points, couleur, unite }: { points: { label: string; valeur: number }[]; couleur: string; unite: string }) {
  const [survol, setSurvol] = useState<number | null>(null)
  const ref = useRef<SVGSVGElement>(null)
  const L = 400
  const H = 150
  const G = 34
  const B = 22
  const max = Math.max(4, ...points.map((p) => p.valeur))
  const pasY = Math.ceil(max / 4)
  const haut = pasY * 4
  const x = (i: number) => G + (points.length <= 1 ? 0 : (i / (points.length - 1)) * (L - G - 8))
  const y = (v: number) => 8 + (1 - v / haut) * (H - B - 8)
  const trace = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.valeur).toFixed(1)}`).join(' ')
  const aire = points.length ? `${trace} L${x(points.length - 1)} ${H - B} L${x(0)} ${H - B} Z` : ''
  const etiquettes = points.length > 8 ? points.map((_, i) => i).filter((i) => i % Math.ceil(points.length / 7) === 0) : points.map((_, i) => i)

  const bouger = (e: ReactMouseEvent<SVGSVGElement>) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r || points.length === 0) return
    const px = ((e.clientX - r.left) / r.width) * L
    setSurvol(Math.max(0, Math.min(points.length - 1, Math.round(((px - G) / (L - G - 8)) * (points.length - 1)))))
  }

  return (
    <div className="relative">
      <svg ref={ref} viewBox={`0 0 ${L} ${H}`} className="block w-full" onMouseMove={bouger} onMouseLeave={() => setSurvol(null)} role="img" aria-label={`Évolution des ${unite}`}>
        {[0, 1, 2, 3, 4].map((k) => (
          <g key={k}>
            <line x1={G} x2={L - 8} y1={y(pasY * k)} y2={y(pasY * k)} stroke="#e7edf2" strokeWidth={1} />
            <text x={G - 6} y={y(pasY * k) + 3.5} textAnchor="end" fontSize={10} fill="#8a9aa8">
              {pasY * k}
            </text>
          </g>
        ))}
        <path d={aire} fill={couleur} opacity={0.1} />
        <path d={trace} fill="none" stroke={couleur} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {etiquettes.map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="#8a9aa8">
            {points[i].label}
          </text>
        ))}
        {survol !== null && points[survol] && (
          <g>
            <line x1={x(survol)} x2={x(survol)} y1={8} y2={H - B} stroke="#94a3b8" strokeDasharray="3 3" />
            <circle cx={x(survol)} cy={y(points[survol].valeur)} r={4.5} fill={couleur} stroke="#fff" strokeWidth={2} />
          </g>
        )}
      </svg>
      {survol !== null && points[survol] && (
        <div
          className="pointer-events-none absolute top-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[11.5px] shadow-card"
          style={{ left: `${(x(survol) / L) * 100}%`, transform: 'translateX(-50%)' }}
        >
          <span className="font-semibold text-faint">{points[survol].label}</span>
          <span className="ml-2 font-extrabold text-ink">
            {fmt(points[survol].valeur)} {unite}
          </span>
        </div>
      )}
      {points.every((p) => p.valeur === 0) && (
        <p className="m-0 -mt-1 text-center text-[11.5px] text-faint">Aucun {unite.replace(/s$/, '')} sur la période.</p>
      )}
    </div>
  )
}

/** Anneau avec total au centre ; légende toujours visible (libellé + %), 2 px d'écart entre segments. */
function Anneau({ segments, total, unite }: { segments: { libelle: string; nombre: number; pourcentage: number; couleur: string }[]; total: number; unite: string }) {
  const [survol, setSurvol] = useState<string | null>(null)
  const R = 52
  const C = 2 * Math.PI * R
  const somme = segments.reduce((a, s) => a + s.nombre, 0)
  let curseur = 0
  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg viewBox="0 0 140 140" className="h-[140px] w-[140px] flex-none" role="img" aria-label={`Répartition des ${unite}`}>
        <circle cx={70} cy={70} r={R} fill="none" stroke="#eef2f5" strokeWidth={20} />
        {somme > 0 &&
          segments.map((s) => {
            const long = (s.nombre / somme) * C
            const trait = (
              <circle
                key={s.libelle}
                cx={70}
                cy={70}
                r={R}
                fill="none"
                stroke={s.couleur}
                strokeWidth={survol === s.libelle ? 24 : 20}
                strokeDasharray={`${Math.max(long - (segments.length > 1 ? 2 : 0), 0)} ${C}`}
                strokeDashoffset={-curseur}
                transform="rotate(-90 70 70)"
                onMouseEnter={() => setSurvol(s.libelle)}
                onMouseLeave={() => setSurvol(null)}
              >
                <title>{`${s.libelle} : ${fmt(s.nombre)} (${s.pourcentage} %)`}</title>
              </circle>
            )
            curseur += long
            return trait
          })}
        <text x={70} y={68} textAnchor="middle" fontSize={22} fontWeight={800} fill="#073B4C">
          {fmt(total)}
        </text>
        <text x={70} y={86} textAnchor="middle" fontSize={10.5} fill="#8a9aa8">
          {unite}
        </text>
      </svg>
      <ul className="m-0 flex min-w-[150px] flex-1 list-none flex-col gap-2 p-0">
        {segments.length === 0 && <li className="text-[12px] text-faint">Aucune donnée sur la période.</li>}
        {segments.map((s) => (
          <li
            key={s.libelle}
            className={`flex items-center gap-2 text-[12px] ${survol && survol !== s.libelle ? 'opacity-50' : ''}`}
            onMouseEnter={() => setSurvol(s.libelle)}
            onMouseLeave={() => setSurvol(null)}
          >
            <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: s.couleur }} />
            <span className="min-w-0 flex-1 truncate font-medium text-body">{s.libelle}</span>
            <span className="font-bold text-ink">{s.pourcentage} %</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function StatistiquesPage() {
  const [jours, setJours] = useState(30)
  const [region, setRegion] = useState('')
  const [zone, setZone] = useState('')
  const [typeDonnees, setTypeDonnees] = useState<TypeDonnees>('tous')
  const [pasInc, setPasInc] = useState<Pas>('jour')
  const [pasSig, setPasSig] = useState<Pas>('jour')
  const [format, setFormat] = useState<'csv' | 'json'>('csv')
  const [donnees, setDonnees] = useState<StatistiquesDetailleesApi | null>(null)
  const [erreur, setErreur] = useState('')
  const [maj, setMaj] = useState(() => Date.now())
  const [chargement, setChargement] = useState(false)

  const charger = useCallback(async () => {
    setChargement(true)
    try {
      setDonnees(await getStatistiquesDetaillees(jours, region || undefined, zone || undefined))
      setErreur('')
      setMaj(Date.now())
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Serveur injoignable : vérifiez que le backend est lancé.')
    } finally {
      setChargement(false)
    }
  }, [jours, region, zone])

  useEffect(() => {
    void charger()
    const id = setInterval(() => void charger(), 60_000)
    return () => clearInterval(id)
  }, [charger])

  const ind = donnees?.indicateurs
  const periodeLabel = PERIODES.find((p) => p.jours === jours)?.label ?? `${jours} jours`
  const courbeInc = useMemo(() => regrouper(donnees?.series ?? [], pasInc, 'incidents'), [donnees, pasInc])
  const courbeSig = useMemo(() => regrouper(donnees?.series ?? [], pasSig, 'signalements'), [donnees, pasSig])
  const partsInc = useMemo(() => parts(donnees?.incidents_par_type ?? []), [donnees])
  const partsSig = useMemo(() => parts(donnees?.signalements_par_type ?? []), [donnees])
  const partsZones = useMemo(
    () => (donnees?.zones_par_statut ?? []).map((g) => ({ ...g, couleur: ZONES_COULEUR[g.cle] ?? AUTRE })),
    [donnees],
  )
  const regionsTriees = useMemo(() => (donnees?.par_region ?? []).filter((r) => r.incidents > 0 || !!region), [donnees, region])
  const maxRegion = Math.max(1, ...regionsTriees.map((r) => r.incidents))

  const exporter = () => {
    if (!donnees) return
    const nom = `statistiques-saferoad-${new Date().toISOString().slice(0, 10)}`
    let contenu: string
    let type: string
    if (format === 'json') {
      contenu = JSON.stringify(donnees, null, 2)
      type = 'application/json'
    } else {
      const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
      const lignes = [
        [`Période : ${periodeLabel}`, region ? `Région : ${REGIONS.find((r) => r.slug === region)?.label}` : 'Toutes les régions'],
        [],
        ['Région', 'Incidents', 'Signalements', 'Événements', 'Alertes', 'Zones'],
        ...donnees.par_region.map((r) => [r.libelle, r.incidents, r.signalements, r.evenements, r.alertes, r.zones]),
        [],
        ['Date', 'Incidents', 'Signalements'],
        ...donnees.series.map((j) => [j.date, j.incidents, j.signalements]),
      ]
      contenu = '﻿' + lignes.map((l) => l.map(esc).join(';')).join('\r\n')
      type = 'text/csv;charset=utf-8'
    }
    const url = URL.createObjectURL(new Blob([contenu], { type }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${nom}.${format}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const selectCls =
    'w-full cursor-pointer rounded-[9px] border-[1.5px] border-line-field bg-white px-2.5 py-2 text-[12.5px] font-medium text-ink outline-none focus:border-brand-600'
  const headBtn =
    'inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-line bg-white px-4 py-3 text-[12.5px] font-bold text-ink shadow-card transition-colors hover:bg-page'

  const kpis = [
    { cle: 'incidents', icon: 'warning', tint: '#dc3a2f', soft: '#fdeeec', label: 'Incidents', valeur: ind?.incidents, sub: 'Sur la période sélectionnée' },
    { cle: 'signalements', icon: 'groups', tint: '#2b6cb0', soft: '#e8f0f9', label: 'Signalements', valeur: ind?.signalements, sub: 'Sur la période sélectionnée' },
    { cle: 'evenements', icon: 'wifi', tint: '#1f9d55', soft: '#e9f6ee', label: 'Événements', valeur: ind?.evenements, sub: 'Incidents, signalements et alertes' },
    { cle: 'alertes', icon: 'notifications', tint: '#e8940c', soft: '#fdf4e6', label: 'Alertes', valeur: ind?.alertes, sub: 'Sur la période sélectionnée' },
    { cle: 'zones', icon: 'location_on', tint: '#7c3aed', soft: '#f1eafe', label: 'Zones à risque', valeur: ind?.zones, sub: 'Zones identifiées et suivies' },
  ]

  const voir = (t: Exclude<TypeDonnees, 'tous'>) => typeDonnees === 'tous' || typeDonnees === t

  return (
    <div className="pb-8">
      <section className="mx-6 mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-navy-900 text-white">
            <span className="ic text-[26px]">bar_chart</span>
          </span>
          <div className="min-w-0">
            <h1 className="text-[clamp(24px,2.8vw,32px)] font-extrabold leading-[1.1] tracking-[-0.026em] text-navy-900">Statistiques</h1>
            <p className="mt-1 text-[13.5px] leading-relaxed text-info-600">
              Analyse des données SafeRoad et évolution des principaux indicateurs de sécurité routière.
            </p>
          </div>
        </div>
        <div className="ml-auto flex flex-col items-end gap-1.5">
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <label className={`${headBtn} cursor-pointer`}>
              <span className="ic text-xl text-navy-900">calendar_month</span>
              <select value={jours} onChange={(e) => setJours(Number(e.target.value))} aria-label="Période" className="cursor-pointer bg-transparent outline-none">
                {PERIODES.map((p) => (
                  <option key={p.jours} value={p.jours}>
                    Période : {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={`${headBtn} cursor-pointer`}>
              <span className="ic text-xl text-navy-900">place</span>
              <select
                value={region}
                onChange={(e) => {
                  setRegion(e.target.value)
                  setZone('')
                }}
                aria-label="Région"
                className="cursor-pointer bg-transparent outline-none"
              >
                <option value="">Toutes les régions</option>
                {REGIONS.map((r) => (
                  <option key={r.slug} value={r.slug}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => void charger()} className={headBtn}>
              <span className={`ic text-xl text-info-600 ${chargement ? 'animate-spin' : ''}`}>refresh</span>
              Actualiser
            </button>
            <button type="button" onClick={exporter} disabled={!donnees} className={`${headBtn} disabled:opacity-50`}>
              <span className="ic text-xl text-info-600">download</span>
              Exporter
            </button>
          </div>
          <p className="m-0 text-[10.5px] font-medium text-faint">Dernière mise à jour : {formatNow(maj)}</p>
          {erreur && <p className="m-0 text-[11px] font-semibold text-danger-600">{erreur}</p>}
        </div>
      </section>

      {/* Filtres */}
      <section className="mx-6 mt-4 grid grid-cols-1 gap-3.5 rounded-xl border border-line bg-white p-4 shadow-card sm:grid-cols-2 xl:grid-cols-4">
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
          <select
            value={region}
            onChange={(e) => {
              setRegion(e.target.value)
              setZone('')
            }}
            className={selectCls}
          >
            <option value="">Toutes les régions</option>
            {REGIONS.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-ink">Localité</span>
          <select value={zone} onChange={(e) => setZone(e.target.value)} className={selectCls}>
            <option value="">Toutes les localités</option>
            {(donnees?.localites ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.nom}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-ink">Type de données</span>
          <select value={typeDonnees} onChange={(e) => setTypeDonnees(e.target.value as TypeDonnees)} className={selectCls}>
            <option value="tous">Tous</option>
            <option value="incidents">Incidents</option>
            <option value="signalements">Signalements</option>
            <option value="zones">Zones</option>
          </select>
        </label>
      </section>

      {/* Indicateurs */}
      <section className="mx-6 mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.cle} className="flex min-w-0 items-center gap-3.5 rounded-xl border border-line bg-white p-4 shadow-card">
            <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full" style={{ background: k.soft, color: k.tint }}>
              <span className="ic text-[26px]">{k.icon}</span>
            </span>
            <div className="min-w-0">
              <p className="m-0 text-[13px] font-bold text-ink">{k.label}</p>
              <p className="m-0 mt-0.5 text-[26px] font-extrabold leading-none tracking-tight text-navy-900">{k.valeur === undefined ? '…' : fmt(k.valeur)}</p>
              <p className="m-0 mt-1.5 text-[11px] font-medium text-info-600">{k.sub}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Évolutions et types d'incidents */}
      <div className="mx-6 mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_0.9fr]">
        {voir('incidents') && (
          <Carte titre="Évolution des incidents" droite={<SelecteurPas pas={pasInc} onChange={setPasInc} />}>
            <Courbe points={courbeInc} couleur={SERIE_INCIDENTS} unite="incidents" />
          </Carte>
        )}
        {voir('signalements') && (
          <Carte titre="Évolution des signalements" droite={<SelecteurPas pas={pasSig} onChange={setPasSig} />}>
            <Courbe points={courbeSig} couleur={SERIE_SIGNALEMENTS} unite="signalements" />
          </Carte>
        )}
        {voir('incidents') && (
          <Carte titre="Incidents par type">
            <Anneau segments={partsInc} total={ind?.incidents ?? 0} unite="incidents" />
          </Carte>
        )}
      </div>

      {/* Régions, signalements, zones */}
      <div className="mx-6 mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <Carte titre="Répartition des incidents par région">
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {regionsTriees.length === 0 && <li className="text-[12px] text-faint">Aucun incident sur la période.</li>}
            {regionsTriees.slice(0, 8).map((r) => (
              <li key={r.region} className="grid grid-cols-[92px_1fr_44px] items-center gap-2 text-[12px]" title={`${r.libelle} : ${fmt(r.incidents)} incidents`}>
                <span className="truncate font-medium text-body">{r.libelle}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-page">
                  <span className="block h-full rounded-full" style={{ width: `${(r.incidents / maxRegion) * 100}%`, background: SERIE_INCIDENTS }} />
                </span>
                <span className="text-right font-bold text-ink">{fmt(r.incidents)}</span>
              </li>
            ))}
          </ul>
        </Carte>
        {voir('signalements') && (
          <Carte titre="Signalements par type">
            <Anneau segments={partsSig} total={ind?.signalements ?? 0} unite="signalements" />
          </Carte>
        )}
        {voir('zones') && (
          <Carte titre="Analyse des zones">
            <Anneau segments={partsZones} total={ind?.zones ?? 0} unite="zones" />
          </Carte>
        )}
        {voir('zones') && (
          <Carte titre="Zones avec le plus d'activité">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[12px]">
                <thead>
                  <tr className="border-b border-line-soft text-[10.5px] font-bold uppercase tracking-wide text-faint">
                    <th className="py-2 pr-2">Zone</th>
                    <th className="py-2 pr-2">Région</th>
                    <th className="py-2 pr-2 text-right">Incidents</th>
                    <th className="py-2 text-right">Signal.</th>
                  </tr>
                </thead>
                <tbody>
                  {(donnees?.zones_actives ?? []).length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-3 text-center text-faint">
                        Aucune zone identifiée.
                      </td>
                    </tr>
                  )}
                  {(donnees?.zones_actives ?? []).slice(0, 6).map((z) => (
                    <tr key={z.id} className="border-b border-line-soft last:border-0">
                      <td className="max-w-[110px] truncate py-2 pr-2 font-semibold text-ink">{z.nom}</td>
                      <td className="py-2 pr-2 text-body">{z.region_libelle ?? '—'}</td>
                      <td className="py-2 pr-2 text-right font-bold text-ink">{fmt(z.incidents)}</td>
                      <td className="py-2 text-right text-body">{fmt(z.signalements)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Carte>
        )}
      </div>

      {/* Carte, synthèse, export */}
      <div className="mx-6 mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_1fr_0.55fr]">
        <Carte titre="Répartition géographique des données">
          <div className="relative h-[300px] overflow-hidden rounded-lg">
            <MapContainer center={[14.45, -14.6]} zoom={6} className="h-full w-full" scrollWheelZoom={false}>
              <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {voir('incidents') &&
                (donnees?.carte.incidents ?? []).map((p, i) => (
                  <CircleMarker key={`i${i}`} center={[p.latitude, p.longitude]} radius={5} pathOptions={{ color: '#fff', weight: 1.5, fillColor: GRAVITE_COULEUR[p.niveau_gravite], fillOpacity: 0.9 }} />
                ))}
              {voir('signalements') &&
                (donnees?.carte.signalements ?? []).map((p, i) => (
                  <CircleMarker key={`s${i}`} center={[p.latitude, p.longitude]} radius={5} pathOptions={{ color: '#fff', weight: 1.5, fillColor: SERIE_SIGNALEMENTS, fillOpacity: 0.9 }} />
                ))}
              {voir('zones') &&
                (donnees?.carte.zones ?? []).map((z) => (
                  <CircleMarker key={`z${z.id}`} center={[z.latitude_centre, z.longitude_centre]} radius={9} pathOptions={{ color: '#073B4C', weight: 2, fillColor: GRAVITE_COULEUR[z.niveau_danger], fillOpacity: 0.55 }}>
                    <Popup>{z.nom || `Zone #${z.id}`}</Popup>
                  </CircleMarker>
                ))}
            </MapContainer>
            <div className="pointer-events-none absolute right-2 top-2 z-[1000] rounded-lg border border-line bg-white/95 px-2.5 py-2 text-[10.5px] font-semibold text-body shadow-card">
              <p className="m-0 mb-1 font-extrabold text-ink">Légende</p>
              {[
                ['Critique', '#dc3a2f'],
                ['Moyen / vigilance', '#e8940c'],
                ['Faible / normal', '#1f9d55'],
                ['Signalement', SERIE_SIGNALEMENTS],
              ].map(([l, c]) => (
                <span key={l} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: c }} />
                  {l}
                </span>
              ))}
              <span className="mt-0.5 flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border-2 border-navy-900" />
                Zone
              </span>
            </div>
          </div>
        </Carte>

        <Carte titre="Synthèse par région">
          <div className="max-h-[300px] overflow-auto">
            <table className="w-full border-collapse text-left text-[12px]">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-line-soft text-[10.5px] font-bold uppercase tracking-wide text-faint">
                  <th className="py-2 pr-2">Région</th>
                  <th className="py-2 pr-2 text-right">Incid.</th>
                  <th className="py-2 pr-2 text-right">Signal.</th>
                  <th className="py-2 pr-2 text-right">Évén.</th>
                  <th className="py-2 pr-2 text-right">Alertes</th>
                  <th className="py-2 text-right">Zones</th>
                </tr>
              </thead>
              <tbody>
                {(donnees?.par_region ?? []).map((r) => (
                  <tr key={r.region} className="border-b border-line-soft last:border-0">
                    <td className="py-2 pr-2 font-semibold text-ink">{r.libelle}</td>
                    <td className="py-2 pr-2 text-right text-body">{fmt(r.incidents)}</td>
                    <td className="py-2 pr-2 text-right text-body">{fmt(r.signalements)}</td>
                    <td className="py-2 pr-2 text-right text-body">{fmt(r.evenements)}</td>
                    <td className="py-2 pr-2 text-right text-body">{fmt(r.alertes)}</td>
                    <td className="py-2 text-right text-body">{fmt(r.zones)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Carte>

        <Carte titre="Export des statistiques">
          <p className="m-0 text-[12px] leading-relaxed text-info-600">Téléchargez les données correspondant à vos filtres.</p>
          <label className="mt-4 block">
            <span className="mb-1 block text-[11px] font-bold text-ink">Format</span>
            <select value={format} onChange={(e) => setFormat(e.target.value as 'csv' | 'json')} className={selectCls}>
              <option value="csv">CSV (Excel)</option>
              <option value="json">JSON</option>
            </select>
          </label>
          <button
            type="button"
            onClick={exporter}
            disabled={!donnees}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-navy-900 py-2.5 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            <span className="ic text-lg">download</span>
            Exporter
          </button>
          <p className="m-0 mt-3 text-[11px] text-faint">Période : {periodeLabel}</p>
        </Carte>
      </div>
    </div>
  )
}
