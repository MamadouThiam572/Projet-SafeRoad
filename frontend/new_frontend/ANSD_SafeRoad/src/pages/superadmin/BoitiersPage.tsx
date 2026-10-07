import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react'
import { useAuth } from '@/context/AuthContext'
import { REGION_STATS } from '@/data/superAdminHome'
import {
  INITIAL_BOITIERS,
  INITIAL_CONDUCTEURS,
  formatDay,
  type Boitier,
  type BoitierStatus,
  type Conducteur,
  type HistoryEntry,
} from '@/data/superAdminBoitiers'

/**
 * Super Admin → Boîtiers : gestion ADMINISTRATIVE des boîtiers (enregistrement,
 * informations, affectation conducteur/véhicule, statut administratif).
 *
 * Volontairement absent : connexion, dernière communication, réseau, anomalies…
 * Ces données techniques appartiennent à la page « Monitoring IoT ».
 *
 * Données de démonstration : chaque mutation locale est marquée // TODO backend.
 */

const PAGE_SIZE = 10

type AffectationFilter = 'tous' | 'affecte' | 'non_affecte'

const nf = new Intl.NumberFormat('fr-FR')
const fmt = (n: number) => nf.format(n).replace(/\s/g, ' ')

const regionName = (slug: string) => REGION_STATS.find((r) => r.slug === slug)?.label ?? slug

const todayIso = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function formatNow(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Valeurs aléatoires réelles à l'exécution (les données de démo, elles, sont déterministes). */
function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}
const newUuid = () => crypto.randomUUID()
const newApiKey = () => `srk_${randomHex(16)}`

const maskedKey = '••••••••••••••'

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/* ------------------------------------------------------------------ */
/* Pastilles                                                           */
/* ------------------------------------------------------------------ */

function AffectationBadge({ affecte }: { affecte: boolean }) {
  return affecte ? (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-success-50 px-2.5 py-1 text-[11px] font-bold text-success-600">
      <span className="ic text-[14px]">check_circle</span>
      Affecté
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-warning-50 px-2.5 py-1 text-[11px] font-bold text-warning-600">
      <span className="ic text-[14px]">link_off</span>
      Non affecté
    </span>
  )
}

function StatusBadge({ status }: { status: BoitierStatus }) {
  return status === 'actif' ? (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-success-50 px-2.5 py-1 text-[11px] font-bold text-success-600">
      <span className="ic text-[14px]">check_circle</span>
      Actif
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#eef2f5] px-2.5 py-1 text-[11px] font-bold text-body">
      <span className="ic text-[14px]">pause_circle</span>
      Inactif
    </span>
  )
}

const fieldCls =
  'w-full rounded-[9px] border-[1.5px] border-line-field bg-field px-3 py-2 text-[12.5px] font-medium text-ink outline-none placeholder:text-faint focus:border-brand-600 disabled:cursor-not-allowed disabled:opacity-60'
const labelCls = 'mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-faint'

/* ------------------------------------------------------------------ */
/* Volet de détail                                                     */
/* ------------------------------------------------------------------ */

interface DetailProps {
  boitier: Boitier
  conducteur: Conducteur | null
  onBack: () => void
  onEdit: () => void
  onAssign: () => void
  onUnassign: () => void
  onToggleStatus: () => void
  onResetKey: () => void
  onCopy: (label: string, value: string) => void
}

function DetailSection({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-4">
      <p className="m-0 mb-2.5 flex items-center gap-2 text-[13px] font-extrabold text-ink">
        <span className="ic text-xl text-info-600">{icon}</span>
        {title}
      </p>
      {children}
    </section>
  )
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] items-start gap-3 py-1.5 text-[12px]">
      <dt className="text-info-600">{label}</dt>
      <dd className="m-0 min-w-0 break-words font-semibold text-ink">{children}</dd>
    </div>
  )
}

