import { useMemo, useState } from 'react'
import { CircleMarker, MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useAuth } from '@/context/AuthContext'
import {
  CORRESPONDANCE_LABEL,
  DANGER_META,
  KPI_TRENDS,
  SIGNALEMENTS,
  STATUT_META,
  type Correspondance,
  type DangerType,
  type Signalement,
  type StatutSignalement,
} from '@/data/adminSignalements'
import { offsetLatLng, regionCenter, regionLabel } from '@/lib/regions'

const PAGE_SIZE = 8

type Tri = 'recent' | 'ancien'

/** Petite courbe de tendance en SVG — même composant que /admin/incidents et /admin/monitoring. */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const width = 64
  const height = 24
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const span = Math.max(max - min, 1)

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / span) * height
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-hidden="true">
      <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function formatNow(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function nowParts(): { date: string; heure: string } {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return { date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`, heure: `${pad(d.getHours())}:${pad(d.getMinutes())}` }
}

/** "2026-10-03" -> "03 octobre 2026" (pour l'en-tête du détail, comme sur la maquette). */
function formatDateLong(dateFr: string): string {
  const [day, month, year] = dateFr.split('/').map(Number)
  const d = new Date(year, month - 1, day)
  const label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  return label
}

export function SignalementsPage() {
  const { user } = useAuth()
  const region = regionLabel(user?.region)
  const center = useMemo(() => regionCenter(user?.region), [user?.region])

  const [signalements, setSignalements] = useState<Signalement[]>(SIGNALEMENTS)
  const [lastRefresh, setLastRefresh] = useState(() => formatNow())

  const [search, setSearch] = useState('')
  const [type, setType] = useState<'tous' | DangerType>('tous')
  const [localite, setLocalite] = useState('tous')
  const [statut, setStatut] = useState<'tous' | StatutSignalement>('tous')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [tri, setTri] = useState<Tri>('recent')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [observationDraft, setObservationDraft] = useState('')

  const localites = useMemo(() => Array.from(new Set(signalements.map((s) => s.localite))).sort(), [signalements])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = signalements.filter((s) => {
      if (q && !s.id.toLowerCase().includes(q) && !s.conducteur.toLowerCase().includes(q)) return false
      if (type !== 'tous' && s.type !== type) return false
      if (localite !== 'tous' && s.localite !== localite) return false
      if (statut !== 'tous' && s.statut !== statut) return false
      if (dateDebut && s.ts.slice(0, 10) < dateDebut) return false
      if (dateFin && s.ts.slice(0, 10) > dateFin) return false
      return true
    })
    return [...rows].sort((a, b) => (tri === 'recent' ? (a.ts < b.ts ? 1 : -1) : a.ts > b.ts ? 1 : -1))
  }, [signalements, search, type, localite, statut, dateDebut, dateFin, tri])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const kpis = useMemo(() => {
    const total = signalements.length
    const enAttente = signalements.filter((s) => s.statut === 'en_attente').length
    const enVerification = signalements.filter((s) => s.statut === 'en_verification').length
    const traites = signalements.filter((s) => s.statut === 'valide' || s.statut === 'rejete').length
    return [
      { key: 'total', icon: 'campaign', tint: '#2b6cb0', soft: '#e8f0f9', value: total, label: 'Total signalements', sub: 'Tous les signalements reçus', trend: KPI_TRENDS.total },
      { key: 'attente', icon: 'schedule', tint: '#e8940c', soft: '#fdf4e6', value: enAttente, label: 'En attente', sub: 'Signalements nécessitant une vérification', trend: KPI_TRENDS.enAttente },
      { key: 'verif', icon: 'search', tint: '#2b6cb0', soft: '#e8f0f9', value: enVerification, label: 'En vérification', sub: 'Signalements actuellement examinés', trend: KPI_TRENDS.enVerification },
      { key: 'traites', icon: 'check_circle', tint: '#1f9d55', soft: '#e9f6ee', value: traites, label: 'Traités', sub: 'Signalements validés ou rejetés', trend: KPI_TRENDS.traites },
    ]
  }, [signalements])

  const resetFilters = () => {
    setSearch('')
    setType('tous')
    setLocalite('tous')
    setStatut('tous')
    setDateDebut('')
    setDateFin('')
    setPage(1)
  }

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const allOnPageSelected = paginated.length > 0 && paginated.every((s) => selected.has(s.id))
  const toggleSelectAllOnPage = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allOnPageSelected) paginated.forEach((s) => next.delete(s.id))
      else paginated.forEach((s) => next.add(s.id))
      return next
    })
  }

  const openDetail = (id: string) => {
    setSelectedId(id)
    setObservationDraft('')
  }

  // TODO backend : chaque action ci-dessous doit devenir un appel API (PATCH /api/v1/signalements/{id}/…)
  // réservé aux rôles admin/super_admin ; pour l'instant tout reste en état local.
  const updateSignalement = (id: string, fn: (s: Signalement) => Signalement) => {
    setSignalements((prev) => prev.map((s) => (s.id === id ? fn(s) : s)))
  }

  const handleCommencerVerification = (id: string) => {
    const { date, heure } = nowParts()
    updateSignalement(id, (s) => ({
      ...s,
      statut: 'en_verification',
      historique: [...s.historique, { date, heure, texte: "Signalement pris en charge par l'administrateur régional" }],
    }))
  }

  const handleCorrespondance = (id: string, value: Correspondance) => {
    updateSignalement(id, (s) => ({ ...s, correspondance: value }))
  }

  const handleAjouterObservation = (id: string) => {
    const texte = observationDraft.trim()
    if (!texte) return
    const { date, heure } = nowParts()
    updateSignalement(id, (s) => ({
      ...s,
      historique: [...s.historique, { date, heure, texte: `Observation de l'administrateur : « ${texte} »` }],
    }))
    setObservationDraft('')
  }

  const handleValider = (id: string) => {
    const { date, heure } = nowParts()
    updateSignalement(id, (s) =>
      s.statut === 'valide'
        ? s
        : { ...s, statut: 'valide', historique: [...s.historique, { date, heure, texte: "Signalement validé par l'administrateur régional" }] },
    )
  }

  const handleRejeter = (id: string) => {
    const { date, heure } = nowParts()
    updateSignalement(id, (s) =>
      s.statut === 'rejete'
        ? s
        : { ...s, statut: 'rejete', historique: [...s.historique, { date, heure, texte: "Signalement rejeté par l'administrateur régional" }] },
    )
  }

  const handleTransmettreAnaser = (id: string) => {
    const { date, heure } = nowParts()
    updateSignalement(id, (s) => ({
      ...s,
      historique: [...s.historique, { date, heure, texte: "Transmis à l'ANASER pour information complémentaire" }],
    }))
  }

  const selectedSignalement = selectedId ? signalements.find((s) => s.id === selectedId) ?? null : null

  if (selectedSignalement) {
    const s = selectedSignalement
    const dMeta = DANGER_META[s.type]
    const sMeta = STATUT_META[s.statut]
    const [lat, lng] = offsetLatLng(center, s.offset)

    return (
      <div className="pb-8">
        <section className="mx-6 mt-5">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="flex items-center gap-1.5 text-[12.5px] font-bold text-brand-600"
          >
            <span className="ic text-base">arrow_back</span>
            Retour aux signalements
          </button>
        </section>

        <section className="mx-6 mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h1 className="m-0 text-[clamp(20px,2.4vw,24px)] font-extrabold tracking-[-0.026em] text-ink">
              Signalement {s.id}
            </h1>
            <span className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold" style={{ background: sMeta.soft, color: sMeta.text }}>
              <span className="ic text-sm">{sMeta.icon}</span>
              {sMeta.label.toUpperCase()}
            </span>
          </div>
          {s.statut === 'en_attente' && (
            <button
              type="button"
              onClick={() => handleCommencerVerification(s.id)}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-brand-600 px-4 py-2.5 text-[12.5px] font-bold text-white hover:bg-brand-700"
            >
              <span className="ic text-base">edit</span>
              Commencer la vérification
            </button>
          )}
        </section>

        <section className="mx-6 mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <p className="m-0 mb-3 flex items-center gap-1.5 text-[12.5px] font-extrabold text-ink">
              <span className="ic text-base text-brand-600">badge</span>
              Informations générales
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[12.5px]">
              <div>
                <dt className="font-semibold text-faint">Référence</dt>
                <dd className="m-0 mt-0.5 font-bold text-ink">{s.id}</dd>
              </div>
              <div>
                <dt className="font-semibold text-faint">Type de danger</dt>
                <dd className="m-0 mt-0.5 flex items-center gap-1 font-semibold text-ink">
                  <span className="ic text-base" style={{ color: dMeta.tint }}>{dMeta.icon}</span>
                  {dMeta.label}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-faint">Date et heure</dt>
                <dd className="m-0 mt-0.5 font-semibold text-ink">{formatDateLong(s.date)} — {s.heure}</dd>
              </div>
              <div>
                <dt className="font-semibold text-faint">Localité</dt>
                <dd className="m-0 mt-0.5 font-semibold text-ink">{s.localite}</dd>
              </div>
              <div>
                <dt className="font-semibold text-faint">Région</dt>
                <dd className="m-0 mt-0.5 font-semibold text-ink">{region}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <p className="m-0 mb-3 flex items-center gap-1.5 text-[12.5px] font-extrabold text-ink">
              <span className="ic text-base text-brand-600">person</span>
              Signalé par
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[12.5px]">
              <div>
                <dt className="font-semibold text-faint">Nom</dt>
                <dd className="m-0 mt-0.5 font-bold text-ink">{s.conducteur}</dd>
              </div>
              <div>
                <dt className="font-semibold text-faint">Véhicule</dt>
                <dd className="m-0 mt-0.5 font-semibold text-ink">{s.vehicule ?? 'Non renseigné'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-faint">Téléphone</dt>
                <dd className="m-0 mt-0.5 font-semibold text-ink">{s.telephone}</dd>
              </div>
              <div>
                <dt className="font-semibold text-faint">Boîtier</dt>
                <dd className="m-0 mt-0.5 font-semibold text-ink">{s.boitier ?? 'Non renseigné'}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="mx-6 mt-4 rounded-2xl border border-line bg-white p-5 shadow-card">
          <p className="m-0 mb-2.5 flex items-center gap-1.5 text-[12.5px] font-extrabold text-ink">
            <span className="ic text-base text-brand-600">chat_bubble</span>
            Description du danger
          </p>
          <p className="m-0 text-[13px] italic leading-relaxed text-body">« {s.description} »</p>
        </section>

        <section className="mx-6 mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <p className="m-0 mb-3 flex items-center gap-1.5 text-[12.5px] font-extrabold text-ink">
              <span className="ic text-base text-brand-600">photo_camera</span>
              Photo du danger
            </p>
            {/* Pas de photo réelle transmise par le conducteur branchée pour l'instant — aperçu
                générique en attendant que le backend expose les pièces jointes des signalements. */}
            <div className="flex h-[150px] items-center justify-center rounded-xl bg-page text-faint">
              <span className="ic text-4xl">image</span>
            </div>
            <button type="button" className="mt-2.5 flex items-center gap-1 text-[11.5px] font-bold text-brand-600">
              <span className="ic text-base">fullscreen</span>
              Voir en plein écran
            </button>
          </div>

          <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <p className="m-0 mb-3 flex items-center gap-1.5 text-[12.5px] font-extrabold text-ink">
              <span className="ic text-base text-brand-600">place</span>
              Localisation du signalement
            </p>
            <div className="h-[150px] w-full overflow-hidden rounded-xl">
              <MapContainer center={[lat, lng]} zoom={14} className="h-full w-full" scrollWheelZoom={false} dragging={false} zoomControl={false}>
                <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <CircleMarker center={[lat, lng]} radius={9} pathOptions={{ color: '#fff', weight: 2, fillColor: '#dc3a2f', fillOpacity: 0.95 }} />
              </MapContainer>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[11.5px]">
              <div>
                <dt className="font-semibold text-faint">Latitude</dt>
                <dd className="m-0 font-semibold text-ink">{lat.toFixed(4)}</dd>
              </div>
              <div>
                <dt className="font-semibold text-faint">Longitude</dt>
                <dd className="m-0 font-semibold text-ink">{lng.toFixed(4)}</dd>
              </div>
              <div>
                <dt className="font-semibold text-faint">Localité</dt>
                <dd className="m-0 font-semibold text-ink">{s.localite}</dd>
              </div>
              <div>
                <dt className="font-semibold text-faint">Route ou axe</dt>
                <dd className="m-0 font-semibold text-ink">{s.lieu}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="mx-6 mt-4 rounded-2xl border border-line bg-white p-5 shadow-card">
          <p className="m-0 mb-3 flex items-center gap-1.5 text-[12.5px] font-extrabold text-ink">
            <span className="ic text-base text-brand-600">sensors</span>
            Données SafeRoad à proximité
          </p>
          <p className="m-0 mb-2 text-[11.5px] font-bold text-faint">Événements détectés à proximité</p>
          {s.evenementsProches.length === 0 ? (
            <p className="m-0 text-[12px] text-faint">Aucun événement SafeRoad détecté à proximité de ce signalement.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {s.evenementsProches.map((ev, i) => (
                <li key={i} className="flex items-center gap-2 text-[12px] text-body">
                  <span className="h-2 w-2 flex-none rounded-full bg-brand-600" />
                  <span className="font-bold text-ink">{ev.type}</span>
                  — {ev.distanceM} m du signalement — {ev.date} {ev.heure}
                </li>
              ))}
            </ul>
          )}
          <p className="m-0 mt-2.5 text-[11.5px] font-semibold text-faint">
            Nombre d'événements similaires : <span className="font-bold text-ink">{s.evenementsSimilaires}</span>
          </p>
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-brand-100 bg-brand-50 px-3.5 py-3 text-[11px] font-semibold leading-snug text-brand-700">
            <span className="ic mt-0.5 flex-none text-base">info</span>
            Correspondance avec les données SafeRoad à proximité — aide à la validation du signalement, la
            décision finale reste manuelle.
          </div>
        </section>

        <section className="mx-6 mt-4 rounded-2xl border border-line bg-white p-5 shadow-card">
          <p className="m-0 mb-3 flex items-center gap-1.5 text-[12.5px] font-extrabold text-ink">
            <span className="ic text-base text-brand-600">verified</span>
            Vérification administrative
          </p>
          <p className="m-0 mb-2 text-[11.5px] font-bold text-faint">Correspondance avec les données SafeRoad</p>
          <div className="flex flex-col gap-2">
            {(Object.keys(CORRESPONDANCE_LABEL) as NonNullable<Correspondance>[]).map((c) => (
              <label key={c} className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
                <input
                  type="radio"
                  name={`correspondance-${s.id}`}
                  checked={s.correspondance === c}
                  onChange={() => handleCorrespondance(s.id, c)}
                  className="h-4 w-4 accent-brand-600"
                />
                {CORRESPONDANCE_LABEL[c]}
              </label>
            ))}
          </div>
          <p className="m-0 mb-1.5 mt-4 text-[11.5px] font-bold text-faint">Observation de l'administrateur</p>
          <textarea
            value={observationDraft}
            onChange={(e) => setObservationDraft(e.target.value)}
            placeholder="Écrire une observation…"
            rows={3}
            className="w-full resize-none rounded-xl border-[1.5px] border-line-field bg-field px-3.5 py-2.5 text-[12.5px] text-ink outline-none placeholder:text-faint"
          />
        </section>

        <section className="mx-6 mt-4 rounded-2xl border border-line bg-white p-5 shadow-card">
          <p className="m-0 mb-3 flex items-center gap-1.5 text-[12.5px] font-extrabold text-ink">
            <span className="ic text-base text-brand-600">history</span>
            Historique
          </p>
          <ul className="flex flex-col gap-2.5">
            {s.historique.map((h, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[12px]">
                <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-brand-600" />
                <span className="text-faint">{h.date} {h.heure} —</span>
                <span className="text-body">{h.texte}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-6 mt-4 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => handleAjouterObservation(s.id)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border-[1.5px] border-line bg-white px-4 py-2.5 text-[12.5px] font-bold text-ink hover:bg-page"
          >
            <span className="ic text-base">add_comment</span>
            Ajouter une observation
          </button>
          <button
            type="button"
            onClick={() => handleValider(s.id)}
            disabled={s.statut === 'valide'}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border-[1.5px] border-success-600 px-4 py-2.5 text-[12.5px] font-bold text-success-600 hover:bg-success-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="ic text-base">check_circle</span>
            Valider le signalement
          </button>
          <button
            type="button"
            onClick={() => handleRejeter(s.id)}
            disabled={s.statut === 'rejete'}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border-[1.5px] border-danger-600 px-4 py-2.5 text-[12.5px] font-bold text-danger-600 hover:bg-danger-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="ic text-base">cancel</span>
            Rejeter le signalement
          </button>
          <button
            type="button"
            onClick={() => handleTransmettreAnaser(s.id)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border-[1.5px] border-brand-600 px-4 py-2.5 text-[12.5px] font-bold text-brand-600 hover:bg-brand-50"
          >
            <span className="ic text-base">forward</span>
            Transmettre à l'ANASER
          </button>
        </section>
      </div>
    )
  }

  return (
    <div className="pb-8">
      <section className="mx-6 mt-5 flex flex-wrap items-start justify-between gap-3.5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-navy-900 text-white">
            <span className="ic text-2xl">campaign</span>
          </span>
          <div className="min-w-0">
            <h1 className="text-[clamp(21px,2.6vw,26px)] font-extrabold leading-[1.15] tracking-[-0.026em] text-ink">
              Signalements
            </h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-body">
              Signalements transmis par les conducteurs de votre région.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-white px-3.5 py-2.5 text-xs font-bold text-ink">
            <span className="ic text-base text-brand-600">place</span>
            Région : {region}
            <span className="ic text-base text-muted">expand_more</span>
          </span>
          <button
            type="button"
            onClick={() => setLastRefresh(formatNow())}
            className="flex items-center gap-2 whitespace-nowrap rounded-full border border-line bg-white px-3.5 py-2.5 text-left text-xs font-bold text-ink transition-colors hover:bg-page"
          >
            <span>
              Actualiser
              <span className="block text-[10.5px] font-semibold text-faint">Dernière mise à jour : {lastRefresh}</span>
            </span>
            <span className="ic text-base text-brand-600">refresh</span>
          </button>
        </div>
      </section>

      <section className="mx-6 mt-4.5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.key} className="min-w-0 rounded-2xl border border-line bg-white p-4.5 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <span
                  className="flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-full"
                  style={{ background: kpi.soft, color: kpi.tint }}
                >
                  <span className="ic text-2xl">{kpi.icon}</span>
                </span>
                <div className="min-w-0">
                  <p className="m-0 text-2xl font-extrabold leading-none tracking-tight text-ink">{kpi.value}</p>
                  <p className="m-0 mt-1.5 text-xs font-semibold text-body">{kpi.label}</p>
                </div>
              </div>
              <Sparkline data={kpi.trend} color={kpi.tint} />
            </div>
            <p className="mt-3 text-[11px] font-semibold text-faint">{kpi.sub}</p>
          </div>
        ))}
      </section>

      <section className="mx-6 mt-4.5 rounded-2xl border border-line bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-[10px] border-[1.5px] border-line-field bg-field px-3.5 py-2.5">
            <span className="ic text-lg text-faint">search</span>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Rechercher un signalement…"
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none placeholder:text-faint"
            />
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-[10px] border-[1.5px] border-line px-3.5 py-2.5 text-[12.5px] font-bold text-body transition-colors hover:bg-page"
          >
            <span className="ic text-base">refresh</span>
            Réinitialiser les filtres
          </button>
        </div>

        <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
          <label className="block">
            <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-faint">Type de danger</span>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as 'tous' | DangerType)
                setPage(1)
              }}
              className="w-full rounded-[9px] border-[1.5px] border-line bg-white px-2.5 py-2 text-[12.5px] font-semibold text-ink outline-none"
            >
              <option value="tous">Tous</option>
              {(Object.keys(DANGER_META) as DangerType[]).map((d) => (
                <option key={d} value={d}>
                  {DANGER_META[d].label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-faint">Localité</span>
            <select
              value={localite}
              onChange={(e) => {
                setLocalite(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-[9px] border-[1.5px] border-line bg-white px-2.5 py-2 text-[12.5px] font-semibold text-ink outline-none"
            >
              <option value="tous">Toutes</option>
              {localites.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-faint">Statut</span>
            <select
              value={statut}
              onChange={(e) => {
                setStatut(e.target.value as 'tous' | StatutSignalement)
                setPage(1)
              }}
              className="w-full rounded-[9px] border-[1.5px] border-line bg-white px-2.5 py-2 text-[12.5px] font-semibold text-ink outline-none"
            >
              <option value="tous">Tous</option>
              {(Object.keys(STATUT_META) as StatutSignalement[]).map((s) => (
                <option key={s} value={s}>
                  {STATUT_META[s].label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-faint">Date début</span>
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => {
                setDateDebut(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-[9px] border-[1.5px] border-line bg-white px-2.5 py-2 text-[12.5px] font-semibold text-ink outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-faint">Date fin</span>
            <input
              type="date"
              value={dateFin}
              onChange={(e) => {
                setDateFin(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-[9px] border-[1.5px] border-line bg-white px-2.5 py-2 text-[12.5px] font-semibold text-ink outline-none"
            />
          </label>
        </div>
      </section>

      <section className="mx-6 mt-4.5 overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line-soft px-5 py-4">
          <p className="m-0 text-sm font-extrabold text-ink">Liste des signalements ({filtered.length})</p>
          <select
            value={tri}
            onChange={(e) => setTri(e.target.value as Tri)}
            className="rounded-[9px] border-[1.5px] border-line bg-white px-2.5 py-2 text-[12.5px] font-semibold text-ink outline-none"
          >
            <option value="recent">Trier par : Date (plus récent)</option>
            <option value="ancien">Trier par : Date (plus ancien)</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-line-soft text-[10.5px] font-bold uppercase tracking-wide text-faint">
                <th className="px-5 py-3">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleSelectAllOnPage}
                    className="h-4 w-4 rounded border-line-field accent-brand-600"
                    aria-label="Tout sélectionner sur cette page"
                  />
                </th>
                <th className="px-3 py-3">Référence</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Localisation</th>
                <th className="px-3 py-3">Conducteur</th>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Statut</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((s) => {
                const dMeta = DANGER_META[s.type]
                const sMeta = STATUT_META[s.statut]
                return (
                  <tr key={s.id} className="border-b border-line-soft last:border-0 hover:bg-page">
                    <td className="px-5 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => toggleSelected(s.id)}
                        className="h-4 w-4 rounded border-line-field accent-brand-600"
                        aria-label={`Sélectionner ${s.id}`}
                      />
                    </td>
                    <td className="px-3 py-3 font-bold text-ink">{s.id}</td>
                    <td className="px-3 py-3 text-body">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="flex h-6 w-6 flex-none items-center justify-center rounded-full"
                          style={{ background: dMeta.soft, color: dMeta.tint }}
                        >
                          <span className="ic text-sm">{dMeta.icon}</span>
                        </span>
                        {dMeta.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-body">{s.localite}</td>
                    <td className="px-3 py-3 text-body">{s.conducteur}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-body">
                      {s.date}
                      <span className="ml-1 text-[11px] text-faint">{s.heure}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: sMeta.soft, color: sMeta.text }}>
                        <span className="ic text-xs">{sMeta.icon}</span>
                        {sMeta.label.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        onClick={() => openDetail(s.id)}
                        className="whitespace-nowrap rounded-lg border-[1.5px] border-line px-3 py-1.5 text-[11px] font-bold text-ink hover:bg-page"
                      >
                        Voir
                      </button>
                    </td>
                  </tr>
                )
              })}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-[12.5px] text-faint">
                    Aucun signalement ne correspond à ces filtres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft px-5 py-3.5 text-[11.5px] font-semibold text-faint">
            <span>
              Affichage de {(currentPage - 1) * PAGE_SIZE + 1} à {Math.min(currentPage * PAGE_SIZE, filtered.length)} sur{' '}
              {filtered.length} signalements
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="ic flex h-7 w-7 items-center justify-center rounded-lg text-base disabled:opacity-30"
              >
                chevron_left
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg font-bold ${
                    n === currentPage ? 'bg-brand-600 text-white' : 'text-body hover:bg-page'
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="ic flex h-7 w-7 items-center justify-center rounded-lg text-base disabled:opacity-30"
              >
                chevron_right
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
