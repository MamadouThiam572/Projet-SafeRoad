import { useCallback, useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useAuth } from '@/context/AuthContext'
import {
  zoneRisqueDepuisApi,
  type CommentaireZone,
  type PointEvolution,
  type RiskLevel,
  type StatutValidation,
  type ZoneRisqueReelle,
} from '@/data/adminZones'
import { DECISIONS_ZONE, type DecisionZoneSA } from '@/data/superAdminZones'
import { useEnDirect } from '@/hooks/useEnDirect'
import { ApiError, changerStatutZone, getHistoriqueZone, getIncidents, getZones } from '@/lib/api'
import { formatCoords, offsetLatLng, regionCenter, regionLabel } from '@/lib/regions'
import { STATUT_ZONE_META } from '@/lib/zones'

/** Zones visibles du compte (sa région, ou tout le pays) et incidents qui les expliquent. */
const chargerZones = () => Promise.all([getZones(), getIncidents(1000)])
const NATIONAL_CENTER: [number, number] = [14.45, -14.6]
const ROLE_LIBELLE: Record<string, string> = { admin: 'Admin régional', super_admin: 'Super admin', anaser: 'ANASER' }

/** « +2 », « -1 », « 0 » */
const ecart = (n: number) => (n > 0 ? `+${n}` : String(n))

const LEVEL_META: Record<RiskLevel, { label: string; color: string; soft: string; text: string }> = {
  critique: { label: 'Critique', color: '#dc3a2f', soft: '#fdeeec', text: '#dc3a2f' },
  vigilance: { label: 'Vigilance', color: '#e8940c', soft: '#fdf4e6', text: '#e8940c' },
  normale: { label: 'Normal', color: '#1f9d55', soft: '#e9f6ee', text: '#1f9d55' },
}

const STATUT_META: Record<StatutValidation, { label: string; soft: string; text: string }> = {
  en_cours: { label: 'En cours', soft: '#fdf4e6', text: '#e8940c' },
  validee: { label: 'Validée', soft: '#e9f6ee', text: '#1f9d55' },
}

const TILE_LAYERS = {
  plan: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
  },
}

type Filtre = 'toutes' | RiskLevel

/**
 * Petit graphe d'évolution en SVG — une seule série (nombre d'événements /
 * jour), donc une seule teinte (le bleu déjà utilisé pour « incidents » dans
 * StatsBarChart du dashboard), trait fin arrondi + aire à faible opacité.
 * Pas de survol pour rester cohérent avec les autres graphes déjà en place
 * sur cette app (StatsBarChart, IncidentDonut) qui n'en ont pas non plus.
 */
function EvolutionChart({ data }: { data: PointEvolution[] }) {
  const width = 280
  const height = 96
  const padY = 10
  const max = Math.max(...data.map((d) => d.valeur), 1)

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - padY - (d.valeur / max) * (height - padY * 2)
    return { x, y }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Évolution des événements">
      <path d={areaPath} fill="#2b6cb0" opacity={0.1} />
      <path d={linePath} fill="none" stroke="#2b6cb0" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={data[i].date} cx={p.x} cy={p.y} r={2.5} fill="#2b6cb0" />
      ))}
    </svg>
  )
}

/**
 * Zones à risque. Admin régional : sa région (filtrée par le backend), validation technique.
 * `national` : tout le pays (ANASER, qui reconnaît officiellement les zones soumises).
 */
