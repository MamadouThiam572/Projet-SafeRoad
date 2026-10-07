import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import loginVisualUrl from '@/assets/images/login-visual.png'
import logoUrl from '@/assets/images/saferoad-logo.png'
import { PATHS } from '@/routes/paths'
import type { UserRole } from '@/types/auth'

const PROFILES: { key: UserRole; label: string }[] = [
  { key: 'conducteur', label: 'Conducteur / Client' },
  { key: 'sous_admin', label: 'Admin Régional (ANASER / Forces de l’ordre)' },
  { key: 'super_admin', label: 'Super Admin' },
]

const ARGUMENTS: { icon: string; title: string; text: string }[] = [
  {
    icon: 'notifications_active',
    title: 'Alertes en temps réel',
    text: 'Recevez une notification dès qu’une zone à risque approche sur votre trajet.',
  },
  {
    icon: 'map',
    title: 'Carte des zones à risque',
    text: 'Visualisez les zones dangereuses recensées près de chez vous et sur vos trajets habituels.',
  },
  {
    icon: 'flag',
    title: 'Signalement en un geste',
    text: 'Signalez un accident, un radar ou un danger et aidez la communauté à rouler plus sûr.',
  },
  {
    icon: 'shield',
    title: 'Protection de vos données',
    text: 'Vos informations restent confidentielles et ne sont utilisées que pour améliorer votre sécurité.',
  },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/

function passwordStrength(pwd: string): { score: number; filled: number; label: string; color: string } {
  const checks = [pwd.length >= 8, /[A-Z]/.test(pwd), /[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)]
  const score = checks.filter(Boolean).length
  if (score <= 1) return { score, filled: 1, label: 'Faible', color: '#dc3a2f' }
  if (score === 2) return { score, filled: 2, label: 'Moyen', color: '#e8940c' }
  return { score, filled: 3, label: 'Solide', color: '#1f9d55' }
}

export function InscriptionPage() {
  const gridRef = useRef<HTMLDivElement>(null)
  const [stacked, setStacked] = useState(false)

  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? el.offsetWidth
      setStacked(width < 980)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const [profile, setProfile] = useState<UserRole>('conducteur')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const strength = useMemo(() => passwordStrength(password), [password])

  function clearFeedback() {
    if (error) setError('')
    if (success) setSuccess('')
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) {
      setSuccess('')
      setError('Merci d’indiquer votre prénom et votre nom.')
      return
    }
    if (!EMAIL_RE.test(email.trim())) {
      setSuccess('')
      setError('L’adresse email saisie n’est pas valide.')
      return
    }
    if (phone.replace(/\D/g, '').length < 9) {
      setSuccess('')
      setError('Le numéro de téléphone semble incomplet.')
      return
    }
    if (password.length < 8) {
      setSuccess('')
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (!acceptTerms) {
      setSuccess('')
      setError('Vous devez accepter les conditions d’utilisation.')
      return
    }
    setError('')
    const label = PROFILES.find((p) => p.key === profile)?.label ?? profile
    setSuccess(`Compte ${label} enregistré localement — la connexion à l’authentification réelle reste à brancher.`)
  }

  return (
    <div
      ref={gridRef}
      data-grid="auth"
      className={`relative min-h-screen ${stacked ? 'flex flex-col' : 'grid grid-cols-2'}`}
    >
      {/* Volet gauche — persuasion */}
      <div className="relative flex min-h-[340px] flex-col justify-between overflow-hidden bg-navy-950 p-10 text-white">
        <img
          src={loginVisualUrl}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[65%_30%]"
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(105deg, rgba(6,35,52,.96) 0%, rgba(6,35,52,.90) 30%, rgba(6,35,52,.45) 60%, rgba(6,35,52,.30) 100%), linear-gradient(180deg, transparent 66%, rgba(6,35,52,.97) 100%)',
          }}
        />

        <Link to={PATHS.home} className="relative flex flex-none items-center">
          <span className="inline-flex items-center rounded-[14px] bg-white px-[14px] py-[9px]">
            <img src={logoUrl} alt="SafeRoad Sénégal" className="block h-[40px] w-auto" />
          </span>
        </Link>

        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold tracking-wide">
            Sécurité · Prévention · Communauté
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight">
            Rejoignez la communauté qui roule <span className="text-brand-400">plus en sécurité.</span>
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/70">
            Créez votre compte pour recevoir des alertes en temps réel, consulter la carte des zones à risque et
            signaler les dangers sur votre trajet.
          </p>

          <ul className="mt-7 flex flex-col gap-4">
            {ARGUMENTS.map((a) => (
              <li key={a.title} className="flex items-start gap-3">
                <span
                  className="flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-full"
                  style={{ backgroundColor: 'rgba(14,158,122,.16)', border: '1px solid rgba(14,158,122,.30)' }}
                >
                  <span className="ic text-lg text-brand-400">{a.icon}</span>
                </span>
                <div>
                  <p className="text-sm font-bold">{a.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/65">{a.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs font-medium text-white/50">
          SafeRoad Sénégal — des routes plus sûres, une vie plus précieuse.
        </p>
      </div>

      {/* Volet droit — saisie */}
      <div className="relative flex flex-col justify-center overflow-hidden px-6 py-12 sm:px-12 lg:px-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-[340px] w-[340px] rounded-full bg-brand-50"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -left-20 h-[300px] w-[300px] rounded-full bg-brand-50"
        />

        <Link
          to={PATHS.home}
          className="absolute right-6 top-6 z-10 flex items-center gap-1.5 text-sm font-bold text-brand-600 transition-colors hover:text-brand-700"
        >
          <span className="ic text-lg">arrow_back</span>
          Retour à l’accueil
        </Link>

        <div className="relative z-10 mx-auto w-full max-w-[470px]">
          <Link to={PATHS.home} className="mb-8 flex flex-none items-center">
            <img src={logoUrl} alt="SafeRoad Sénégal" className="block h-[40px] w-auto" />
          </Link>

          <h2 className="text-2xl font-extrabold tracking-tight text-ink">Créer un compte</h2>
          <p className="mt-2 text-sm text-body">Rejoignez SafeRoad Sénégal en quelques instants.</p>

          <div className="mt-6 grid grid-cols-3 gap-2">
            {PROFILES.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  setProfile(p.key)
                  clearFeedback()
                }}
                className={`rounded-xl border-[1.5px] px-2 py-3 text-center text-[11px] font-bold leading-tight transition-colors ${
                  profile === p.key
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-line text-body hover:border-line-field'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 max-[420px]:grid-cols-1">
              <label className="block">
                <span className="mb-2 block text-xs font-bold text-body">PRÉNOM</span>
                <div className="flex h-[52px] items-center gap-2 rounded-[14px] border-[1.5px] border-line-field bg-[#F6FAFB] px-3.5">
                  <span className="ic flex-none text-lg text-icon-muted">badge</span>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value)
                      clearFeedback()
                    }}
                    autoComplete="given-name"
                    className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold text-body">NOM</span>
                <div className="flex h-[52px] items-center rounded-[14px] border-[1.5px] border-line-field bg-[#F6FAFB] px-3.5">
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value)
                      clearFeedback()
                    }}
                    autoComplete="family-name"
                    className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none"
                  />
                </div>
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-xs font-bold text-body">ADRESSE EMAIL</span>
              <div className="flex h-[52px] items-center gap-2 rounded-[14px] border-[1.5px] border-line-field bg-[#F6FAFB] px-3.5">
                <span className="ic flex-none text-lg text-icon-muted">mail</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    clearFeedback()
                  }}
                  autoComplete="email"
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-bold text-body">TÉLÉPHONE</span>
              <div className="flex h-[52px] items-center gap-2 rounded-[14px] border-[1.5px] border-line-field bg-[#F6FAFB] px-3.5">
                <span className="ic flex-none text-lg text-icon-muted">call</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value)
                    clearFeedback()
                  }}
                  placeholder="+221 XX XXX XX XX"
                  autoComplete="tel"
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none placeholder:text-faint"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-bold text-body">MOT DE PASSE</span>
              <div className="flex h-[52px] items-center gap-2 rounded-[14px] border-[1.5px] border-line-field bg-[#F6FAFB] px-3.5">
                <span className="ic flex-none text-lg text-icon-muted">lock</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    clearFeedback()
                  }}
                  autoComplete="new-password"
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="ic flex-none text-lg text-muted"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? 'visibility_off' : 'visibility'}
                </button>
              </div>

              {password.length > 0 && (
                <div className="mt-2.5">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 flex-1 rounded-full bg-line"
                        style={i < strength.filled ? { backgroundColor: strength.color } : undefined}
                      />
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs font-semibold" style={{ color: strength.color }}>
                    {strength.label}
                  </p>
                </div>
              )}
            </label>

            <label className="flex items-start gap-2.5 text-xs font-semibold leading-relaxed text-body">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => {
                  setAcceptTerms(e.target.checked)
                  clearFeedback()
                }}
                className="mt-0.5 h-4 w-4 flex-none rounded border-line-field accent-brand-600"
              />
              J’accepte les conditions d’utilisation et la politique de confidentialité de SafeRoad Sénégal.
            </label>

            {error && (
              <div className="flex items-center gap-2 rounded-[10px] border border-danger-200 bg-danger-50 px-3.5 py-3 text-xs font-semibold text-danger-700">
                <span className="ic text-base">error</span>
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 rounded-[10px] border border-success-600 bg-success-50 px-3.5 py-3 text-xs font-semibold text-brand-700">
                <span className="ic text-base">check_circle</span>
                {success}
              </div>
            )}

            <button
              type="submit"
              className="flex items-center justify-center gap-2 rounded-full bg-brand-600 py-[19px] text-sm font-bold text-white transition-all hover:-translate-y-px hover:bg-brand-700"
              style={{ boxShadow: '0 10px 26px rgba(14,158,122,.26)' }}
            >
              <span className="ic text-lg">person_add</span>
              Créer mon compte
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs font-semibold text-faint">
            <span className="h-px flex-1 bg-line" />
            Ou
            <span className="h-px flex-1 bg-line" />
          </div>

          <button
            type="button"
            className="flex w-full items-center justify-center gap-2.5 rounded-full border-[1.5px] border-line bg-white py-3 text-sm font-bold text-ink hover:bg-page"
          >
            S’inscrire avec Google
          </button>

          <p className="mt-7 text-center text-sm text-body">
            Vous avez déjà un compte ?{' '}
            <Link to={PATHS.connexion} className="font-bold text-brand-600 hover:text-brand-700">
              Connexion
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
