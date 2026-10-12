import { useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { DecisionZone } from '@/components/zones/DecisionZone'
import { useAuth } from '@/context/AuthContext'
import { useEnDirect } from '@/hooks/useEnDirect'
import { getZones, type StatutZone, type ZoneApi } from '@/lib/api'
import { formatCoords, regionCenter, regionLabel } from '@/lib/regions'
import { STATUT_ZONE_META, STATUTS_A_VALIDER } from '@/lib/zones'

type RiskLevel = ZoneApi['niveau_danger']

const LEVEL_META: Record<RiskLevel, { label: string; color: string; soft: string; text: string }> = {
  critique: { label: 'Critique', color: '#dc3a2f', soft: '#fdeeec', text: '#dc3a2f' },
  vigilance: { label: 'Vigilance', color: '#e8940c', soft: '#fdf4e6', text: '#e8940c' },
  normale: { label: 'Normal', color: '#1f9d55', soft: '#e9f6ee', text: '#1f9d55' },
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

const NATIONAL_CENTER: [number, number] = [14.45, -14.6]

type Filtre = 'toutes' | RiskLevel
type FiltreStatut = 'tous' | 'a_valider' | Exclude<StatutZone, 'proposee' | 'en_verification' | 'validee_technique'>

const FILTRES_STATUT: { key: FiltreStatut; label: string }[] = [
  { key: 'tous', label: 'Tous les statuts' },
  { key: 'a_valider', label: 'À valider (technique)' },
  { key: 'soumise_anaser', label: "Soumises à l'ANASER" },
  { key: 'reconnue', label: "Reconnues par l'ANASER" },
  { key: 'rejetee', label: 'Rejetées' },
  { key: 'archivee', label: 'Archivées' },
]

const nomZone = (z: ZoneApi) => z.nom || `Zone #${z.id}`

const dateHeure = (iso: string) => {
  const t = new Date(iso)
  const p2 = (n: number) => String(n).padStart(2, '0')
  return `${p2(t.getDate())}/${p2(t.getMonth() + 1)}/${t.getFullYear()} ${p2(t.getHours())}:${p2(t.getMinutes())}`
}

const correspond = (z: ZoneApi, f: FiltreStatut) =>
  f === 'tous' || (f === 'a_valider' ? STATUTS_A_VALIDER.includes(z.statut_validation) : z.statut_validation === f)

/**
 * Zones à risque détectées par le système (regroupement des incidents des boîtiers, renforcé
 * par les signalements) et leur circuit de validation. Admin régional : sa région (filtrée par
 * le backend), validation technique. `national` : vue de tout le pays, utilisée par l'ANASER,
 * qui seule reconnaît officiellement une zone.
 */
export function ZonesPage({ national = false }: { national?: boolean }) {
  const { user } = useAuth()
  const region = national ? 'Sénégal' : regionLabel(user?.region)
  const center = useMemo(() => (national ? NATIONAL_CENTER : regionCenter(user?.region)), [national, user?.region])

  const { donnees, erreur, recharger } = useEnDirect(getZones, 30_000)
  const zones = useMemo(() => donnees ?? [], [donnees])
  const [filtre, setFiltre] = useState<Filtre>('toutes')
  const [filtreStatut, setFiltreStatut] = useState<FiltreStatut>(national ? 'soumise_anaser' : 'tous')
  const [choisie, setChoisie] = useState<number | null>(null)
  const [tuiles, setTuiles] = useState<'plan' | 'satellite'>('plan')

  const counts = useMemo(
    () => ({
      critique: zones.filter((z) => z.niveau_danger === 'critique').length,
      vigilance: zones.filter((z) => z.niveau_danger === 'vigilance').length,
      normale: zones.filter((z) => z.niveau_danger === 'normale').length,
      aValider: zones.filter((z) => STATUTS_A_VALIDER.includes(z.statut_validation)).length,
      soumises: zones.filter((z) => z.statut_validation === 'soumise_anaser').length,
      reconnues: zones.filter((z) => z.statut_validation === 'reconnue').length,
    }),
    [zones],
  )

  const parStatut = useMemo(() => zones.filter((z) => correspond(z, filtreStatut)), [zones, filtreStatut])
  const filtered = useMemo(
    () => (filtre === 'toutes' ? parStatut : parStatut.filter((z) => z.niveau_danger === filtre)),
    [parStatut, filtre],
  )

  // Par défaut : la première zone de la liste filtrée (la plus dangereuse, tri du backend).
  const selected = zones.find((z) => z.id === choisie) ?? filtered[0] ?? null

  const kpiCards: { key: string; icon: string; soft: string; tint: string; value: string; label: string; trend: string }[] = [
    {
      key: 'critiques',
      icon: 'warning',
      soft: LEVEL_META.critique.soft,
      tint: LEVEL_META.critique.text,
      value: String(counts.critique),
      label: 'Zones critiques',
      trend: 'Tous statuts confondus',
    },
    {
      key: 'vigilance',
      icon: 'error',
      soft: LEVEL_META.vigilance.soft,
      tint: LEVEL_META.vigilance.text,
      value: String(counts.vigilance),
      label: 'Zones de vigilance',
      trend: 'Tous statuts confondus',
    },
    {
      key: 'normales',
      icon: 'location_on',
      soft: LEVEL_META.normale.soft,
      tint: LEVEL_META.normale.text,
      value: String(counts.normale),
      label: 'Zones normales',
      trend: 'Tous statuts confondus',
    },
    {
      key: 'attente',
      icon: 'lock_clock',
      soft: '#f1ecfd',
      tint: '#7c3aed',
      value: String(national ? counts.soumises : counts.aValider),
      label: national ? 'Zones à reconnaître' : 'Zones à valider',
      trend: national ? 'Validées techniquement par les admins' : `${counts.soumises} soumise${counts.soumises > 1 ? 's' : ''} à l'ANASER`,
    },
    {
      key: 'reconnues',
      icon: 'verified_user',
      soft: '#e9f6ee',
      tint: '#1a8248',
      value: String(counts.reconnues),
      label: "Reconnues par l'ANASER",
      trend: 'Publiques et alertent les conducteurs',
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
            {national
              ? "Zones détectées dans tout le pays. Les zones validées techniquement par les administrateurs vous sont soumises : seule votre reconnaissance les rend officielles, publiques et déclenche les alertes aux conducteurs."
              : "Zones détectées dans votre région. Vérifiez-les et validez-les techniquement, puis soumettez-les à l'ANASER pour reconnaissance officielle."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-body">
          <span className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-2">
            <span className="ic text-base text-brand-600">place</span>
            {national ? 'Périmètre' : 'Région'} <span className="text-ink">{region}</span>
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
            <MapContainer center={center} zoom={national ? 7 : 11} className="h-full w-full" scrollWheelZoom={false}>
              <TileLayer attribution={TILE_LAYERS[tuiles].attribution} url={TILE_LAYERS[tuiles].url} />
              {filtered.map((zone) => {
                const meta = LEVEL_META[zone.niveau_danger]
                return (
                  <CircleMarker
                    key={zone.id}
                    center={[zone.latitude_centre, zone.longitude_centre]}
                    radius={zone.id === selected?.id ? 12 : 8 + Math.min(zone.nombre_incidents / 3, 8)}
                    pathOptions={{ color: '#fff', weight: 2, fillColor: meta.color, fillOpacity: 0.92 }}
                    eventHandlers={{ click: () => setChoisie(zone.id) }}
                  >
                    <Popup>
                      <div className="w-[190px]">
                        <p className="m-0 text-[13.5px] font-extrabold text-ink">{nomZone(zone)}</p>
                        <p
                          className="m-0 mt-1 inline-block rounded-md px-2 py-1 text-[10.5px] font-bold"
                          style={{ background: meta.soft, color: meta.text }}
                        >
                          Zone {meta.label.toLowerCase()}
                        </p>
                        <p className="m-0 mt-1.5 text-[11.5px] text-body">
                          {zone.nombre_incidents} incidents · {zone.nombre_signalements} signalements
                        </p>
                        <p className="m-0 mt-1 text-[11px] text-faint">{STATUT_ZONE_META[zone.statut_validation].label}</p>
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
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-5 py-4">
            <p className="m-0 text-sm font-extrabold text-ink">Liste des zones — {region}</p>
            <select
              value={filtreStatut}
              onChange={(e) => setFiltreStatut(e.target.value as FiltreStatut)}
              aria-label="Filtrer par statut"
              className="rounded-full border border-line bg-white px-3 py-1.5 text-[11px] font-bold text-body"
            >
              {FILTRES_STATUT.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-1.5 px-5 pt-3.5">
            {(
              [
                { key: 'toutes', label: `Toutes (${parStatut.length})` },
                { key: 'critique', label: 'Critiques' },
                { key: 'vigilance', label: 'Vigilance' },
                { key: 'normale', label: 'Normales' },
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
            {filtered.length === 0 && (
              <li className="px-2.5 py-2 text-[11.5px] text-faint">
                {donnees ? 'Aucune zone pour ces filtres.' : 'Chargement des zones…'}
              </li>
            )}
            {filtered.map((zone) => {
              const meta = LEVEL_META[zone.niveau_danger]
              return (
                <li key={zone.id}>
                  <button
                    type="button"
                    onClick={() => setChoisie(zone.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors ${
                      zone.id === selected?.id ? 'bg-page' : 'hover:bg-page'
                    }`}
                  >
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full" style={{ background: meta.soft, color: meta.text }}>
                      <span className="ic text-base">
                        {zone.niveau_danger === 'critique' ? 'error' : zone.niveau_danger === 'vigilance' ? 'warning' : 'location_on'}
                      </span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate text-[12.5px] font-bold text-ink">{nomZone(zone)}</p>
                      <p className="m-0 mt-0.5 text-[11px] text-faint">
                        {zone.region_libelle ?? 'Région inconnue'} · {zone.nombre_incidents} incidents · {STATUT_ZONE_META[zone.statut_validation].label}
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
                  <th className="px-3 py-3">Région</th>
                  <th className="px-3 py-3">Niveau</th>
                  <th className="px-3 py-3">Incidents</th>
                  <th className="px-3 py-3">Signalements</th>
                  <th className="px-3 py-3">Mise à jour</th>
                  <th className="px-3 py-3">Statut</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((zone) => {
                  const meta = LEVEL_META[zone.niveau_danger]
                  const statutMeta = STATUT_ZONE_META[zone.statut_validation]
                  return (
                    <tr key={zone.id} className="border-b border-line-soft last:border-0 hover:bg-page">
                      <td className="px-5 py-3 font-semibold text-faint">Z-{zone.id}</td>
                      <td className="px-3 py-3 font-bold text-ink">{nomZone(zone)}</td>
                      <td className="px-3 py-3 text-body">{zone.region_libelle ?? '—'}</td>
                      <td className="px-3 py-3">
                        <span className="rounded-md px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: meta.soft, color: meta.text }}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-body">{zone.nombre_incidents}</td>
                      <td className="px-3 py-3 text-body">{zone.nombre_signalements}</td>
                      <td className="px-3 py-3 text-body">{dateHeure(zone.date_maj)}</td>
                      <td className="px-3 py-3">
                        <span
                          className="whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10.5px] font-bold"
                          style={{ background: statutMeta.soft, color: statutMeta.text }}
                        >
                          {statutMeta.label}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => setChoisie(zone.id)}
                          className="ic flex h-7 w-7 items-center justify-center rounded-lg text-base text-faint hover:bg-page hover:text-ink"
                          aria-label={`Voir ${nomZone(zone)}`}
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
                style={{ background: LEVEL_META[selected.niveau_danger].soft, color: LEVEL_META[selected.niveau_danger].text }}
              >
                {LEVEL_META[selected.niveau_danger].label}
              </span>
            </div>

            <p className="m-0 text-sm font-extrabold text-ink">{nomZone(selected)}</p>
            <p className="m-0 mt-1 text-[11.5px] text-faint">
              {formatCoords(selected.latitude_centre, selected.longitude_centre)} · rayon {Math.round(selected.rayon_metres)} m
            </p>
            <p className="m-0 mt-1 text-[11.5px] text-body">
              {selected.nombre_incidents} incidents des boîtiers · {selected.nombre_signalements} signalements · score{' '}
              {selected.score_danger.toFixed(1)}
            </p>
            <p className="m-0 mt-1 text-[11px] text-faint">
              Détectée le {dateHeure(selected.date_creation)} · {selected.region_libelle ?? 'Région inconnue'}
            </p>

            <div className="mt-4 border-t border-line-soft pt-4">
              <DecisionZone
                key={`${selected.id}-${selected.statut_validation}`}
                zone={selected}
                role={user?.role}
                onChange={(z) => {
                  // Garder la zone ouverte même si son nouveau statut sort du filtre.
                  setChoisie(z.id)
                  void recharger()
                }}
              />
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