export function ZonesPage({ national = false }: { national?: boolean }) {
  const { user } = useAuth()
  const region = national ? 'Sénégal' : regionLabel(user?.region)
  const center = useMemo(() => (national ? NATIONAL_CENTER : regionCenter(user?.region)), [national, user?.region])

  // Données réelles, rechargées toutes les 30 s.
  const { donnees, erreur, recharger } = useEnDirect(chargerZones, 30_000)
  const zones = useMemo<ZoneRisqueReelle[]>(() => {
    const [zs, incs] = donnees ?? [[], []]
    return zs.map((z) => zoneRisqueDepuisApi(z, incs, center))
  }, [donnees, center])
  const [filtre, setFiltre] = useState<Filtre>('toutes')
  const [selectedId, setSelectedId] = useState<string>('')
  const [tuiles, setTuiles] = useState<'plan' | 'satellite'>('plan')
  const [commentaires, setCommentaires] = useState<Record<string, CommentaireZone[]>>({})
  const [erreurAction, setErreurAction] = useState('')

  /** Décisions permises au rôle connecté depuis le statut réel de la zone. */
  const decisionsOf = (z: ZoneRisqueReelle): DecisionZoneSA[] =>
    DECISIONS_ZONE[z.api.statut_validation].filter((d) => user?.role && (d.roles as string[]).includes(user.role))
  const principale = (z: ZoneRisqueReelle) => decisionsOf(z).find((d) => !d.motif)

  /* Tendances réelles : zones identifiées ces 7 derniers jours vs les 7 précédents, et part des
     zones qui ont encore des incidents cette semaine (taux de récurrence). */
  const ZONES_TENDANCES = useMemo(() => {
    const semaine = (z: ZoneRisqueReelle, debut: number, fin: number) => {
      const age = (Date.now() - Date.parse(z.api.date_creation)) / 86_400_000
      return age >= debut && age < fin
    }
    const t = (niveau: RiskLevel) =>
      ecart(zones.filter((z) => z.niveau === niveau && semaine(z, 0, 7)).length - zones.filter((z) => z.niveau === niveau && semaine(z, 7, 14)).length)
    return { critique: t('critique'), vigilance: t('vigilance'), normale: t('normale') }
  }, [zones])
  // Part des zones où des incidents se répètent (7 derniers jours), comparée aux 7 jours précédents.
  const TAUX_RECURRENCE_7J = useMemo(() => {
    const incs = donnees?.[1] ?? []
    const taux = (debut: number, fin: number) => {
      if (zones.length === 0) return 0
      const actives = zones.filter((z) =>
        incs.some((i) => {
          const age = (Date.now() - Date.parse(i.horodatage)) / 86_400_000
          return i.zone === z.api.id && age >= debut && age < fin
        }),
      ).length
      return Math.round((actives / zones.length) * 100)
    }
    const valeur = taux(0, 7)
    return { valeur, tendance: `${ecart(valeur - taux(7, 14))}%` }
  }, [zones, donnees])

  const chargerCommentaires = useCallback(async (z: ZoneRisqueReelle) => {
    const lignes = await getHistoriqueZone(z.api.id).catch(() => [])
    setCommentaires((prev) => ({
      ...prev,
      [z.id]: lignes
        .slice()
        .reverse()
        .map((h) => ({
          auteur: `${h.acteur_nom ?? 'Compte supprimé'} (${ROLE_LIBELLE[h.role_acteur] ?? h.role_acteur})`,
          date: new Date(h.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }),
          texte: `${h.statut_precedent_libelle} → ${h.statut_nouveau_libelle}${h.commentaire ? ` : ${h.commentaire}` : ''}`,
        })),
    }))
  }, [])

  const counts = useMemo(
    () => ({
      critique: zones.filter((z) => z.niveau === 'critique').length,
      vigilance: zones.filter((z) => z.niveau === 'vigilance').length,
      normale: zones.filter((z) => z.niveau === 'normale').length,
      enAttente: zones.filter((z) => z.statut === 'en_cours').length,
    }),
    [zones],
  )

  const filtered = useMemo(
    () => (filtre === 'toutes' ? zones : zones.filter((z) => z.niveau === filtre)),
    [zones, filtre],
  )

  const selected: ZoneRisqueReelle | undefined = zones.find((z) => z.id === selectedId) ?? zones[0]
  const selectedLatLng = selected ? offsetLatLng(center, selected.offset) : center
  const selectedKey = selected?.id ?? ''
  const selectedStatut = selected?.api.statut_validation ?? ''

  useEffect(() => {
    if (selected) void chargerCommentaires(selected)
    // Rechargé quand la zone ouverte ou son statut changent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, selectedStatut, chargerCommentaires])

  /** Décision enregistrée par le backend (rôle, transition et motif vérifiés). */
  const decider = async (z: ZoneRisqueReelle, d: DecisionZoneSA) => {
    let commentaire = ''
    if (d.motif) {
      commentaire = (window.prompt(`${d.libelle} — motif (obligatoire) :`) ?? '').trim()
      if (!commentaire) return
    }
    try {
      await changerStatutZone(z.api.id, d.vers, commentaire)
      setErreurAction('')
      await recharger()
      await chargerCommentaires(z)
    } catch (err) {
      setErreurAction(err instanceof ApiError ? err.message : 'Décision non enregistrée : serveur injoignable.')
    }
  }

  /** « Valider » : la décision principale du rôle (valider techniquement, soumettre, reconnaître…). */
  const handleValider = (id: string) => {
    const z = zones.find((x) => x.id === id)
    const d = z && principale(z)
    if (z && d) void decider(z, d)
  }

  const kpiCards: { key: string; icon: string; soft: string; tint: string; value: string; label: string; trend: string }[] = [
    {
      key: 'critiques',
      icon: 'warning',
      soft: LEVEL_META.critique.soft,
      tint: LEVEL_META.critique.text,
      value: String(counts.critique),
      label: 'Zones critiques',
      trend: `↑ ${ZONES_TENDANCES.critique} par rapport à la semaine dernière`,
    },
    {
      key: 'vigilance',
      icon: 'error',
      soft: LEVEL_META.vigilance.soft,
      tint: LEVEL_META.vigilance.text,
      value: String(counts.vigilance),
      label: 'Zones de vigilance',
      trend: `↑ ${ZONES_TENDANCES.vigilance} par rapport à la semaine dernière`,
    },
    {
      key: 'normales',
      icon: 'location_on',
      soft: LEVEL_META.normale.soft,
      tint: LEVEL_META.normale.text,
      value: String(counts.normale),
      label: 'Zones normales',
      trend: `↓ ${ZONES_TENDANCES.normale} par rapport à la semaine dernière`,
    },
    {
      key: 'attente',
      icon: 'lock_clock',
      soft: '#f1ecfd',
      tint: '#7c3aed',
      value: String(counts.enAttente),
      label: 'Zones en attente de validation',
      trend: 'Aucun changement',
    },
    {
      key: 'recurrence',
      icon: 'insights',
      soft: '#f1ecfd',
      tint: '#7c3aed',
      value: `${TAUX_RECURRENCE_7J.valeur}%`,
      label: 'Taux de récurrence (7j)',
      trend: `↑ ${TAUX_RECURRENCE_7J.tendance} par rapport à la semaine dernière`,
    },
  ]

  return (
    <div className="pb-8">
      <div className="mx-6 mt-3.5 flex items-center gap-1.5 text-xs font-semibold text-faint">
        <span>Accueil</span>
        <span className="ic text-sm">chevron_right</span>
        <span className="text-ink">Zones à risque</span>
      </div>

      <div className="mx-6 mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[clamp(21px,2.6vw,26px)] font-extrabold leading-[1.15] tracking-[-0.026em] text-ink">
            Zones à risque
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-body">
            Suivez et gérez les zones à risque de votre région. Analysez les tendances et validez les zones
            détectées.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-body">
          <span className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-2">
            <span className="ic text-base text-brand-600">place</span>
            Région <span className="text-ink">{region}</span>
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-2">
            <span className="ic text-base text-brand-600">update</span>
            Zones connues : <span className="text-ink">{zones.length}</span>
          </span>
        </div>
      </div>
      {erreur && <p className="mx-6 mt-2 text-xs font-semibold text-danger-600">{erreur}</p>}

      <section className="mx-6 mt-4.5 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {kpiCards.map((kpi) => (
          <div key={kpi.key} className="min-w-0 rounded-2xl border border-line bg-white p-4.5 shadow-card">
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
            <p className="mt-3.5 text-[11px] font-semibold text-faint">{kpi.trend}</p>
          </div>
        ))}
      </section>

      <section className="mx-6 mt-4.5 grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.7fr_1fr]">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-line bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
            <p className="m-0 text-sm font-extrabold text-ink">Carte des zones à risque — {region}</p>
            <div className="flex gap-1.5 rounded-full bg-page p-1">
              {(['plan', 'satellite'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTuiles(t)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-bold capitalize transition-colors ${
                    tuiles === t ? 'bg-white text-ink shadow-card' : 'text-faint'
                  }`}
                >
                  {t === 'plan' ? 'Plan' : 'Satellite'}
                </button>
              ))}
            </div>
          </div>
          <div className="relative h-[420px] w-full">
            <MapContainer center={center} zoom={12} className="h-full w-full" scrollWheelZoom={false}>
              <TileLayer attribution={TILE_LAYERS[tuiles].attribution} url={TILE_LAYERS[tuiles].url} />
              {zones.map((zone) => {
                const meta = LEVEL_META[zone.niveau]
                return (
                  <CircleMarker
                    key={zone.id}
                    center={offsetLatLng(center, zone.offset)}
                    radius={zone.id === selectedId ? 12 : 8 + Math.min(zone.incidents / 3, 8)}
                    pathOptions={{ color: '#fff', weight: 2, fillColor: meta.color, fillOpacity: 0.92 }}
                    eventHandlers={{ click: () => setSelectedId(zone.id) }}
                  >
                    <Popup>
                      <div className="w-[190px]">
                        <p className="m-0 text-[13.5px] font-extrabold text-ink">{zone.nom}</p>
                        <p
                          className="m-0 mt-1 inline-block rounded-md px-2 py-1 text-[10.5px] font-bold"
                          style={{ background: meta.soft, color: meta.text }}
                        >
                          Zone {meta.label.toLowerCase()}
                        </p>
                        <p className="m-0 mt-1.5 text-[11.5px] text-body">
                          {zone.incidents} incidents · {zone.avgSpeed} km/h (moy.)
                        </p>
                        <p className="m-0 mt-1 text-[11px] text-faint">Dernière détection : {zone.lastDetection}</p>
                      </div>
                    </Popup>
                  </CircleMarker>
                )
              })}
            </MapContainer>

            <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] rounded-[10px] border border-line bg-white/95 px-3 py-2.5 text-[11px] font-semibold text-body shadow-card">
              {(Object.keys(LEVEL_META) as RiskLevel[]).map((level) => (
                <div key={level} className="mt-1 flex items-center gap-1.5 first:mt-0">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: LEVEL_META[level].color }} />
                  Zone {LEVEL_META[level].label.toLowerCase()}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-line bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
            <p className="m-0 text-sm font-extrabold text-ink">Liste des zones à risque — {region}</p>
            {/* Déjà sur cette page : "Voir toutes" réinitialise simplement le filtre de niveau plutôt que de rediriger vers elle-même. */}
            <button type="button" onClick={() => setFiltre('toutes')} className="text-xs font-bold text-brand-600">
              Voir toutes →
            </button>
          </div>
          <div className="flex gap-1.5 px-5 pt-3.5">
            {(
              [
                { key: 'toutes', label: `Toutes (${zones.length})` },
                { key: 'critique', label: `Critiques (${counts.critique})` },
                { key: 'vigilance', label: `Vigilance (${counts.vigilance})` },
                { key: 'normale', label: `Normales (${counts.normale})` },
              ] as { key: Filtre; label: string }[]
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFiltre(tab.key)}
                className={`rounded-full px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                  filtre === tab.key ? 'bg-brand-50 text-brand-700' : 'text-faint hover:text-body'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <ul className="flex max-h-[300px] flex-col gap-1 overflow-y-auto px-3 py-3.5">
            {filtered.map((zone) => {
              const meta = LEVEL_META[zone.niveau]
              return (
                <li key={zone.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(zone.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors ${
                      zone.id === selectedId ? 'bg-page' : 'hover:bg-page'
                    }`}
                  >
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full" style={{ background: meta.soft, color: meta.text }}>
                      <span className="ic text-base">
                        {zone.niveau === 'critique' ? 'error' : zone.niveau === 'vigilance' ? 'warning' : 'location_on'}
                      </span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate text-[12.5px] font-bold text-ink">{zone.nom}</p>
                      <p className="m-0 mt-0.5 text-[11px] text-faint">
                        {zone.localite} · {zone.incidents} incidents · Dernière détection : {zone.lastDetection}
                      </p>
                    </div>
                    <span className="flex-none rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ background: meta.soft, color: meta.text }}>
                      {meta.label}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      <section className="mx-6 mt-4.5 grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.7fr_1fr]">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-line bg-white shadow-card">
          <div className="border-b border-line-soft px-5 py-4">
            <p className="m-0 text-sm font-extrabold text-ink">Détail des zones à risque</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-line-soft text-[10.5px] font-bold uppercase tracking-wide text-faint">
                  <th className="px-5 py-3">ID</th>
                  <th className="px-3 py-3">Nom de la zone</th>
                  <th className="px-3 py-3">Localité</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Niveau</th>
                  <th className="px-3 py-3">Incidents (7j)</th>
                  <th className="px-3 py-3">Dernière détection</th>
                  <th className="px-3 py-3">Statut</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((zone) => {
                  const meta = LEVEL_META[zone.niveau]
                  const statutMeta = STATUT_META[zone.statut]
                  return (
                    <tr key={zone.id} className="border-b border-line-soft last:border-0 hover:bg-page">
                      <td className="px-5 py-3 font-semibold text-faint">{zone.id}</td>
                      <td className="px-3 py-3 font-bold text-ink">{zone.nom}</td>
                      <td className="px-3 py-3 text-body">{zone.localite}</td>
                      <td className="px-3 py-3 text-body">{zone.type}</td>
                      <td className="px-3 py-3">
                        <span className="rounded-md px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: meta.soft, color: meta.text }}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-body">{zone.incidents}</td>
                      <td className="px-3 py-3 text-body">{zone.lastDetection}</td>
                      <td className="px-3 py-3">
                        {principale(zone) ? (
                          <button
                            type="button"
                            onClick={() => handleValider(zone.id)}
                            title={principale(zone)?.libelle}
                            className="rounded-full bg-brand-600 px-3 py-1.5 text-[10.5px] font-bold text-white hover:bg-brand-700"
                          >
                            Valider
                          </button>
                        ) : (
                          <span
                            className="rounded-md px-1.5 py-0.5 text-[10.5px] font-bold"
                            style={{ background: statutMeta.soft, color: statutMeta.text }}
                          >
                            {STATUT_ZONE_META[zone.api.statut_validation].label}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedId(zone.id)}
                          className="ic flex h-7 w-7 items-center justify-center rounded-lg text-base text-faint hover:bg-page hover:text-ink"
                          aria-label={`Voir ${zone.nom}`}
                        >
                          visibility
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {selected && (
          <div className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-card">
            <div className="mb-3.5 flex items-center justify-between">
              <p className="m-0 text-sm font-extrabold text-ink">Zone à risque — Détail</p>
              <span
                className="rounded-md px-1.5 py-0.5 text-[10.5px] font-bold"
                style={{ background: LEVEL_META[selected.niveau].soft, color: LEVEL_META[selected.niveau].text }}
              >
                {LEVEL_META[selected.niveau].label}
              </span>
            </div>

            {/* Pas de flux caméra réel branché sur cette page pour l'instant — aperçu
                générique en attendant que le backend expose les clichés des boîtiers. */}
            <div className="flex h-[110px] items-center justify-center rounded-xl bg-page text-faint">
              <span className="ic text-3xl">photo_camera</span>
            </div>

            <p className="m-0 mt-3.5 text-sm font-extrabold text-ink">{selected.nom}</p>
            <p className="m-0 mt-1 text-[11.5px] text-faint">{formatCoords(selectedLatLng[0], selectedLatLng[1])}</p>
            <p className="m-0 mt-1 text-[11.5px] text-body">
              {selected.incidents} incidents (7 derniers jours) · Dernière détection : {selected.lastDetection}
            </p>

            <p className="m-0 mb-2 mt-4 text-xs font-extrabold text-ink">Évolution des événements</p>
            <EvolutionChart data={selected.evolution} />

            <p className="m-0 mb-2 mt-4 text-xs font-extrabold text-ink">Commentaires récents</p>
            {(commentaires[selected.id] ?? []).length === 0 ? (
              <p className="m-0 text-[11.5px] text-faint">Aucun commentaire pour cette zone.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {(commentaires[selected.id] ?? []).map((c, i) => (
                  <li key={i} className="rounded-xl bg-page p-3 text-[11.5px] text-body">
                    <p className="m-0">{c.texte}</p>
                    <p className="m-0 mt-1 text-[10.5px] font-semibold text-faint">
                      {c.auteur} — {c.date}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={() => handleValider(selected.id)}
              disabled={!principale(selected)}
              className="mt-4.5 flex w-full items-center justify-center gap-2 rounded-[11px] bg-brand-600 py-2.5 text-[12.5px] font-bold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="ic text-base">verified</span>
              {principale(selected)?.libelle ?? STATUT_ZONE_META[selected.api.statut_validation].label}
            </button>
            {decisionsOf(selected)
              .filter((d) => d.motif)
              .map((d) => (
                <button
                  key={d.vers}
                  type="button"
                  onClick={() => void decider(selected, d)}
                  className={`mt-2 w-full text-center text-[11.5px] font-bold ${d.danger ? 'text-danger-600' : 'text-brand-600'}`}
                >
                  {d.libelle}
                </button>
              ))}
            {erreurAction && <p className="m-0 mt-2 text-[11px] font-semibold text-danger-600">{erreurAction}</p>}
          </div>
        )}
      </section>
    </div>
  )
}
