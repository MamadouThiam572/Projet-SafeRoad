import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { REGION_STATS } from '@/data/superAdminHome'
import {
  INITIAL_STAFF_USERS,
  ROLE_META,
  ROLE_ORDER,
  type StaffRole,
  type StaffUser,
  type UserStatus,
} from '@/data/superAdminUsers'

/**
 * Super Admin → Utilisateurs : gestion des comptes de gestion (Super Admin,
 * Administrateurs régionaux, ANASER). Données de démonstration : chaque
 * mutation locale est marquée // TODO backend.
 */

const PAGE_SIZE = 8

const STATUS_META: Record<UserStatus, { label: string; icon: string; fg: string; bg: string }> = {
  actif: { label: 'Actif', icon: 'check_circle', fg: '#1f9d55', bg: '#e9f6ee' },
  inactif: { label: 'Inactif', icon: 'block', fg: '#dc3a2f', bg: '#fdeeec' },
}

const AVATAR_COLORS: [string, string][] = [
  ['#e8f0f9', '#2b6cb0'],
  ['#f1eafe', '#7c3aed'],
  ['#e9f6ee', '#1f9d55'],
  ['#fdf4e6', '#e8940c'],
  ['#fdeeec', '#dc3a2f'],
  ['#e3f3f8', '#0e8fb5'],
]

const nf = new Intl.NumberFormat('fr-FR')
const fmt = (n: number) => nf.format(n).replace(/\s/g, ' ')

const regionName = (slug: string | null) => (slug ? (REGION_STATS.find((r) => r.slug === slug)?.label ?? slug) : 'Toutes les régions')

