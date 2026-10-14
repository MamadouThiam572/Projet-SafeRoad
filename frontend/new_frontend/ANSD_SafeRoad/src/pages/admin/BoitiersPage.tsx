import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  affectation,
  AFFECTATION_META,
  boitierAdminDepuisApi,
  historiqueAdminDepuisApi,
  STATUT_META,
  type Affectation,
  type Boitier,
  type StatutAdmin,
} from '@/data/adminBoitiers'
import {
  affecterBoitier,
  ApiError,
  creerBoitier,
  desaffecterBoitier,
  getBoitiers,
  getConducteurs,
  getHistoriqueBoitier,
  modifierBoitier,
  regenererCleBoitier,
  type BoitierApi,
  type ConducteurApi,
} from '@/lib/api'
import { regionLabel, regionPlatePrefix } from '@/lib/regions'

const PAGE_SIZE = 8

type Tri = 'recent' | 'ancien'

/** Petite courbe de tendance en SVG — même composant que /admin/incidents, /admin/monitoring et /admin/signalements. */
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

function maskApiKey(key: string): string {
  return `${key.slice(0, 11)}${'•'.repeat(20)}${key.slice(-4)}`
}

export function BoitiersPage() {
  const { user } = useAuth()
  const region = regionLabel(user?.region)
  const platePrefix = useMemo(() => regionPlatePrefix(user?.region), [user?.region])
  const formatPlate = (suffix?: string) => (suffix ? `${platePrefix}-${suffix}` : undefined)

  // Boîtiers réels de la région (le backend filtre) et conducteurs qu'on peut leur affecter.
  const [donnees, setDonnees] = useState<{ boitiers: BoitierApi[]; conducteurs: ConducteurApi[] }>({ boitiers: [], conducteurs: [] })
  const [historiques, setHistoriques] = useState<Record<string, Boitier['historique']>>({})
  // Clés API obtenues pendant la visite (création, réinitialisation) : jamais relues ensuite.
  const [cles, setCles] = useState<Record<string, string>>({})
  const [erreur, setErreur] = useState('')
  const [lastRefresh, setLastRefresh] = useState(() => formatNow())
  const boitiers = useMemo(
    () =>
      donnees.boitiers.map((b) => {
        const ligne = boitierAdminDepuisApi(b, platePrefix, cles[b.id] ?? '')
        return { ...ligne, historique: historiques[ligne.id] ?? ligne.historique }
      }),
    [donnees.boitiers, platePrefix, cles, historiques],
  )
  /** Conducteurs proposés : ceux de la région et ceux qui n'ont pas encore de boîtier. */
  const conducteursDispo = donnees.conducteurs

  const recharger = useCallback(async () => {
    try {
      const [bs, cs] = await Promise.all([getBoitiers(), getConducteurs()])
      setDonnees({ boitiers: bs, conducteurs: cs })
      setLastRefresh(formatNow())
      setErreur('')
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Serveur injoignable : vérifiez que le backend est lancé.')
    }
  }, [])

  useEffect(() => {
    void recharger()
  }, [recharger])

  const chargerHistorique = useCallback(async (b: Boitier) => {
    const lignes = await getHistoriqueBoitier(b.uuid).catch(() => [])
    setHistoriques((prev) => ({ ...prev, [b.id]: lignes.map(historiqueAdminDepuisApi).reverse() }))
  }, [])

  /** Appel au backend puis rechargement ; l'erreur éventuelle s'affiche sous l'en-tête. */
  const executer = async (appel: () => Promise<unknown>, b?: Boitier) => {
    try {
      await appel()
      setErreur('')
      await recharger()
      if (b) await chargerHistorique(b)
      return true
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Action non enregistrée : serveur injoignable.')
      return false
    }
  }

  /** Nom saisi -> conducteur réel (correspondance exacte, insensible à la casse). */
  const conducteurParNom = (nom: string) =>
    conducteursDispo.find((c) => `${c.prenom} ${c.nom}`.trim().toLowerCase() === nom.trim().toLowerCase())

  const [search, setSearch] = useState('')
  const [statutFiltre, setStatutFiltre] = useState<'tous' | StatutAdmin>('tous')
  const [affectationFiltre, setAffectationFiltre] = useState<'tous' | Affectation>('tous')
  const [conducteurFiltre, setConducteurFiltre] = useState('tous')
  const [vehiculeFiltre, setVehiculeFiltre] = useState('tous')
  const [tri, setTri] = useState<Tri>('recent')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingStatut, setEditingStatut] = useState(false)
  const [statutDraft, setStatutDraft] = useState<StatutAdmin>('actif')
  const [editingAffectation, setEditingAffectation] = useState(false)
  const [conducteurDraft, setConducteurDraft] = useState('')
  const [vehiculeDraft, setVehiculeDraft] = useState('')
  const [apiKeyRevealed, setApiKeyRevealed] = useState(false)

  const [showAddModal, setShowAddModal] = useState(false)
  const [newId, setNewId] = useState('')
  const [newConducteur, setNewConducteur] = useState('')
  const [newVehicule, setNewVehicule] = useState('')

  const conducteurs = useMemo(
    () => Array.from(new Set(boitiers.filter((b) => b.conducteur).map((b) => b.conducteur as string))).sort(),
    [boitiers],
  )
  const vehicules = useMemo(
    () => Array.from(new Set(boitiers.filter((b) => b.vehicule).map((b) => b.vehicule as string))).sort(),
    [boitiers],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = boitiers.filter((b) => {
      if (
        q &&
        !b.id.toLowerCase().includes(q) &&
        !b.uuid.toLowerCase().includes(q) &&
        !(b.conducteur ?? '').toLowerCase().includes(q) &&
        !(b.vehicule ?? '').toLowerCase().includes(q) &&
        !(formatPlate(b.vehicule) ?? '').toLowerCase().includes(q)
      )
        return false
      if (statutFiltre !== 'tous' && b.statut !== statutFiltre) return false
      if (affectationFiltre !== 'tous' && affectation(b) !== affectationFiltre) return false
      if (conducteurFiltre !== 'tous' && b.conducteur !== conducteurFiltre) return false
      if (vehiculeFiltre !== 'tous' && b.vehicule !== vehiculeFiltre) return false
      return true
    })
    const refTs = (b: Boitier) => b.derniereAffectationTs ?? `${b.dateEnregistrement.split('/').reverse().join('-')}T00:00:00`
    return [...rows].sort((a, c) => (tri === 'recent' ? (refTs(a) < refTs(c) ? 1 : -1) : refTs(a) > refTs(c) ? 1 : -1))
  }, [boitiers, search, statutFiltre, affectationFiltre, conducteurFiltre, vehiculeFiltre, tri, platePrefix])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const kpis = useMemo(() => {
    const total = boitiers.length
    const affectes = boitiers.filter((b) => affectation(b) === 'affecte').length
    const nonAffectes = total - affectes
    const actifs = boitiers.filter((b) => b.statut === 'actif').length
    return [
      { key: 'total', icon: 'memory', tint: '#2b6cb0', soft: '#e8f0f9', value: total, label: 'Total boîtiers', sub: 'Boîtiers enregistrés dans votre région', trend: Array(7).fill(total) },
      { key: 'affectes', icon: 'person_pin_circle', tint: '#1f9d55', soft: '#e9f6ee', value: affectes, label: 'Affectés', sub: 'Boîtiers associés à un conducteur', trend: Array(7).fill(affectes) },
      { key: 'nonAffectes', icon: 'link_off', tint: '#e8940c', soft: '#fdf4e6', value: nonAffectes, label: 'Non affectés', sub: 'Boîtiers disponibles pour affectation', trend: Array(7).fill(nonAffectes) },
      { key: 'actifs', icon: 'check_circle', tint: '#2b6cb0', soft: '#e8f0f9', value: actifs, label: 'Actifs', sub: 'Boîtiers au statut administratif actif', trend: Array(7).fill(actifs) },
    ]
  }, [boitiers])

  const resetFilters = () => {
    setSearch('')
    setStatutFiltre('tous')
    setAffectationFiltre('tous')
    setConducteurFiltre('tous')
    setVehiculeFiltre('tous')
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
  const allOnPageSelected = paginated.length > 0 && paginated.every((b) => selected.has(b.id))
  const toggleSelectAllOnPage = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allOnPageSelected) paginated.forEach((b) => next.delete(b.id))
      else paginated.forEach((b) => next.add(b.id))
      return next
    })
  }

  const openDetail = (id: string) => {
    const b = boitiers.find((x) => x.id === id)
    setSelectedId(id)
    setEditingStatut(false)
    setEditingAffectation(false)
    setApiKeyRevealed(false)
    setStatutDraft(b?.statut ?? 'actif')
    setConducteurDraft(b?.conducteur ?? '')
    setVehiculeDraft(b?.vehicule ?? '')
    if (b) void chargerHistorique(b)
  }

  const handleEnregistrerStatut = async (id: string) => {
    const b = boitiers.find((x) => x.id === id)
    if (!b || b.statut === statutDraft) {
      setEditingStatut(false)
      return
    }
    if (await executer(() => modifierBoitier(b.uuid, { statut: statutDraft }), b)) setEditingStatut(false)
  }

  const handleEnregistrerAffectation = async (id: string) => {
    const b = boitiers.find((x) => x.id === id)
    if (!b) return
    const nom = conducteurDraft.trim()
    const plaque = vehiculeDraft.trim() ? `${platePrefix}-${vehiculeDraft.trim().toUpperCase()}` : ''
    let appel: () => Promise<unknown>
    if (!nom) {
      appel = async () => {
        if (b.conducteurId) await desaffecterBoitier(b.uuid)
        await modifierBoitier(b.uuid, { numero_immatriculation: plaque })
      }
    } else {
      const c = conducteurParNom(nom)
      if (!c) {
        setErreur(`Conducteur « ${nom} » introuvable : choisissez un nom dans la liste proposée.`)
        return
      }
      appel = () => affecterBoitier(b.uuid, c.id, plaque)
    }
    if (await executer(appel, b)) setEditingAffectation(false)
  }

  const handleReinitialiserCle = async (id: string) => {
    const b = boitiers.find((x) => x.id === id)
    if (!b) return
    try {
      const res = await regenererCleBoitier(b.uuid)
      setCles((prev) => ({ ...prev, [b.uuid]: res.api_key }))
      setApiKeyRevealed(true)
      setErreur('')
      await chargerHistorique(b)
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Réinitialisation impossible : serveur injoignable.')
    }
  }

  const resetAddForm = () => {
    setNewId('')
    setNewConducteur('')
    setNewVehicule('')
  }

  /** Enregistre un boîtier dans la région de l'admin (le backend impose la région). */
  const handleAjouterBoitier = async () => {
    const nom = newConducteur.trim()
    const c = nom ? conducteurParNom(nom) : undefined
    if (nom && !c) {
      setErreur(`Conducteur « ${nom} » introuvable : choisissez un nom dans la liste proposée.`)
      return
    }
    const plaque = newVehicule.trim() ? `${platePrefix}-${newVehicule.trim().toUpperCase()}` : ''
    const ok = await executer(async () => {
      const cree = await creerBoitier({ region: user?.region ?? '', numero_immatriculation: plaque, adresse_mac: newId.trim() || null })
      setCles((prev) => ({ ...prev, [cree.id]: cree.api_key }))
      if (c) await affecterBoitier(cree.id, c.id)
    })
    if (ok) {
      resetAddForm()
      setShowAddModal(false)
    }
  }

  const selectedBoitier = selectedId ? boitiers.find((b) => b.id === selectedId) ?? null : null

  if (selectedBoitier) {
    const b = selectedBoitier
    const sMeta = STATUT_META[b.statut]
    const aMeta = AFFECTATION_META[affectation(b)]

    return (
      <div className="pb-8">
        <datalist id="conducteurs-region">
          {conducteursDispo.map((c) => (
            <option key={c.id} value={`${c.prenom} ${c.nom}`.trim()} />
          ))}
        </datalist>
        {erreur && <p className="mx-6 mt-3 text-xs font-semibold text-danger-600">{erreur}</p>}
        <section className="mx-6 mt-5">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="flex items-center gap-1.5 text-[12.5px] font-bold text-brand-600"
          >
            <span className="ic text-base">arrow_back</span>
            Retour aux boîtiers
          </button>
        </section>

        <section className="mx-6 mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h1 className="m-0 text-[clamp(20px,2.4vw,24px)] font-extrabold tracking-[-0.026em] text-ink">
              Boîtier {b.id}
            </h1>
            <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${sMeta.className}`}>{sMeta.label.toUpperCase()}</span>
            <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${aMeta.className}`}>{aMeta.label.toUpperCase()}</span>
          </div>
          {!editingStatut && (
            <button
              type="button"
              onClick={() => {
                setStatutDraft(b.statut)
                setEditingStatut(true)
              }}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-brand-600 px-4 py-2.5 text-[12.5px] font-bold text-white hover:bg-brand-700"
            >
              <span className="ic text-base">edit</span>
              Modifier le statut
            </button>
          )}
        </section>

        <section className="mx-6 mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <p className="m-0 mb-3 flex items-center gap-1.5 text-[12.5px] font-extrabold text-ink">
              <span className="ic text-base text-brand-600">memory</span>
              Informations du boîtier
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[12.5px]">
              <div>
                <dt className="font-semibold text-faint">Identifiant</dt>
                <dd className="m-0 mt-0.5 font-bold text-ink">{b.id}</dd>
              </div>
              <div>
                <dt className="font-semibold text-faint">Région</dt>
                <dd className="m-0 mt-0.5 font-semibold text-ink">{region}</dd>
              </div>
              <div>
                <dt className="font-semibold text-faint">UUID</dt>
                <dd className="m-0 mt-0.5 font-mono text-[11.5px] font-semibold text-ink">{b.uuid}</dd>
              </div>
              <div>
                <dt className="font-semibold text-faint">Date d'enregistrement</dt>
                <dd className="m-0 mt-0.5 font-semibold text-ink">{b.dateEnregistrement}</dd>
              </div>
              <div className="col-span-2">
                <dt className="font-semibold text-faint">Clé API</dt>
                <dd className="m-0 mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[11.5px] font-semibold text-ink">
                  {!b.apiKey ? 'Masquée (jamais renvoyée par le serveur : réinitialisez-la pour en obtenir une nouvelle)' : apiKeyRevealed ? b.apiKey : maskApiKey(b.apiKey)}
                  <button
                    type="button"
                    onClick={() => setApiKeyRevealed((v) => !v)}
                    className="ic text-base text-faint hover:text-ink"
                    aria-label={apiKeyRevealed ? 'Masquer la clé' : 'Afficher la clé'}
                  >
                    {apiKeyRevealed ? 'visibility_off' : 'visibility'}
                  </button>
                </dd>
                <button
                  type="button"
                  onClick={() => void handleReinitialiserCle(b.id)}
                  className="mt-2 flex items-center gap-1 text-[11.5px] font-bold text-danger-600"
                >
                  <span className="ic text-base">autorenew</span>
                  Réinitialiser la clé
                </button>
              </div>
              {editingStatut && (
                <div className="col-span-2 rounded-xl border border-line-soft bg-page p-3">
                  <span className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-faint">Statut administratif</span>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <select
                      value={statutDraft}
                      onChange={(e) => setStatutDraft(e.target.value as StatutAdmin)}
                      className="rounded-[9px] border-[1.5px] border-line bg-white px-2.5 py-2 text-[12.5px] font-semibold text-ink outline-none"
                    >
                      <option value="actif">Actif</option>
                      <option value="inactif">Inactif</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => void handleEnregistrerStatut(b.id)}
                      className="rounded-lg bg-brand-600 px-3 py-1.5 text-[11.5px] font-bold text-white hover:bg-brand-700"
                    >
                      Enregistrer
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingStatut(false)}
                      className="rounded-lg border-[1.5px] border-line px-3 py-1.5 text-[11.5px] font-bold text-ink hover:bg-white"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </dl>
          </div>

          <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <p className="m-0 flex items-center gap-1.5 text-[12.5px] font-extrabold text-ink">
                <span className="ic text-base text-brand-600">person_pin_circle</span>
                Affectation
              </p>
              {!editingAffectation && (
                <button
                  type="button"
                  onClick={() => {
                    setConducteurDraft(b.conducteur ?? '')
                    setVehiculeDraft(b.vehicule ?? '')
                    setEditingAffectation(true)
                  }}
                  className="flex items-center gap-1 text-[11.5px] font-bold text-brand-600"
                >
                  <span className="ic text-base">edit</span>
                  Modifier l'affectation
                </button>
              )}
            </div>
            {!editingAffectation ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[12.5px]">
                <div>
                  <dt className="font-semibold text-faint">Conducteur</dt>
                  <dd className="m-0 mt-0.5 font-bold text-ink">{b.conducteur ?? 'Non affecté'}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-faint">Véhicule</dt>
                  <dd className="m-0 mt-0.5 font-semibold text-ink">{formatPlate(b.vehicule) ?? '—'}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="font-semibold text-faint">Dernière affectation</dt>
                  <dd className="m-0 mt-0.5 font-semibold text-ink">{b.derniereAffectation ?? 'Jamais affecté'}</dd>
                </div>
              </dl>
            ) : (
              <div className="flex flex-col gap-2.5">
                <label className="block">
                  <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-faint">Conducteur</span>
                  <input
                    type="text"
                    value={conducteurDraft}
                    list="conducteurs-region"
                    onChange={(e) => setConducteurDraft(e.target.value)}
                    placeholder="Nom du conducteur (vide = désaffecter)"
                    className="w-full rounded-[9px] border-[1.5px] border-line-field bg-field px-3 py-2 text-[12.5px] font-medium text-ink outline-none placeholder:text-faint"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-faint">Véhicule</span>
                  <div className="flex items-center overflow-hidden rounded-[9px] border-[1.5px] border-line-field bg-field">
                    <span className="flex-none border-r-[1.5px] border-line-field px-3 py-2 text-[12.5px] font-bold text-faint">
                      {platePrefix}-
                    </span>
                    <input
                      type="text"
                      value={vehiculeDraft}
                      onChange={(e) => setVehiculeDraft(e.target.value)}
                      placeholder="Ex : 1234-AA (vide = aucun véhicule)"
                      className="w-full bg-transparent px-3 py-2 text-[12.5px] font-medium text-ink outline-none placeholder:text-faint"
                    />
                  </div>
                </label>
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => void handleEnregistrerAffectation(b.id)}
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-[11.5px] font-bold text-white hover:bg-brand-700"
                  >
                    Enregistrer
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingAffectation(false)}
                    className="rounded-lg border-[1.5px] border-line px-3 py-1.5 text-[11.5px] font-bold text-ink hover:bg-page"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="mx-6 mt-4 rounded-2xl border border-line bg-white p-5 shadow-card">
          <p className="m-0 mb-3 flex items-center gap-1.5 text-[12.5px] font-extrabold text-ink">
            <span className="ic text-base text-brand-600">history</span>
            Historique d'affectation
          </p>
          <ul className="flex flex-col gap-2.5">
            {b.historique.map((h, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[12px]">
                <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-brand-600" />
                <span className="text-faint">{h.date} {h.heure} —</span>
                <span className="text-body">{h.texte}</span>
                <span className="ml-auto flex-none text-[11px] text-faint">{h.administrateur}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    )
  }

  return (
    <div className="pb-8">
      <datalist id="conducteurs-region">
        {conducteursDispo.map((c) => (
          <option key={c.id} value={`${c.prenom} ${c.nom}`.trim()} />
        ))}
      </datalist>
      {erreur && <p className="mx-6 mt-3 text-xs font-semibold text-danger-600">{erreur}</p>}
      <section className="mx-6 mt-5 flex flex-wrap items-start justify-between gap-3.5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-navy-900 text-white">
            <span className="ic text-2xl">memory</span>
          </span>
          <div className="min-w-0">
            <h1 className="text-[clamp(21px,2.6vw,26px)] font-extrabold leading-[1.15] tracking-[-0.026em] text-ink">
              Boîtiers
            </h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-body">
              Gestion et affectation des boîtiers SafeRoad de votre région.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-white px-3.5 py-2.5 text-xs font-bold text-ink">
            <span className="ic text-base text-brand-600">place</span>
            Région : {region}
          </span>
          <button
            type="button"
            onClick={() => void recharger()}
            className="flex items-center gap-2 whitespace-nowrap rounded-full border border-line bg-white px-3.5 py-2.5 text-left text-xs font-bold text-ink transition-colors hover:bg-page"
          >
            <span>
              Actualiser
              <span className="block text-[10.5px] font-semibold text-faint">Dernière mise à jour : {lastRefresh}</span>
            </span>
            <span className="ic text-base text-brand-600">refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-brand-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-700"
          >
            <span className="ic text-base">add</span>
            Ajouter un boîtier
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
              placeholder="Rechercher un boîtier, un conducteur, un véhicule…"
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

        <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-faint">Statut</span>
            <select
              value={statutFiltre}
              onChange={(e) => {
                setStatutFiltre(e.target.value as 'tous' | StatutAdmin)
                setPage(1)
              }}
              className="w-full rounded-[9px] border-[1.5px] border-line bg-white px-2.5 py-2 text-[12.5px] font-semibold text-ink outline-none"
            >
              <option value="tous">Tous</option>
              <option value="actif">Actif</option>
              <option value="inactif">Inactif</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-faint">Affectation</span>
            <select
              value={affectationFiltre}
              onChange={(e) => {
                setAffectationFiltre(e.target.value as 'tous' | Affectation)
                setPage(1)
              }}
              className="w-full rounded-[9px] border-[1.5px] border-line bg-white px-2.5 py-2 text-[12.5px] font-semibold text-ink outline-none"
            >
              <option value="tous">Toutes</option>
              <option value="affecte">Affecté</option>
              <option value="non_affecte">Non affecté</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-faint">Conducteur</span>
            <select
              value={conducteurFiltre}
              onChange={(e) => {
                setConducteurFiltre(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-[9px] border-[1.5px] border-line bg-white px-2.5 py-2 text-[12.5px] font-semibold text-ink outline-none"
            >
              <option value="tous">Tous</option>
              {conducteurs.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-faint">Véhicule</span>
            <select
              value={vehiculeFiltre}
              onChange={(e) => {
                setVehiculeFiltre(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-[9px] border-[1.5px] border-line bg-white px-2.5 py-2 text-[12.5px] font-semibold text-ink outline-none"
            >
              <option value="tous">Tous</option>
              {vehicules.map((v) => (
                <option key={v} value={v}>
                  {formatPlate(v)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="mx-6 mt-4.5 overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line-soft px-5 py-4">
          <p className="m-0 text-sm font-extrabold text-ink">Liste des boîtiers ({filtered.length})</p>
          <select
            value={tri}
            onChange={(e) => setTri(e.target.value as Tri)}
            className="rounded-[9px] border-[1.5px] border-line bg-white px-2.5 py-2 text-[12.5px] font-semibold text-ink outline-none"
          >
            <option value="recent">Trier par : Dernière affectation (plus récent)</option>
            <option value="ancien">Trier par : Dernière affectation (plus ancien)</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left text-[12.5px]">
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
                <th className="px-3 py-3">Boîtier</th>
                <th className="px-3 py-3">UUID</th>
                <th className="px-3 py-3">Conducteur</th>
                <th className="px-3 py-3">Véhicule</th>
                <th className="px-3 py-3">Affectation</th>
                <th className="px-3 py-3">Statut</th>
                <th className="px-3 py-3">Dernière affectation</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((b) => {
                const sMeta = STATUT_META[b.statut]
                const aMeta = AFFECTATION_META[affectation(b)]
                return (
                  <tr key={b.id} className="border-b border-line-soft last:border-0 hover:bg-page">
                    <td className="px-5 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(b.id)}
                        onChange={() => toggleSelected(b.id)}
                        className="h-4 w-4 rounded border-line-field accent-brand-600"
                        aria-label={`Sélectionner ${b.id}`}
                      />
                    </td>
                    <td className="px-3 py-3 font-bold text-ink">{b.id}</td>
                    <td className="px-3 py-3 font-mono text-[11px] text-faint">{b.uuid.slice(0, 13)}…</td>
                    <td className="px-3 py-3 text-body">{b.conducteur ?? '—'}</td>
                    <td className="px-3 py-3 text-body">{formatPlate(b.vehicule) ?? '—'}</td>
                    <td className="px-3 py-3">
                      <span className={`flex w-fit items-center rounded-md px-1.5 py-0.5 text-[10.5px] font-bold ${aMeta.className}`}>
                        {aMeta.label.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`flex w-fit items-center rounded-md px-1.5 py-0.5 text-[10.5px] font-bold ${sMeta.className}`}>
                        {sMeta.label.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-body">{b.derniereAffectation ?? '—'}</td>
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        onClick={() => openDetail(b.id)}
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
                  <td colSpan={9} className="px-5 py-8 text-center text-[12.5px] text-faint">
                    Aucun boîtier ne correspond à ces filtres.
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
              {filtered.length} boîtiers
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

      {showAddModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="m-0 text-[14px] font-extrabold text-ink">Ajouter un boîtier</p>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false)
                  resetAddForm()
                }}
                className="ic text-xl text-faint hover:text-ink"
                aria-label="Fermer"
              >
                close
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <label className="block">
                <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-faint">Adresse MAC du boîtier (optionnel)</span>
                <input
                  type="text"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                  placeholder="Ex : 24:6F:28:AA:BB:CC"
                  className="w-full rounded-[9px] border-[1.5px] border-line-field bg-field px-3 py-2 text-[12.5px] font-medium text-ink outline-none placeholder:text-faint"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-faint">Conducteur (optionnel)</span>
                <input
                  type="text"
                  value={newConducteur}
                  list="conducteurs-region"
                  onChange={(e) => setNewConducteur(e.target.value)}
                  placeholder="Nom du conducteur"
                  className="w-full rounded-[9px] border-[1.5px] border-line-field bg-field px-3 py-2 text-[12.5px] font-medium text-ink outline-none placeholder:text-faint"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-faint">Véhicule (optionnel)</span>
                <div className="flex items-center overflow-hidden rounded-[9px] border-[1.5px] border-line-field bg-field">
                  <span className="flex-none border-r-[1.5px] border-line-field px-3 py-2 text-[12.5px] font-bold text-faint">
                    {platePrefix}-
                  </span>
                  <input
                    type="text"
                    value={newVehicule}
                    onChange={(e) => setNewVehicule(e.target.value)}
                    placeholder="Ex : 1234-AA"
                    className="w-full bg-transparent px-3 py-2 text-[12.5px] font-medium text-ink outline-none placeholder:text-faint"
                  />
                </div>
              </label>
              <p className="m-0 text-[11px] text-faint">
                L'UUID et la clé API sont générés automatiquement (la clé n'est affichée qu'une fois). Le statut administratif est défini à « Actif ».
              </p>
              <div className="mt-1 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    resetAddForm()
                  }}
                  className="rounded-lg border-[1.5px] border-line px-3.5 py-2 text-[12.5px] font-bold text-ink hover:bg-page"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => void handleAjouterBoitier()}
                  className="rounded-lg bg-brand-600 px-3.5 py-2 text-[12.5px] font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Ajouter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