function DetailPanel({ boitier: b, conducteur, onBack, onEdit, onAssign, onUnassign, onToggleStatus, onResetKey, onCopy }: DetailProps) {
  const [showKey, setShowKey] = useState(false)
  const [allHistory, setAllHistory] = useState(false)
  const history = allHistory ? b.history : b.history.slice(0, 3)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[12px] font-bold text-info-600 hover:underline">
          <span className="ic text-lg">arrow_back</span>
          Retour
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 rounded-lg border-[1.5px] border-line bg-white px-3 py-1.5 text-[12px] font-bold text-ink hover:bg-page"
        >
          <span className="ic text-lg text-info-600">edit</span>
          Modifier
        </button>
      </div>

      <div className="flex items-center gap-2.5">
        <span className="ic text-[30px] text-navy-900">deployed_code</span>
        <p className="m-0 text-[18px] font-extrabold text-navy-900">{b.id}</p>
        <StatusBadge status={b.status} />
      </div>

      <DetailSection icon="assignment" title="Informations du boîtier">
        <dl className="m-0">
          <DetailRow label="Identifiant">{b.id}</DetailRow>
          <DetailRow label="UUID">
            <span className="flex items-start gap-1.5">
              <span className="break-all font-mono text-[11px]">{b.uuid}</span>
              <button
                type="button"
                onClick={() => onCopy('UUID', b.uuid)}
                className="ic flex-none text-base text-faint hover:text-ink"
                aria-label="Copier l'UUID"
              >
                content_copy
              </button>
            </span>
          </DetailRow>
          <DetailRow label="Statut administratif">{b.status === 'actif' ? 'Actif' : 'Inactif'}</DetailRow>
          <DetailRow label="Date d'enregistrement">{formatDay(b.registeredAt)}</DetailRow>
          <DetailRow label="Région">{regionName(b.region)}</DetailRow>
        </dl>
      </DetailSection>

      <DetailSection icon="person" title="Affectation">
        {conducteur ? (
          <>
            <dl className="m-0">
              <DetailRow label="Conducteur">{conducteur.name}</DetailRow>
              <DetailRow label="Véhicule">{conducteur.plate}</DetailRow>
              <DetailRow label="Région">{regionName(conducteur.region)}</DetailRow>
              <DetailRow label="Date d'affectation">{b.assignedAt ? formatDay(b.assignedAt) : '—'}</DetailRow>
            </dl>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onAssign}
                className="inline-flex items-center gap-1.5 rounded-lg border-[1.5px] border-info-600 px-3 py-1.5 text-[12px] font-bold text-info-600 hover:bg-info-50"
              >
                <span className="ic text-lg">swap_horiz</span>
                Modifier l'affectation
              </button>
              <button
                type="button"
                onClick={onUnassign}
                className="inline-flex items-center gap-1.5 rounded-lg border-[1.5px] border-line px-3 py-1.5 text-[12px] font-bold text-danger-600 hover:bg-danger-50"
              >
                <span className="ic text-lg">link_off</span>
                Retirer
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="m-0 text-[12px] text-body">Ce boîtier n'est affecté à aucun conducteur.</p>
            <button
              type="button"
              onClick={onAssign}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-brand-700"
            >
              <span className="ic text-lg">add_link</span>
              Affecter à un conducteur
            </button>
          </>
        )}
      </DetailSection>

      <DetailSection icon="shield" title="Sécurité">
        <dl className="m-0">
          <DetailRow label="Clé API">
            <span className="flex items-center gap-1.5">
              <span className="min-w-0 break-all font-mono text-[11px]">{showKey ? b.apiKey : maskedKey}</span>
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="ic flex-none text-lg text-faint hover:text-ink"
                aria-label={showKey ? 'Masquer la clé API' : 'Afficher la clé API'}
              >
                {showKey ? 'visibility_off' : 'visibility'}
              </button>
              {showKey && (
                <button
                  type="button"
                  onClick={() => onCopy('Clé API', b.apiKey)}
                  className="ic flex-none text-base text-faint hover:text-ink"
                  aria-label="Copier la clé API"
                >
                  content_copy
                </button>
              )}
            </span>
          </DetailRow>
        </dl>
        <button type="button" onClick={onResetKey} className="mt-1 inline-flex items-center gap-1 text-[12px] font-bold text-info-600 hover:underline">
          <span className="ic text-base">key</span>
          Réinitialiser la clé
        </button>
      </DetailSection>

      <section className="rounded-xl border border-line bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="m-0 flex items-center gap-2 text-[13px] font-extrabold text-ink">
            <span className="ic text-xl text-info-600">history</span>
            Historique d'affectation
          </p>
          {b.history.length > 3 && (
            <button type="button" onClick={() => setAllHistory((v) => !v)} className="text-[11.5px] font-bold text-info-600 hover:underline">
              {allHistory ? 'Voir moins' : 'Voir tout →'}
            </button>
          )}
        </div>
        <ol className="m-0 list-none p-0">
          {history.map((h: HistoryEntry, i) => (
            <li key={h.id} className="relative grid grid-cols-[74px_minmax(0,1fr)] gap-3 pb-3 pl-5 last:pb-0">
              {i < history.length - 1 && <span className="absolute left-[4px] top-3 h-full w-px bg-line" />}
              <span className="absolute left-0 top-[5px] h-[9px] w-[9px] rounded-full border-2 border-info-600 bg-white" />
              <span className="text-[11.5px] font-semibold tabular-nums text-info-600">{formatDay(h.date)}</span>
              <span className="min-w-0">
                <span className="block text-[12px] font-bold text-ink">{h.label}</span>
                <span className="block text-[10.5px] font-medium text-faint">{h.actor}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <button
        type="button"
        onClick={onToggleStatus}
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg border-[1.5px] px-3.5 py-2.5 text-[12.5px] font-bold ${
          b.status === 'actif' ? 'border-danger-200 text-danger-600 hover:bg-danger-50' : 'border-line text-success-600 hover:bg-success-50'
        }`}
      >
        <span className="ic text-lg">{b.status === 'actif' ? 'pause_circle' : 'check_circle'}</span>
        {b.status === 'actif' ? 'Désactiver le boîtier' : 'Activer le boîtier'}
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Modales                                                             */
/* ------------------------------------------------------------------ */

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 px-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="m-0 text-[15px] font-extrabold text-ink">{title}</p>
          <button type="button" onClick={onClose} className="ic text-xl text-faint hover:text-ink" aria-label="Fermer">
            close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function FormActions({ onClose, cta, disabled }: { onClose: () => void; cta: string; disabled?: boolean }) {
  return (
    <div className="mt-5 flex justify-end gap-2.5">
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg border-[1.5px] border-line px-4 py-2 text-[12.5px] font-bold text-ink hover:bg-page"
      >
        Annuler
      </button>
      <button
        type="submit"
        disabled={disabled}
        className="rounded-lg bg-brand-600 px-4 py-2 text-[12.5px] font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {cta}
      </button>
    </div>
  )
}

interface BoitierFormValues {
  id: string
  region: string
  conducteurId: string
}

/** Enregistrement d'un nouveau boîtier, ou modification de ses informations administratives. */
function BoitierForm({
  initial,
  boitiers,
  conducteurs,
  defaultId,
  defaultRegion,
  onSubmit,
  onClose,
}: {
  initial: Boitier | null
  boitiers: Boitier[]
  conducteurs: Conducteur[]
  defaultId: string
  defaultRegion: string
  onSubmit: (v: BoitierFormValues) => void
  onClose: () => void
}) {
  const [v, setV] = useState<BoitierFormValues>({
    id: initial?.id ?? defaultId,
    region: initial?.region ?? defaultRegion,
    conducteurId: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof BoitierFormValues, string>>>({})

  const taken = useMemo(() => new Set(boitiers.map((b) => b.conducteurId).filter(Boolean) as string[]), [boitiers])
  const available = useMemo(
    () => conducteurs.filter((c) => c.region === v.region && !taken.has(c.id)).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [conducteurs, v.region, taken],
  )
  const regionLocked = !!initial?.conducteurId

  const validate = () => {
    const next: Partial<Record<keyof BoitierFormValues, string>> = {}
    const id = v.id.trim()
    if (!id) next.id = "L'identifiant est obligatoire."
    else if (boitiers.some((b) => b.id.toLowerCase() === id.toLowerCase() && b.id !== initial?.id)) next.id = 'Cet identifiant existe déjà.'
    if (!v.region) next.region = 'Choisissez une région.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (validate()) onSubmit({ ...v, id: v.id.trim() })
  }

  return (
    <ModalShell title={initial ? 'Modifier le boîtier' : 'Enregistrer un boîtier'} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="flex flex-col gap-3.5">
          <label className="block">
            <span className={labelCls}>Identifiant *</span>
            <input
              className={fieldCls}
              value={v.id}
              onChange={(e) => {
                setV((p) => ({ ...p, id: e.target.value }))
                setErrors((p) => ({ ...p, id: undefined }))
              }}
              placeholder="Ex : SR-BOX-157"
            />
            {errors.id && <span className="mt-1 block text-[11px] font-semibold text-danger-600">{errors.id}</span>}
          </label>
          <label className="block">
            <span className={labelCls}>Région *</span>
            <select
              className={fieldCls}
              value={v.region}
              disabled={regionLocked}
              onChange={(e) => {
                setV((p) => ({ ...p, region: e.target.value, conducteurId: '' }))
                setErrors((p) => ({ ...p, region: undefined }))
              }}
            >
              <option value="">Choisir une région…</option>
              {REGION_STATS.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.label}
                </option>
              ))}
            </select>
            {errors.region && <span className="mt-1 block text-[11px] font-semibold text-danger-600">{errors.region}</span>}
            {regionLocked && (
              <span className="mt-1 block text-[11px] text-faint">Retirez d'abord l'affectation pour changer la région de ce boîtier.</span>
            )}
          </label>
          {!initial && (
            <label className="block">
              <span className={labelCls}>Conducteur (optionnel)</span>
              <select
                className={fieldCls}
                value={v.conducteurId}
                disabled={!v.region}
                onChange={(e) => setV((p) => ({ ...p, conducteurId: e.target.value }))}
              >
                <option value="">{v.region ? 'Ne pas affecter pour le moment' : "Choisissez d'abord une région"}</option>
                {available.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.plate}
                  </option>
                ))}
              </select>
              {v.region && available.length === 0 && (
                <span className="mt-1 block text-[11px] text-faint">Aucun conducteur équipé sans boîtier dans cette région.</span>
              )}
            </label>
          )}
          {!initial && (
            <p className="m-0 text-[11px] text-faint">
              L'UUID et la clé API sont générés automatiquement. Le boîtier est enregistré avec le statut administratif « Actif ».
            </p>
          )}
        </div>
        <FormActions onClose={onClose} cta={initial ? 'Enregistrer' : 'Enregistrer le boîtier'} />
      </form>
    </ModalShell>
  )
}

function AssignForm({
  boitier,
  conducteurs,
  boitiers,
  onSubmit,
  onClose,
}: {
  boitier: Boitier
  conducteurs: Conducteur[]
  boitiers: Boitier[]
  onSubmit: (conducteurId: string) => void
  onClose: () => void
}) {
  const takenByOthers = useMemo(
    () => new Set(boitiers.filter((b) => b.id !== boitier.id).map((b) => b.conducteurId).filter(Boolean) as string[]),
    [boitiers, boitier.id],
  )
  const options = useMemo(
    () => conducteurs.filter((c) => c.region === boitier.region && !takenByOthers.has(c.id)).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [conducteurs, boitier.region, takenByOthers],
  )
  const [choice, setChoice] = useState(boitier.conducteurId ?? '')
  const chosen = options.find((c) => c.id === choice) ?? null
  const unchanged = choice === (boitier.conducteurId ?? '')

  return (
    <ModalShell title={boitier.conducteurId ? "Modifier l'affectation" : 'Affecter à un conducteur'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (choice && !unchanged) onSubmit(choice)
        }}
      >
        <p className="m-0 mb-3 text-[12px] text-body">
          Boîtier <span className="font-bold text-ink">{boitier.id}</span> · {regionName(boitier.region)}. Seuls les conducteurs équipés de cette région qui n'ont pas
          encore de boîtier sont proposés.
        </p>
        <label className="block">
          <span className={labelCls}>Conducteur *</span>
          <select className={fieldCls} value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="">Choisir un conducteur…</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.id === boitier.conducteurId ? ' (actuel)' : ''}
              </option>
            ))}
          </select>
        </label>
        {options.length === 0 && <p className="m-0 mt-2 text-[11.5px] text-warning-600">Aucun conducteur disponible dans cette région.</p>}
        {chosen && (
          <p className="m-0 mt-3 rounded-lg bg-page px-3 py-2 text-[12px] text-body">
            Véhicule associé : <span className="font-bold text-ink">{chosen.plate}</span>
          </p>
        )}
        <FormActions onClose={onClose} cta="Valider l'affectation" disabled={!choice || unchanged} />
      </form>
    </ModalShell>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface RowMenu {
  id: string
  top: number
  right: number
  up: boolean
}

interface ConfirmState {
  title: string
  text: string
  cta: string
  danger?: boolean
  onConfirm: () => void
}

export function BoitiersPage() {
  const { user } = useAuth()
  const [boitiers, setBoitiers] = useState<Boitier[]>(INITIAL_BOITIERS)
  const conducteurs = INITIAL_CONDUCTEURS
  const [lastRefresh, setLastRefresh] = useState(() => formatNow())

  const [region, setRegion] = useState<'toutes' | string>('toutes')
  const [search, setSearch] = useState('')
  const [affectationF, setAffectationF] = useState<AffectationFilter>('tous')
  const [statusF, setStatusF] = useState<'tous' | BoitierStatus>('tous')
  const [conducteurF, setConducteurF] = useState<'tous' | string>('tous')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)

  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(INITIAL_BOITIERS[0]?.id ?? null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [menu, setMenu] = useState<RowMenu | null>(null)
  const [formMode, setFormMode] = useState<{ editId: string | null } | null>(null)
  const [assignId, setAssignId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const headCheckRef = useRef<HTMLInputElement | null>(null)
  const pendingPage = useRef<number | null>(null)

  const actor = user ? `Super Admin : ${user.firstName[0] ?? ''}. ${user.lastName}` : 'Super Admin'

  const driverById = useMemo(() => new Map(conducteurs.map((c) => [c.id, c])), [conducteurs])
  const driverOf = (b: Boitier) => (b.conducteurId ? (driverById.get(b.conducteurId) ?? null) : null)

  /* --- Données dérivées ------------------------------------------------ */

  const scoped = useMemo(() => boitiers.filter((b) => region === 'toutes' || b.region === region), [boitiers, region])

  const kpis = useMemo(
    () => ({
      total: scoped.length,
      affectes: scoped.filter((b) => b.conducteurId).length,
      nonAffectes: scoped.filter((b) => !b.conducteurId).length,
      actifs: scoped.filter((b) => b.status === 'actif').length,
    }),
    [scoped],
  )

  /** Conducteurs qui portent un boîtier dans la région choisie (options du filtre « Conducteur »). */
  const conducteurOptions = useMemo(
    () =>
      scoped
        .map((b) => driverOf(b))
        .filter((c): c is Conducteur => !!c)
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scoped, driverById],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return scoped
      .filter((b) => {
        if (affectationF === 'affecte' && !b.conducteurId) return false
        if (affectationF === 'non_affecte' && b.conducteurId) return false
        if (statusF !== 'tous' && b.status !== statusF) return false
        if (conducteurF !== 'tous' && b.conducteurId !== conducteurF) return false
        if (!q) return true
        const d = b.conducteurId ? driverById.get(b.conducteurId) : undefined
        return (
          b.id.toLowerCase().includes(q) ||
          b.uuid.toLowerCase().includes(q) ||
          regionName(b.region).toLowerCase().includes(q) ||
          (d?.name.toLowerCase().includes(q) ?? false) ||
          (d?.plate.toLowerCase().includes(q) ?? false)
        )
      })
      .sort((a, b) => (sortDir === 'asc' ? 1 : -1) * a.id.localeCompare(b.id, 'fr', { numeric: true }))
  }, [scoped, search, affectationF, statusF, conducteurF, sortDir, driverById])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const firstShown = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const lastShown = Math.min(currentPage * PAGE_SIZE, filtered.length)
  const hasFilters = region !== 'toutes' || !!search.trim() || affectationF !== 'tous' || statusF !== 'tous' || conducteurF !== 'tous'

  const allOnPage = pageRows.length > 0 && pageRows.every((b) => checked.has(b.id))
  const someOnPage = pageRows.some((b) => checked.has(b.id))
  const selected = selectedId ? (boitiers.find((b) => b.id === selectedId) ?? null) : null
  const menuBoitier = menu ? (boitiers.find((b) => b.id === menu.id) ?? null) : null
  const editBoitier = formMode?.editId ? (boitiers.find((b) => b.id === formMode.editId) ?? null) : null
  const assignBoitier = assignId ? (boitiers.find((b) => b.id === assignId) ?? null) : null

  const nextId = useMemo(() => {
    const max = boitiers.reduce((m, b) => Math.max(m, parseInt(b.id.replace(/\D/g, ''), 10) || 0), 0)
    return `SR-BOX-${String(max + 1).padStart(3, '0')}`
  }, [boitiers])

  /* --- Effets ----------------------------------------------------------- */

  useEffect(() => {
    setPage(pendingPage.current ?? 1)
    pendingPage.current = null
    setChecked(new Set())
  }, [region, search, affectationF, statusF, conducteurF])

  // Le filtre « Conducteur » ne doit pas pointer vers un conducteur absent de la région choisie.
  useEffect(() => {
    if (conducteurF !== 'tous' && !conducteurOptions.some((c) => c.id === conducteurF)) setConducteurF('tous')
  }, [conducteurOptions, conducteurF])

  useEffect(() => {
    if (headCheckRef.current) headCheckRef.current.indeterminate = someOnPage && !allOnPage
  }, [someOnPage, allOnPage])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3400)
    return () => clearTimeout(id)
  }, [toast])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (confirm) setConfirm(null)
      else if (assignId) setAssignId(null)
      else if (formMode) setFormMode(null)
      else if (menu) setMenu(null)
      else if (drawerOpen) setDrawerOpen(false)
    }
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-row-menu]')) setMenu(null)
    }
    const close = () => setMenu(null)
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [confirm, assignId, formMode, menu, drawerOpen])

  /* --- Mutations locales ------------------------------------------------ */

  const patch = (id: string, fn: (b: Boitier) => Boitier) => setBoitiers((prev) => prev.map((b) => (b.id === id ? fn(b) : b)))

  const entry = (kind: HistoryEntry['kind'], label: string): HistoryEntry => ({
    id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    date: todayIso(),
    label,
    actor,
  })

  const resetFilters = () => {
    setRegion('toutes')
    setSearch('')
    setAffectationF('tous')
    setStatusF('tous')
    setConducteurF('tous')
  }

  const openDetail = (id: string) => {
    setSelectedId(id)
    setDrawerOpen(true)
  }

  const openMenu = (e: ReactMouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation()
    if (menu?.id === id) {
      setMenu(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setMenu({ id, top: rect.bottom + 4, right: window.innerWidth - rect.right, up: window.innerHeight - rect.bottom < 290 })
  }

  const copy = async (label: string, value: string) => {
    setToast((await copyText(value)) ? `${label} copié.` : "Impossible de copier : le navigateur a refusé l'accès au presse-papiers.")
  }

  const applyStatus = (ids: string[], status: BoitierStatus) => {
    // TODO backend : PATCH du statut administratif de chaque boîtier
    setBoitiers((prev) => prev.map((b) => (ids.includes(b.id) ? { ...b, status } : b)))
  }

  const toggleStatus = (b: Boitier) => {
    if (b.status === 'actif') {
      const d = driverOf(b)
      setConfirm({
        title: 'Désactiver ce boîtier ?',
        text: `${b.id} ne sera plus considéré comme actif par la plateforme tant qu'il n'est pas réactivé.${d ? ` Il reste affecté à ${d.name}.` : ''}`,
        cta: 'Désactiver',
        danger: true,
        onConfirm: () => {
          applyStatus([b.id], 'inactif')
          setToast(`${b.id} désactivé.`)
        },
      })
    } else {
      applyStatus([b.id], 'actif')
      setToast(`${b.id} réactivé.`)
    }
  }

  const bulkStatus = (status: BoitierStatus) => {
    const targets = boitiers.filter((b) => checked.has(b.id) && b.status !== status)
    if (targets.length === 0) {
      setToast(status === 'inactif' ? 'Aucun boîtier actif dans la sélection.' : 'Aucun boîtier inactif dans la sélection.')
      return
    }
    const run = () => {
      applyStatus(
        targets.map((b) => b.id),
        status,
      )
      setChecked(new Set())
      setToast(`${targets.length} boîtier${targets.length > 1 ? 's' : ''} ${status === 'actif' ? 'réactivé' : 'désactivé'}${targets.length > 1 ? 's' : ''}.`)
    }
    if (status === 'inactif') {
      setConfirm({
        title: `Désactiver ${targets.length} boîtier${targets.length > 1 ? 's' : ''} ?`,
        text: "Ces boîtiers ne seront plus considérés comme actifs par la plateforme tant qu'ils ne sont pas réactivés.",
        cta: 'Désactiver',
        danger: true,
        onConfirm: run,
      })
    } else run()
  }

  const unassign = (b: Boitier) => {
    const d = driverOf(b)
    if (!d) return
    setConfirm({
      title: "Retirer l'affectation ?",
      text: `${b.id} ne sera plus rattaché à ${d.name} (${d.plate}). Le conducteur redeviendra disponible pour un autre boîtier.`,
      cta: 'Retirer',
      danger: true,
      onConfirm: () => {
        // TODO backend : DELETE de l'affectation conducteur/véhicule
        patch(b.id, (x) => ({ ...x, conducteurId: null, assignedAt: null, history: [entry('desaffecte', `Désaffecté de ${d.name}`), ...x.history] }))
        setToast(`${b.id} n'est plus affecté.`)
      },
    })
  }

  const assign = (b: Boitier, conducteurId: string) => {
    const next = driverById.get(conducteurId)
    if (!next) return
    const prev = driverOf(b)
    // TODO backend : POST / PUT de l'affectation boîtier ↔ conducteur (le véhicule suit le conducteur)
    patch(b.id, (x) => ({
      ...x,
      conducteurId,
      assignedAt: todayIso(),
      history: [entry('affecte', `Affecté à ${next.name}`), ...(prev ? [entry('desaffecte', `Désaffecté de ${prev.name}`)] : []), ...x.history],
    }))
    setAssignId(null)
    setToast(`${b.id} affecté à ${next.name}.`)
  }

  const resetKey = (b: Boitier) => {
    setConfirm({
      title: 'Réinitialiser la clé API ?',
      text: `L'ancienne clé de ${b.id} cessera immédiatement de fonctionner : le boîtier devra être reconfiguré avec la nouvelle clé.`,
      cta: 'Réinitialiser',
      danger: true,
      onConfirm: () => {
        // TODO backend : régénérer la clé côté serveur (elle ne doit jamais être produite côté navigateur)
        patch(b.id, (x) => ({ ...x, apiKey: newApiKey() }))
        setToast(`Nouvelle clé API générée pour ${b.id}.`)
      },
    })
  }

  const submitForm = (values: BoitierFormValues) => {
    if (editBoitier) {
      // TODO backend : PATCH des informations administratives du boîtier
      setBoitiers((prev) => prev.map((b) => (b.id === editBoitier.id ? { ...b, id: values.id, region: values.region } : b)))
      if (selectedId === editBoitier.id) setSelectedId(values.id)
      setToast(`${values.id} mis à jour.`)
    } else {
      // TODO backend : POST d'enregistrement (l'UUID et la clé API sont générés par le serveur)
      const d = values.conducteurId ? driverById.get(values.conducteurId) : undefined
      const today = todayIso()
      const created: Boitier = {
        id: values.id,
        uuid: newUuid(),
        apiKey: newApiKey(),
        region: values.region,
        status: 'actif',
        registeredAt: today,
        conducteurId: d?.id ?? null,
        assignedAt: d ? today : null,
        history: [...(d ? [entry('affecte', `Affecté à ${d.name}`)] : []), entry('enregistre', 'Boîtier enregistré')],
      }
      setBoitiers((prev) => [...prev, created])
      setSelectedId(created.id)
      setDrawerOpen(true)
      setToast(`${created.id} enregistré.`)
      // Le nouveau boîtier apparaît en dernière page (tri croissant) : on s'y rend.
      const lastPage = sortDir === 'asc' ? Math.ceil((boitiers.length + 1) / PAGE_SIZE) : 1
      if (hasFilters) {
        pendingPage.current = lastPage
        resetFilters()
      } else setPage(lastPage)
    }
    setFormMode(null)
  }

  /* --- Rendu ------------------------------------------------------------ */

  const card = 'min-w-0 rounded-xl border border-line bg-white shadow-card'
  const selectCls =
    'w-full cursor-pointer rounded-[9px] border-[1.5px] border-line-field bg-white px-2.5 py-2 text-[12.5px] font-medium text-ink outline-none focus:border-brand-600'

  const kpiCards = [
    { key: 'total', icon: 'deployed_code', tint: '#2b6cb0', soft: '#e8f0f9', label: 'Total boîtiers', value: kpis.total, sub: 'Boîtiers enregistrés' },
    { key: 'affectes', icon: 'person', tint: '#1f9d55', soft: '#e9f6ee', label: 'Affectés', value: kpis.affectes, sub: 'Associés à un conducteur' },
    { key: 'non', icon: 'link_off', tint: '#dc3a2f', soft: '#fdeeec', label: 'Non affectés', value: kpis.nonAffectes, sub: "En attente d'affectation" },
    { key: 'actifs', icon: 'check_circle', tint: '#1f9d55', soft: '#e9f6ee', label: 'Actifs', value: kpis.actifs, sub: 'Boîtiers administrativement actifs' },
  ]

  const pageButtons: (number | '…')[] = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const set = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1])
    const nums = [...set].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b)
    const out: (number | '…')[] = []
    nums.forEach((n, i) => {
      if (i > 0 && n - nums[i - 1] > 1) out.push('…')
      out.push(n)
    })
    return out
  })()

  const detailProps = (b: Boitier): DetailProps => ({
    boitier: b,
    conducteur: driverOf(b),
    onBack: () => {
      setDrawerOpen(false)
      setSelectedId(null)
    },
    onEdit: () => setFormMode({ editId: b.id }),
    onAssign: () => setAssignId(b.id),
    onUnassign: () => unassign(b),
    onToggleStatus: () => toggleStatus(b),
    onResetKey: () => resetKey(b),
    onCopy: copy,
  })

  return (
    <div className="pb-8">
      {/* En-tête */}
      <section className="mx-6 mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="ic flex-none text-[44px] text-navy-900">deployed_code</span>
          <div className="min-w-0">
            <h1 className="text-[clamp(24px,2.8vw,32px)] font-extrabold leading-[1.1] tracking-[-0.026em] text-navy-900">Boîtiers</h1>
            <p className="mt-1 text-[13.5px] leading-relaxed text-info-600">Gestion et affectation des boîtiers SafeRoad.</p>
          </div>
        </div>
        <div className="ml-auto flex flex-col items-end gap-1.5">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <label className="flex min-w-[210px] cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-white px-3.5 py-3 shadow-card">
              <span className="ic text-[22px] text-navy-900">place</span>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                aria-label="Région"
                className="min-w-0 flex-1 cursor-pointer bg-transparent text-[12.5px] font-semibold text-ink outline-none"
              >
                <option value="toutes">Toutes les régions</option>
                {REGION_STATS.map((r) => (
                  <option key={r.slug} value={r.slug}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setFormMode({ editId: null })}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-brand-600 px-5 py-3.5 text-[13px] font-bold text-white shadow-card transition-colors hover:bg-brand-700"
            >
              <span className="ic text-xl">add</span>
              Ajouter un boîtier
            </button>
            <button
              type="button"
              onClick={() => {
                // TODO backend : recharger la liste et les compteurs
                setLastRefresh(formatNow())
                setToast('Liste actualisée.')
              }}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-line bg-white px-5 py-3.5 text-[13px] font-bold text-ink shadow-card transition-colors hover:bg-page"
            >
              <span className="ic text-xl text-info-600">refresh</span>
              Actualiser
            </button>
          </div>
          <p className="m-0 text-[10.5px] font-medium text-faint">Dernière mise à jour : {lastRefresh}</p>
        </div>
      </section>

      {/* Cartes de synthèse */}
      <section className="mx-6 mt-4.5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((k) => (
          <div key={k.key} className={`${card} flex items-center gap-3.5 p-4`}>
            <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full" style={{ background: k.soft, color: k.tint }}>
              <span className="ic text-[26px]">{k.icon}</span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[13px] font-bold leading-tight text-ink">{k.label}</p>
              <p className="m-0 mt-0.5 text-[28px] font-extrabold leading-none tracking-tight text-navy-900">{fmt(k.value)}</p>
              <p className="m-0 mt-1.5 text-[11.5px] font-medium leading-snug text-info-600">{k.sub}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="mx-6 mt-4.5 grid grid-cols-1 items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Filtres */}
          <section className={`${card} flex flex-wrap items-end gap-3.5 p-4`}>
            <label className="relative min-w-[220px] flex-[2_1_260px]">
              <span className="ic pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xl text-faint">search</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par identifiant, UUID, conducteur, véhicule…"
                className="w-full rounded-[9px] border-[1.5px] border-line-field bg-field py-2.5 pl-10 pr-3 text-[12.5px] font-medium text-ink outline-none placeholder:text-faint focus:border-brand-600"
              />
            </label>
            <label className="block min-w-[140px] flex-[1_1_140px]">
              <span className="mb-1 block text-[11px] font-bold text-ink">Région</span>
              <select value={region} onChange={(e) => setRegion(e.target.value)} className={selectCls}>
                <option value="toutes">Toutes les régions</option>
                {REGION_STATS.map((r) => (
                  <option key={r.slug} value={r.slug}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-[120px] flex-[1_1_120px]">
              <span className="mb-1 block text-[11px] font-bold text-ink">Affectation</span>
              <select value={affectationF} onChange={(e) => setAffectationF(e.target.value as AffectationFilter)} className={selectCls}>
                <option value="tous">Tous</option>
                <option value="affecte">Affecté</option>
                <option value="non_affecte">Non affecté</option>
              </select>
            </label>
            <label className="block min-w-[110px] flex-[1_1_110px]">
              <span className="mb-1 block text-[11px] font-bold text-ink">Statut</span>
              <select value={statusF} onChange={(e) => setStatusF(e.target.value as 'tous' | BoitierStatus)} className={selectCls}>
                <option value="tous">Tous</option>
                <option value="actif">Actif</option>
                <option value="inactif">Inactif</option>
              </select>
            </label>
            <label className="block min-w-[150px] flex-[1_1_150px]">
              <span className="mb-1 block text-[11px] font-bold text-ink">Conducteur</span>
              <select value={conducteurF} onChange={(e) => setConducteurF(e.target.value)} className={selectCls}>
                <option value="tous">Tous</option>
                {conducteurOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasFilters}
              className="inline-flex items-center gap-1.5 whitespace-nowrap px-1 pb-2.5 text-[12px] font-bold text-info-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="ic text-lg">restart_alt</span>
              Réinitialiser
            </button>
          </section>

          {/* Liste */}
          <section className={`${card} p-5`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="m-0 text-[15px] font-extrabold text-ink">
                Liste des boîtiers <span className="font-medium text-body">({fmt(filtered.length)})</span>
              </p>
              {checked.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-full bg-info-50 px-3 py-1.5 text-[12px] font-bold text-info-600">
                  {checked.size} sélectionné{checked.size > 1 ? 's' : ''}
                  <span className="h-4 w-px bg-info-600/30" />
                  <button type="button" onClick={() => bulkStatus('actif')} className="hover:underline">
                    Activer
                  </button>
                  <button type="button" onClick={() => bulkStatus('inactif')} className="text-danger-600 hover:underline">
                    Désactiver
                  </button>
                  <button type="button" onClick={() => setChecked(new Set())} className="text-body hover:underline">
                    Annuler
                  </button>
                </div>
              )}
            </div>

            <div className="overflow-x-auto rounded-lg border border-line-soft">
              <table className="w-full min-w-[980px] border-collapse text-left text-[12.5px]">
                <thead>
                  <tr className="bg-page text-[11.5px] font-bold text-ink">
                    <th className="w-10 py-3 pl-4">
                      <input
                        ref={headCheckRef}
                        type="checkbox"
                        checked={allOnPage}
                        onChange={() =>
                          setChecked((prev) => {
                            const next = new Set(prev)
                            if (allOnPage) pageRows.forEach((b) => next.delete(b.id))
                            else pageRows.forEach((b) => next.add(b.id))
                            return next
                          })
                        }
                        aria-label="Tout sélectionner sur cette page"
                        className="h-4 w-4 cursor-pointer accent-brand-600"
                      />
                    </th>
                    <th className="py-3 pr-3">
                      <button
                        type="button"
                        onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                        className="inline-flex items-center gap-0.5 hover:text-brand-600"
                        aria-label="Trier par identifiant"
                      >
                        Boîtier
                        <span className="ic text-base">{sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>
                      </button>
                    </th>
                    <th className="px-3 py-3">UUID</th>
                    <th className="px-3 py-3">Conducteur</th>
                    <th className="px-3 py-3">Véhicule</th>
                    <th className="px-3 py-3">Région</th>
                    <th className="px-3 py-3">Affectation</th>
                    <th className="px-3 py-3">Statut</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((b) => {
                    const d = driverOf(b)
                    return (
                      <tr
                        key={b.id}
                        className={`border-t border-line-soft hover:bg-page/60 ${selectedId === b.id ? 'bg-info-50/60' : checked.has(b.id) ? 'bg-info-50/40' : ''}`}
                      >
                        <td className="py-2.5 pl-4">
                          <input
                            type="checkbox"
                            checked={checked.has(b.id)}
                            onChange={() =>
                              setChecked((prev) => {
                                const next = new Set(prev)
                                if (next.has(b.id)) next.delete(b.id)
                                else next.add(b.id)
                                return next
                              })
                            }
                            aria-label={`Sélectionner ${b.id}`}
                            className="h-4 w-4 cursor-pointer accent-brand-600"
                          />
                        </td>
                        <td className="py-2.5 pr-3">
                          <button type="button" onClick={() => openDetail(b.id)} className="flex items-center gap-2.5 text-left">
                            <span className="ic flex-none text-[24px] text-info-600">deployed_code</span>
                            <span>
                              <span className="block text-[12.5px] font-extrabold text-ink">{b.id}</span>
                              <span className="block text-[10.5px] font-medium text-info-600">SafeRoad Box</span>
                            </span>
                          </button>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[11px] text-info-600" title={b.uuid}>
                          {b.uuid.slice(0, 14)}…
                        </td>
                        <td className="px-3 py-2.5 font-medium text-ink">{d ? d.name : '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-medium text-ink">{d ? d.plate : '—'}</td>
                        <td className="px-3 py-2.5 font-medium text-ink">{regionName(b.region)}</td>
                        <td className="px-3 py-2.5">
                          <AffectationBadge affecte={!!d} />
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={b.status} />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openDetail(b.id)}
                              className="rounded-lg border-[1.5px] border-line px-3 py-1.5 text-[12px] font-bold text-info-600 transition-colors hover:bg-page"
                            >
                              Voir
                            </button>
                            <button
                              type="button"
                              data-row-menu
                              onClick={(e) => openMenu(e, b.id)}
                              aria-label={`Plus d'actions pour ${b.id}`}
                              aria-haspopup="menu"
                              aria-expanded={menu?.id === b.id}
                              className="ic flex h-8 w-8 items-center justify-center rounded-lg text-xl text-body hover:bg-page"
                            >
                              more_vert
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {pageRows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center">
                        <span className="ic text-4xl text-faint">search_off</span>
                        <p className="m-0 mt-2 text-[13px] font-bold text-ink">Aucun boîtier ne correspond à ces critères.</p>
                        {hasFilters && (
                          <button type="button" onClick={resetFilters} className="mt-2 text-[12px] font-bold text-info-600 hover:underline">
                            Réinitialiser les filtres
                          </button>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="m-0 text-[12px] font-medium text-info-600">
                Affichage de {firstShown} à {lastShown} sur {fmt(filtered.length)} boîtier{filtered.length > 1 ? 's' : ''}
              </p>
              {totalPages > 1 && (
                <nav className="flex items-center gap-1.5" aria-label="Pagination">
                  <button
                    type="button"
                    onClick={() => setPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    aria-label="Page précédente"
                    className="ic flex h-8 w-8 items-center justify-center rounded-lg border border-line text-lg text-body hover:bg-page disabled:opacity-35"
                  >
                    chevron_left
                  </button>
                  {pageButtons.map((p, i) =>
                    p === '…' ? (
                      <span key={`gap-${i}`} className="px-1 text-faint">
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPage(p)}
                        aria-current={p === currentPage ? 'page' : undefined}
                        className={`h-8 min-w-8 rounded-lg border px-2 text-[12px] font-bold ${
                          p === currentPage ? 'border-info-600 bg-info-600 text-white' : 'border-line text-ink hover:bg-page'
                        }`}
                      >
                        {p}
                      </button>
                    ),
                  )}
                  <button
                    type="button"
                    onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    aria-label="Page suivante"
                    className="ic flex h-8 w-8 items-center justify-center rounded-lg border border-line text-lg text-body hover:bg-page disabled:opacity-35"
                  >
                    chevron_right
                  </button>
                </nav>
              )}
            </div>
          </section>
        </div>

        {/* Détail : à droite sur grand écran, en volet sinon */}
        <aside className="hidden min-w-0 2xl:sticky 2xl:top-4 2xl:block">
          {selected ? (
            <DetailPanel key={selected.id} {...detailProps(selected)} />
          ) : (
            <div className={`${card} flex flex-col items-center gap-2 px-6 py-14 text-center`}>
              <span className="ic text-4xl text-faint">deployed_code</span>
              <p className="m-0 text-[13px] font-bold text-ink">Aucun boîtier sélectionné</p>
              <p className="m-0 text-[12px] text-body">Cliquez sur « Voir » dans la liste pour afficher ses informations détaillées.</p>
            </div>
          )}
        </aside>
      </div>

      {drawerOpen && selected && (
        <div className="fixed inset-0 z-[1800] bg-black/30 2xl:hidden" onMouseDown={() => setDrawerOpen(false)}>
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={`Détail de ${selected.id}`}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 h-full w-full max-w-[420px] overflow-y-auto bg-page p-4 shadow-xl"
          >
            <DetailPanel key={selected.id} {...detailProps(selected)} />
          </aside>
        </div>
      )}

      {/* Menu d'actions d'une ligne */}
      {menu && menuBoitier && (
        <div
          data-row-menu
          role="menu"
          className="fixed z-[1500] w-60 rounded-xl border border-line bg-white py-1.5 shadow-xl"
          style={menu.up ? { bottom: window.innerHeight - menu.top + 40, right: menu.right } : { top: menu.top, right: menu.right }}
        >
          {[
            { icon: 'visibility', label: 'Voir le détail', run: () => openDetail(menuBoitier.id), danger: false, show: true },
            { icon: 'edit', label: 'Modifier', run: () => setFormMode({ editId: menuBoitier.id }), danger: false, show: true },
            {
              icon: menuBoitier.conducteurId ? 'swap_horiz' : 'add_link',
              label: menuBoitier.conducteurId ? "Modifier l'affectation" : 'Affecter à un conducteur',
              run: () => setAssignId(menuBoitier.id),
              danger: false,
              show: true,
            },
            { icon: 'link_off', label: "Retirer l'affectation", run: () => unassign(menuBoitier), danger: true, show: !!menuBoitier.conducteurId },
            menuBoitier.status === 'actif'
              ? { icon: 'pause_circle', label: 'Désactiver le boîtier', run: () => toggleStatus(menuBoitier), danger: true, show: true }
              : { icon: 'check_circle', label: 'Activer le boîtier', run: () => toggleStatus(menuBoitier), danger: false, show: true },
            { icon: 'key', label: 'Réinitialiser la clé API', run: () => resetKey(menuBoitier), danger: false, show: true },
          ]
            .filter((item) => item.show)
            .map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(null)
                  item.run()
                }}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[12.5px] font-semibold hover:bg-page ${
                  item.danger ? 'text-danger-600' : 'text-ink'
                }`}
              >
                <span className="ic text-lg">{item.icon}</span>
                {item.label}
              </button>
            ))}
        </div>
      )}

      {formMode && (
        <BoitierForm
          initial={editBoitier}
          boitiers={boitiers}
          conducteurs={conducteurs}
          defaultId={nextId}
          defaultRegion={region === 'toutes' ? '' : region}
          onSubmit={submitForm}
          onClose={() => setFormMode(null)}
        />
      )}

      {assignBoitier && (
        <AssignForm
          boitier={assignBoitier}
          conducteurs={conducteurs}
          boitiers={boitiers}
          onSubmit={(cid) => assign(assignBoitier, cid)}
          onClose={() => setAssignId(null)}
        />
      )}

      {confirm && (
        <div className="fixed inset-0 z-[2600] flex items-center justify-center bg-black/40 px-4" onMouseDown={() => setConfirm(null)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={confirm.title}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
          >
            <p className="m-0 text-[15px] font-extrabold text-ink">{confirm.title}</p>
            <p className="m-0 mt-2 text-[12.5px] leading-relaxed text-body">{confirm.text}</p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="rounded-lg border-[1.5px] border-line px-4 py-2 text-[12.5px] font-bold text-ink hover:bg-page"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  confirm.onConfirm()
                  setConfirm(null)
                }}
                className={`rounded-lg px-4 py-2 text-[12.5px] font-bold text-white ${
                  confirm.danger ? 'bg-danger-600 hover:bg-danger-700' : 'bg-brand-600 hover:bg-brand-700'
                }`}
              >
                {confirm.cta}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div role="status" className="fixed bottom-6 right-6 z-[3000] max-w-sm rounded-xl bg-navy-900 px-4 py-3 text-[12.5px] font-semibold text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  )
}