/** AAAA-MM-JJTHH:mm → JJ/MM/AAAA HH:mm (sans passer par Date : pas de décalage de fuseau). */
const formatDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} ${iso.slice(11, 16)}`

function nowIso(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function formatNow(): string {
  return formatDate(nowIso())
}

const fullName = (u: StaffUser) => `${u.firstName} ${u.lastName}`
const initialsOf = (u: StaffUser) => `${u.firstName[0] ?? ''}${u.lastName[0] ?? ''}`.toUpperCase()

function Avatar({ user, size = 40 }: { user: StaffUser; size?: number }) {
  const hash = [...user.id].reduce((a, c) => a + c.charCodeAt(0), 0)
  const [bg, fg] = AVATAR_COLORS[hash % AVATAR_COLORS.length]
  return (
    <span
      className="flex flex-none items-center justify-center rounded-full font-extrabold"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.34 }}
    >
      {initialsOf(user)}
    </span>
  )
}

function RoleBadge({ role }: { role: StaffRole }) {
  const m = ROLE_META[role]
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{ background: m.bg, color: m.fg }}
    >
      <span className="ic text-[14px]">{m.icon}</span>
      {m.label}
    </span>
  )
}

function StatusBadge({ status }: { status: UserStatus }) {
  const m = STATUS_META[status]
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{ background: m.bg, color: m.fg }}
    >
      <span className="ic text-[14px]">{m.icon}</span>
      {m.label}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Formulaire de création / modification                               */
/* ------------------------------------------------------------------ */

interface FormValues {
  firstName: string
  lastName: string
  email: string
  phone: string
  role: StaffRole
  region: string
}

const fieldCls =
  'w-full rounded-[9px] border-[1.5px] border-line-field bg-field px-3 py-2 text-[12.5px] font-medium text-ink outline-none placeholder:text-faint focus:border-brand-600 disabled:cursor-not-allowed disabled:opacity-60'
const labelCls = 'mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-faint'

function UserForm({
  initial,
  users,
  onSubmit,
  onClose,
}: {
  initial: StaffUser | null
  users: StaffUser[]
  onSubmit: (values: FormValues) => void
  onClose: () => void
}) {
  const [v, setV] = useState<FormValues>({
    firstName: initial?.firstName ?? '',
    lastName: initial?.lastName ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    role: initial?.role ?? 'sous_admin',
    region: initial?.role === 'anaser' ? '' : (initial?.region ?? ''),
  })
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({})

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setV((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const otherAdmin =
    v.role === 'sous_admin' && v.region
      ? users.find((u) => u.role === 'sous_admin' && u.region === v.region && u.id !== initial?.id)
      : undefined

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormValues, string>> = {}
    if (!v.firstName.trim()) next.firstName = 'Le prénom est obligatoire.'
    if (!v.lastName.trim()) next.lastName = 'Le nom est obligatoire.'
    const email = v.email.trim().toLowerCase()
    if (!email) next.email = "L'email est obligatoire."
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Adresse email invalide.'
    else if (users.some((u) => u.email.toLowerCase() === email && u.id !== initial?.id)) next.email = 'Un compte utilise déjà cet email.'
    if (v.phone.trim() && v.phone.replace(/\D/g, '').length < 9) next.phone = 'Numéro de téléphone invalide.'
    if (v.role === 'sous_admin' && !v.region) next.region = 'Choisissez la région de cet administrateur.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (validate()) onSubmit(v)
  }

  const error = (k: keyof FormValues) =>
    errors[k] ? <span className="mt-1 block text-[11px] font-semibold text-danger-600">{errors[k]}</span> : null

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 px-4" onMouseDown={onClose}>
      <form
        onSubmit={handleSubmit}
        noValidate
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={initial ? "Modifier l'utilisateur" : 'Ajouter un utilisateur'}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="m-0 text-[15px] font-extrabold text-ink">{initial ? "Modifier l'utilisateur" : 'Ajouter un utilisateur'}</p>
          <button type="button" onClick={onClose} className="ic text-xl text-faint hover:text-ink" aria-label="Fermer">
            close
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <label className="block">
            <span className={labelCls}>Prénom *</span>
            <input className={fieldCls} value={v.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="Ex : Aminata" />
            {error('firstName')}
          </label>
          <label className="block">
            <span className={labelCls}>Nom *</span>
            <input className={fieldCls} value={v.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="Ex : Diop" />
            {error('lastName')}
          </label>
          <label className="block sm:col-span-2">
            <span className={labelCls}>Email *</span>
            <input
              type="email"
              className={fieldCls}
              value={v.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="prenom.nom@saferoad.sn"
            />
            {error('email')}
          </label>
          <label className="block sm:col-span-2">
            <span className={labelCls}>Téléphone</span>
            <input className={fieldCls} value={v.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+221 77 000 00 00" />
            {error('phone')}
          </label>
          <label className="block">
            <span className={labelCls}>Rôle *</span>
            <select
              className={fieldCls}
              value={v.role}
              onChange={(e) => {
                const role = e.target.value as StaffRole
                setV((prev) => ({ ...prev, role, region: role === 'anaser' ? '' : prev.region }))
                setErrors((prev) => ({ ...prev, region: undefined }))
              }}
            >
              {ROLE_ORDER.map((r) => (
                <option key={r} value={r}>
                  {ROLE_META[r].label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Région {v.role === 'sous_admin' ? '*' : ''}</span>
            <select
              className={fieldCls}
              value={v.role === 'anaser' ? '' : v.region}
              disabled={v.role === 'anaser'}
              onChange={(e) => set('region', e.target.value)}
            >
              {v.role === 'sous_admin' ? (
                <option value="">Choisir une région…</option>
              ) : (
                <option value="">Toutes les régions (portée nationale)</option>
              )}
              {REGION_STATS.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.label}
                </option>
              ))}
            </select>
            {error('region')}
          </label>
        </div>

        {v.role === 'anaser' && (
          <p className="m-0 mt-3 text-[11px] text-faint">Les comptes ANASER ont une portée nationale : ils ne sont rattachés à aucune région.</p>
        )}
        {otherAdmin && (
          <p className="m-0 mt-3 rounded-lg bg-warning-50 px-3 py-2 text-[11.5px] font-semibold text-warning-600">
            {regionName(v.region)} a déjà un administrateur régional : {fullName(otherAdmin)}.
          </p>
        )}
        {!initial && (
          <p className="m-0 mt-3 text-[11px] text-faint">
            Le compte est créé avec le statut « Actif ». Un email d'invitation permettra à l'utilisateur de définir son mot de passe.
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border-[1.5px] border-line px-4 py-2 text-[12.5px] font-bold text-ink hover:bg-page"
          >
            Annuler
          </button>
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-[12.5px] font-bold text-white hover:bg-brand-700">
            {initial ? 'Enregistrer' : "Créer l'utilisateur"}
          </button>
        </div>
      </form>
    </div>
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

interface Confirm {
  title: string
  text: string
  cta: string
  onConfirm: () => void
}

export function UtilisateursPage() {
  const [users, setUsers] = useState<StaffUser[]>(INITIAL_STAFF_USERS)
  const [lastRefresh, setLastRefresh] = useState(() => formatNow())

  const [region, setRegion] = useState<'toutes' | string>('toutes')
  const [search, setSearch] = useState('')
  const [roleF, setRoleF] = useState<'tous' | StaffRole>('tous')
  const [statusF, setStatusF] = useState<'tous' | UserStatus>('tous')
  const [yearF, setYearF] = useState<'tous' | string>('tous')
  const [page, setPage] = useState(1)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [menu, setMenu] = useState<RowMenu | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [form, setForm] = useState<{ editId: string | null } | null>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const headCheckRef = useRef<HTMLInputElement | null>(null)
  /** Page à afficher après une réinitialisation de filtres déclenchée par une création de compte. */
  const pendingPage = useRef<number | null>(null)

  /* --- Données dérivées ------------------------------------------------ */

  /** Comptes de la région choisie : alimente les 4 cartes de synthèse. */
  const scoped = useMemo(() => users.filter((u) => region === 'toutes' || u.region === region), [users, region])

  const kpis = useMemo(() => {
    const admins = scoped.filter((u) => u.role === 'sous_admin')
    const regionsAdministrees = new Set(admins.map((u) => u.region)).size
    return {
      total: scoped.length,
      actifs: scoped.filter((u) => u.status === 'actif').length,
      inactifs: scoped.filter((u) => u.status === 'inactif').length,
      admins: admins.length,
      regionsAdministrees,
    }
  }, [scoped])

  const years = useMemo(() => Array.from(new Set(users.map((u) => u.createdAt.slice(0, 4)))).sort().reverse(), [users])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const digits = q.replace(/\D/g, '')
    return scoped
      .filter((u) => {
        if (roleF !== 'tous' && u.role !== roleF) return false
        if (statusF !== 'tous' && u.status !== statusF) return false
        if (yearF !== 'tous' && u.createdAt.slice(0, 4) !== yearF) return false
        if (!q) return true
        return (
          fullName(u).toLowerCase().includes(q) ||
          `${u.lastName} ${u.firstName}`.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (digits.length >= 3 && u.phone.replace(/\D/g, '').includes(digits))
        )
      })
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }, [scoped, search, roleF, statusF, yearF])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const firstShown = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const lastShown = Math.min(currentPage * PAGE_SIZE, filtered.length)
  const hasFilters = region !== 'toutes' || !!search.trim() || roleF !== 'tous' || statusF !== 'tous' || yearF !== 'tous'

  const allOnPage = pageRows.length > 0 && pageRows.every((u) => selected.has(u.id))
  const someOnPage = pageRows.some((u) => selected.has(u.id))
  const detailUser = detailId ? (users.find((u) => u.id === detailId) ?? null) : null
  const editUser = form?.editId ? (users.find((u) => u.id === form.editId) ?? null) : null

  /* --- Effets ----------------------------------------------------------- */

  useEffect(() => {
    setPage(pendingPage.current ?? 1)
    pendingPage.current = null
    setSelected(new Set())
  }, [region, search, roleF, statusF, yearF])

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
      else if (form) setForm(null)
      else if (menu) setMenu(null)
      else if (detailId) setDetailId(null)
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
  }, [confirm, form, menu, detailId])

  /* --- Actions ---------------------------------------------------------- */

  const resetFilters = () => {
    setRegion('toutes')
    setSearch('')
    setRoleF('tous')
    setStatusF('tous')
    setYearF('tous')
  }

  const openMenu = (e: ReactMouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation()
    if (menu?.id === id) {
      setMenu(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setMenu({ id, top: rect.bottom + 4, right: window.innerWidth - rect.right, up: window.innerHeight - rect.bottom < 230 })
  }

  const applyStatus = (ids: string[], status: UserStatus) => {
    // TODO backend : PATCH du statut (activation / désactivation) pour chaque compte
    setUsers((prev) => prev.map((u) => (ids.includes(u.id) ? { ...u, status } : u)))
  }

  const setStatusFor = (u: StaffUser, status: UserStatus) => {
    if (status === 'inactif') {
      setConfirm({
        title: 'Désactiver ce compte ?',
        text: `${fullName(u)} ne pourra plus se connecter à SafeRoad tant que son compte ne sera pas réactivé.`,
        cta: 'Désactiver',
        onConfirm: () => {
          applyStatus([u.id], 'inactif')
          setToast(`Compte de ${fullName(u)} désactivé.`)
        },
      })
    } else {
      applyStatus([u.id], 'actif')
      setToast(`Compte de ${fullName(u)} réactivé.`)
    }
  }

  const bulkStatus = (status: UserStatus) => {
    const targets = users.filter((u) => selected.has(u.id) && u.status !== status)
    if (targets.length === 0) {
      setToast(status === 'inactif' ? 'Aucun compte à désactiver dans la sélection.' : 'Aucun compte à activer dans la sélection.')
      return
    }
    const run = () => {
      applyStatus(
        targets.map((u) => u.id),
        status,
      )
      setSelected(new Set())
      setToast(`${targets.length} compte${targets.length > 1 ? 's' : ''} ${status === 'actif' ? 'réactivé' : 'désactivé'}${targets.length > 1 ? 's' : ''}.`)
    }
    if (status === 'inactif') {
      setConfirm({
        title: `Désactiver ${targets.length} compte${targets.length > 1 ? 's' : ''} ?`,
        text: 'Ces utilisateurs ne pourront plus se connecter à SafeRoad tant que leur compte ne sera pas réactivé.',
        cta: 'Désactiver',
        onConfirm: run,
      })
    } else run()
  }

  const resetPassword = (u: StaffUser) => {
    // TODO backend : déclencher l'envoi du lien de réinitialisation du mot de passe
    setToast(`Un lien de réinitialisation sera envoyé à ${u.email}.`)
  }

  const submitForm = (values: FormValues) => {
    const base = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      email: values.email.trim().toLowerCase(),
      phone: values.phone.trim(),
      role: values.role,
      // Les comptes ANASER ont une portée nationale : jamais de région.
      region: values.role === 'anaser' ? null : values.region || null,
    }
    if (editUser) {
      // TODO backend : PATCH des informations du compte
      setUsers((prev) => prev.map((u) => (u.id === editUser.id ? { ...u, ...base } : u)))
      setToast(`Compte de ${base.firstName} ${base.lastName} mis à jour.`)
    } else {
      // TODO backend : POST de création du compte (+ envoi de l'email d'invitation)
      const created: StaffUser = { id: `usr-${Date.now()}`, ...base, status: 'actif', createdAt: nowIso() }
      setUsers((prev) => [...prev, created])
      setToast(`Compte créé pour ${base.firstName} ${base.lastName}.`)
      // La liste est triée par date de création : on affiche la dernière page, où le nouveau compte apparaît.
      const lastPage = Math.ceil((users.length + 1) / PAGE_SIZE)
      if (hasFilters) {
        pendingPage.current = lastPage
        resetFilters()
      } else setPage(lastPage)
    }
    setForm(null)
  }

  const menuUser = menu ? (users.find((u) => u.id === menu.id) ?? null) : null

  const selectCls =
    'w-full cursor-pointer rounded-[9px] border-[1.5px] border-line-field bg-white px-2.5 py-2 text-[12.5px] font-medium text-ink outline-none focus:border-brand-600'
  const card = 'min-w-0 rounded-xl border border-line bg-white shadow-card'

  const kpiCards = [
    { key: 'total', icon: 'group', tint: '#2b6cb0', soft: '#e8f0f9', label: 'Total utilisateurs', value: kpis.total, sub: 'Comptes enregistrés' },
    { key: 'actifs', icon: 'check_circle', tint: '#1f9d55', soft: '#e9f6ee', label: 'Actifs', value: kpis.actifs, sub: 'Comptes actifs' },
    { key: 'inactifs', icon: 'block', tint: '#dc3a2f', soft: '#fdeeec', label: 'Inactifs', value: kpis.inactifs, sub: 'Comptes désactivés' },
    {
      key: 'admins',
      icon: 'admin_panel_settings',
      tint: '#7c3aed',
      soft: '#f1eafe',
      label: 'Administrateurs régionaux',
      value: kpis.admins,
      sub: `${kpis.regionsAdministrees} région${kpis.regionsAdministrees > 1 ? 's' : ''} administrée${kpis.regionsAdministrees > 1 ? 's' : ''}`,
    },
  ]

  /** Pagination compacte : 1 … 4 5 6 … 12 */
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

  return (
    <div className="pb-8">
      {/* En-tête */}
      <section className="mx-6 mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="ic flex-none text-[44px] text-navy-900">group</span>
          <div className="min-w-0">
            <h1 className="text-[clamp(24px,2.8vw,32px)] font-extrabold leading-[1.1] tracking-[-0.026em] text-navy-900">Utilisateurs</h1>
            <p className="mt-1 text-[13.5px] leading-relaxed text-info-600">Gestion des comptes et des accès à la plateforme SafeRoad.</p>
          </div>
        </div>
        <div className="ml-auto flex flex-col items-end gap-1.5">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <label className="flex min-w-[230px] cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-white px-3.5 py-3 shadow-card">
              <span className="ic text-[22px] text-navy-900">place</span>
              <span className="text-[12.5px] font-semibold text-ink">Région :</span>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
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
              onClick={() => setForm({ editId: null })}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-brand-600 px-5 py-3.5 text-[13px] font-bold text-white shadow-card transition-colors hover:bg-brand-700"
            >
              <span className="ic text-xl">add</span>
              Ajouter un utilisateur
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

      {/* Filtres */}
      <section className={`${card} mx-6 mt-4.5 flex flex-wrap items-end gap-3.5 p-4`}>
        <label className="relative min-w-[240px] flex-[2_1_280px]">
          <span className="ic pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xl text-faint">search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, prénom, email ou téléphone…"
            className="w-full rounded-[9px] border-[1.5px] border-line-field bg-field py-2.5 pl-10 pr-3 text-[12.5px] font-medium text-ink outline-none placeholder:text-faint focus:border-brand-600"
          />
        </label>
        <label className="block min-w-[150px] flex-[1_1_150px]">
          <span className="mb-1 block text-[11px] font-bold text-ink">Rôle</span>
          <select value={roleF} onChange={(e) => setRoleF(e.target.value as 'tous' | StaffRole)} className={selectCls}>
            <option value="tous">Tous les rôles</option>
            {ROLE_ORDER.map((r) => (
              <option key={r} value={r}>
                {ROLE_META[r].label}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-[150px] flex-[1_1_150px]">
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
          <span className="mb-1 block text-[11px] font-bold text-ink">Statut</span>
          <select value={statusF} onChange={(e) => setStatusF(e.target.value as 'tous' | UserStatus)} className={selectCls}>
            <option value="tous">Tous</option>
            <option value="actif">Actif</option>
            <option value="inactif">Inactif</option>
          </select>
        </label>
        <label className="block min-w-[140px] flex-[1_1_140px]">
          <span className="mb-1 block text-[11px] font-bold text-ink">Date de création</span>
          <select value={yearF} onChange={(e) => setYearF(e.target.value)} className={selectCls}>
            <option value="tous">Toutes les dates</option>
            {years.map((y) => (
              <option key={y} value={y}>
                Année {y}
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
          Réinitialiser les filtres
        </button>
      </section>

      {/* Liste */}
      <section className={`${card} mx-6 mt-4.5 p-5`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 text-[15px] font-extrabold text-ink">
            Liste des utilisateurs <span className="font-medium text-body">({fmt(filtered.length)})</span>
          </p>
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-full bg-info-50 px-3 py-1.5 text-[12px] font-bold text-info-600">
              {selected.size} sélectionné{selected.size > 1 ? 's' : ''}
              <span className="h-4 w-px bg-info-600/30" />
              <button type="button" onClick={() => bulkStatus('actif')} className="hover:underline">
                Activer
              </button>
              <button type="button" onClick={() => bulkStatus('inactif')} className="text-danger-600 hover:underline">
                Désactiver
              </button>
              <button type="button" onClick={() => setSelected(new Set())} className="text-body hover:underline">
                Annuler
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto rounded-lg border border-line-soft">
          <table className="w-full min-w-[900px] border-collapse text-left text-[12.5px]">
            <thead>
              <tr className="bg-page text-[11.5px] font-bold text-ink">
                <th className="w-12 py-3 pl-4">
                  <input
                    ref={headCheckRef}
                    type="checkbox"
                    checked={allOnPage}
                    onChange={() =>
                      setSelected((prev) => {
                        const next = new Set(prev)
                        if (allOnPage) pageRows.forEach((u) => next.delete(u.id))
                        else pageRows.forEach((u) => next.add(u.id))
                        return next
                      })
                    }
                    aria-label="Tout sélectionner sur cette page"
                    className="h-4 w-4 cursor-pointer accent-brand-600"
                  />
                </th>
                <th className="py-3 pr-3">Utilisateur</th>
                <th className="px-3 py-3">Rôle</th>
                <th className="px-3 py-3">Région</th>
                <th className="px-3 py-3">Statut</th>
                <th className="px-3 py-3">Date de création</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((u) => (
                <tr key={u.id} className={`border-t border-line-soft hover:bg-page/60 ${selected.has(u.id) ? 'bg-info-50/50' : ''}`}>
                  <td className="py-3 pl-4">
                    <input
                      type="checkbox"
                      checked={selected.has(u.id)}
                      onChange={() =>
                        setSelected((prev) => {
                          const next = new Set(prev)
                          if (next.has(u.id)) next.delete(u.id)
                          else next.add(u.id)
                          return next
                        })
                      }
                      aria-label={`Sélectionner ${fullName(u)}`}
                      className="h-4 w-4 cursor-pointer accent-brand-600"
                    />
                  </td>
                  <td className="py-3 pr-3">
                    <button type="button" onClick={() => setDetailId(u.id)} className="flex items-center gap-3 text-left">
                      <Avatar user={u} />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-bold text-ink">
                          {fullName(u)}
                        </span>
                        <span className="block text-[11.5px] font-medium text-info-600">{u.email}</span>
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-3 py-3 font-medium text-ink">{regionName(u.region)}</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums text-info-600">{formatDate(u.createdAt)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDetailId(u.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border-[1.5px] border-line px-3 py-1.5 text-[12px] font-bold text-info-600 transition-colors hover:bg-page"
                      >
                        <span className="ic text-lg">visibility</span>
                        Voir
                      </button>
                      <button
                        type="button"
                        data-row-menu
                        onClick={(e) => openMenu(e, u.id)}
                        aria-label={`Plus d'actions pour ${fullName(u)}`}
                        aria-haspopup="menu"
                        aria-expanded={menu?.id === u.id}
                        className="ic flex h-8 w-8 items-center justify-center rounded-lg text-xl text-body hover:bg-page"
                      >
                        more_vert
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <span className="ic text-4xl text-faint">person_search</span>
                    <p className="m-0 mt-2 text-[13px] font-bold text-ink">Aucun utilisateur ne correspond à ces critères.</p>
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
            Affichage de {firstShown} à {lastShown} sur {fmt(filtered.length)} utilisateur{filtered.length > 1 ? 's' : ''}
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

      {/* Menu d'actions d'une ligne */}
      {menu && menuUser && (
        <div
          data-row-menu
          role="menu"
          className="fixed z-[1500] w-56 rounded-xl border border-line bg-white py-1.5 shadow-xl"
          style={menu.up ? { bottom: window.innerHeight - menu.top + 40, right: menu.right } : { top: menu.top, right: menu.right }}
        >
          {[
            { icon: 'visibility', label: 'Voir le détail', run: () => setDetailId(menuUser.id), danger: false },
            { icon: 'edit', label: 'Modifier', run: () => setForm({ editId: menuUser.id }), danger: false },
            menuUser.status === 'actif'
              ? { icon: 'block', label: 'Désactiver le compte', run: () => setStatusFor(menuUser, 'inactif'), danger: true }
              : { icon: 'check_circle', label: 'Réactiver le compte', run: () => setStatusFor(menuUser, 'actif'), danger: false },
            { icon: 'lock_reset', label: 'Réinitialiser le mot de passe', run: () => resetPassword(menuUser), danger: false },
          ].map((item) => (
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

      {/* Volet de détail */}
      {detailUser && (
        <div className="fixed inset-0 z-[1800] bg-black/30" onMouseDown={() => setDetailId(null)}>
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={`Détail de ${fullName(detailUser)}`}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 flex h-full w-full max-w-[400px] flex-col bg-white shadow-xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-line-soft p-5">
              <div className="flex min-w-0 items-center gap-3.5">
                <Avatar user={detailUser} size={56} />
                <div className="min-w-0">
                  <p className="m-0 truncate text-[16px] font-extrabold text-ink">{fullName(detailUser)}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <RoleBadge role={detailUser.role} />
                    <StatusBadge status={detailUser.status} />
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setDetailId(null)} className="ic text-xl text-faint hover:text-ink" aria-label="Fermer">
                close
              </button>
            </div>

            <dl className="m-0 flex-1 overflow-y-auto p-5">
              {[
                { label: 'Email', value: detailUser.email },
                { label: 'Téléphone', value: detailUser.phone || '—' },
                { label: 'Région', value: regionName(detailUser.region) },
                { label: 'Compte créé le', value: formatDate(detailUser.createdAt) },
                { label: 'Dernière connexion', value: detailUser.lastLogin ? formatDate(detailUser.lastLogin) : 'Jamais connecté' },
              ].map((row) => (
                <div key={row.label} className="border-b border-line-soft py-3 last:border-0">
                  <dt className="text-[10.5px] font-bold uppercase tracking-wide text-faint">{row.label}</dt>
                  <dd className="m-0 mt-1 break-words text-[13px] font-semibold text-ink">{row.value}</dd>
                </div>
              ))}
            </dl>

            <div className="flex flex-wrap gap-2.5 border-t border-line-soft p-5">
              <button
                type="button"
                onClick={() => {
                  setDetailId(null)
                  setForm({ editId: detailUser.id })
                }}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2.5 text-[12.5px] font-bold text-white hover:bg-brand-700"
              >
                <span className="ic text-lg">edit</span>
                Modifier
              </button>
              <button
                type="button"
                onClick={() => resetPassword(detailUser)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-line px-3.5 py-2.5 text-[12.5px] font-bold text-ink hover:bg-page"
              >
                <span className="ic text-lg">lock_reset</span>
                Mot de passe
              </button>
              <button
                type="button"
                onClick={() => setStatusFor(detailUser, detailUser.status === 'actif' ? 'inactif' : 'actif')}
                className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg border-[1.5px] px-3.5 py-2.5 text-[12.5px] font-bold ${
                  detailUser.status === 'actif' ? 'border-danger-200 text-danger-600 hover:bg-danger-50' : 'border-line text-success-600 hover:bg-success-50'
                }`}
              >
                <span className="ic text-lg">{detailUser.status === 'actif' ? 'block' : 'check_circle'}</span>
                {detailUser.status === 'actif' ? 'Désactiver le compte' : 'Réactiver le compte'}
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Formulaire création / modification */}
      {form && <UserForm initial={editUser} users={users} onSubmit={submitForm} onClose={() => setForm(null)} />}

      {/* Confirmation */}
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
                className="rounded-lg bg-danger-600 px-4 py-2 text-[12.5px] font-bold text-white hover:bg-danger-700"
              >
                {confirm.cta}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Retour d'action */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-[3000] max-w-sm rounded-xl bg-navy-900 px-4 py-3 text-[12.5px] font-semibold text-white shadow-xl"
        >
          {toast}
        </div>
      )}
    </div>
  )
}
