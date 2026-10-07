import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import loginVisualUrl from '@/assets/images/login-visual.png'
import logoUrl from '@/assets/images/saferoad-logo.png'
import { normalizeRole, useAuth } from '@/context/AuthContext'
import { ApiError, login as loginRequest, loginConducteur as loginConducteurRequest } from '@/lib/api'
import { decodeJwt } from '@/lib/jwt'
import { PATHS } from '@/routes/paths'
import { roleHome } from '@/routes/ProtectedRoute'
import type { UserRole } from '@/types/auth'

const ROLES: { key: UserRole; label: string }[] = [
  { key: 'conducteur', label: 'Conducteur' },
  { key: 'sous_admin', label: 'Admin Régional' },
  { key: 'super_admin', label: 'Super Admin' },
  { key: 'anaser', label: 'ANASER' },
]

const FEATURES: [string, string][] = [
  ['place', 'Détection des zones à risque'],
  ['auto_awesome', 'Analyse par intelligence artificielle'],
  ['hub', 'Objets connectés (IoT)'],
  ['shield', 'Alertes en temps réel'],
]

/**
 * Génère un JWT non signé, uniquement pour explorer l'app en local avant
 * que le backend soit branché. Éliminé automatiquement des builds de
 * production par Vite (bloc `import.meta.env.DEV`) — ne touche jamais à
 * la vraie authentification.
 */
function fakeDevToken(role: UserRole): string {
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const header = b64url({ alg: 'none', typ: 'JWT' })
  const payload = b64url({
    sub: `dev-${role}`,
    email: `${role}@saferoad.sn`,
    first_name: 'Compte',
    last_name: 'Démo',
    role,
    region: role === 'conducteur' ? 'Dakar' : role === 'sous_admin' ? 'Dakar' : undefined,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8,
  })
  return `${header}.${payload}.dev`
}

export function ConnexionPage() {
  const [role, setRole] = useState<UserRole>('conducteur')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname

  const redirectAfterLogin = (token: string) => {
    const payload = decodeJwt(token)
    // Même normalisation que AuthContext.userFromToken() (le backend renvoie
    // role="admin" pour l'Admin Régional) — sinon roleHome() reçoit la valeur
    // brute, ne la reconnaît pas, et renvoie vers /connexion : on donne
    // l'impression que la connexion ne fait rien.
    const dest = from ?? (payload ? roleHome(normalizeRole(payload.role)) : PATHS.home)
    navigate(dest, { replace: true })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) {
      setError('Merci de renseigner votre email et votre mot de passe.')
      return
    }
    setLoading(true)
    try {
      // Conducteur vit dans un modèle Django séparé d'Administrateur (sous_admin /
      // super_admin / anaser) : deux endpoints de connexion distincts côté backend,
      // voir lib/api.ts (login vs loginConducteur).
      const { access } =
        role === 'conducteur'
          ? await loginConducteurRequest(email.trim(), password)
          : await loginRequest(email.trim(), password)
      login(access)
      redirectAfterLogin(access)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Connexion impossible pour le moment.')
    } finally {
      setLoading(false)
    }
  }

  const handleDevLogin = (r: UserRole) => {
    const token = fakeDevToken(r)
    login(token)
    redirectAfterLogin(token)
  }

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      {/* Bouton de retour — coin supérieur droit, visible sur mobile comme sur desktop (au-dessus des deux colonnes). */}
      <Link
        to={PATHS.home}
        className="absolute right-6 top-6 z-20 flex items-center gap-1.5 text-sm font-bold text-brand-600 transition-colors hover:text-brand-700"
      >
        <span className="ic text-lg">arrow_back</span>
        Retour à l'accueil
      </Link>

      <div className="relative hidden flex-col justify-between overflow-hidden bg-navy-950 p-10 text-white lg:flex">
        <img
          src={loginVisualUrl}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(6,35,52,.88) 0%, rgba(6,35,52,.55) 45%, rgba(6,35,52,.92) 100%), radial-gradient(720px 480px at 15% 15%, rgba(37,199,154,.22), transparent 60%), radial-gradient(600px 500px at 90% 85%, rgba(43,108,176,.22), transparent 60%)',
          }}
        />

        {/* Visuel navy : pastille blanche arrondie (13px, retrait 9px/13px), logo à 40px */}
        <Link to={PATHS.home} className="relative flex flex-none items-center">
          <span className="inline-flex items-center rounded-[13px] bg-white px-[13px] py-[9px]">
            <img src={logoUrl} alt="SafeRoad Sénégal" className="block h-[40px] w-auto" />
          </span>
        </Link>

        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold tracking-wide">
            Économie · Sécurité · Mobilité
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight">
            La technologie au service de votre sécurité <span className="text-brand-400">sur la route.</span>
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/70">
            SafeRoad est une plateforme intelligente utilisant l'IA et l'IoT pour détecter, analyser et signaler les
            zones à risque en temps réel.
          </p>
          <ul className="mt-7 flex flex-col gap-3.5 text-sm font-semibold">
            {FEATURES.map(([icon, label]) => (
              <li key={label} className="flex items-center gap-3">
                <span className="ic text-lg text-brand-400">{icon}</span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs font-medium text-white/50">
          SafeRoad Sénégal — des routes plus sûres, une vie plus précieuse.
        </p>
      </div>

      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          {/* Fond blanc : logo posé directement, sans habillage. 52px : il devient l'élément d'accueil */}
          <Link to={PATHS.home} className="mb-8 flex flex-none items-center lg:hidden">
            <img src={logoUrl} alt="SafeRoad Sénégal" className="block h-[52px] w-auto" />
          </Link>

          <h2 className="text-2xl font-extrabold tracking-tight text-ink">Bienvenue !</h2>
          <p className="mt-2 text-sm text-body">Connectez-vous à votre espace.</p>

          <div className="mt-6 grid grid-cols-4 gap-2">
            {ROLES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRole(r.key)}
                className={`rounded-xl border-[1.5px] px-2 py-3 text-center text-xs font-bold transition-colors ${
                  role === r.key ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-line text-body hover:border-line-field'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <label className="block">
              <span className="mb-2 block text-xs font-bold text-body">EMAIL OU NUMÉRO DE TÉLÉPHONE</span>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                className="w-full rounded-[11px] border-[1.5px] border-line-field bg-field px-3.5 py-3 text-sm font-medium text-ink outline-none focus:border-brand-600"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-bold text-body">MOT DE PASSE</span>
              <div className="flex items-center rounded-[11px] border-[1.5px] border-line-field bg-field px-3.5">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="min-w-0 flex-1 bg-transparent py-3 text-sm font-medium text-ink outline-none"
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
            </label>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 font-semibold text-body">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-line-field accent-brand-600"
                />
                Se souvenir de moi
              </label>
              <a href="#" className="font-bold text-brand-600 hover:text-brand-700">
                Mot de passe oublié ?
              </a>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-[10px] border border-danger-200 bg-danger-50 px-3.5 py-3 text-xs font-semibold text-danger-700">
                <span className="ic text-base">error</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex min-h-[46px] items-center justify-center gap-2 rounded-[11px] bg-brand-600 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? (
                'Connexion…'
              ) : (
                <>
                  <span className="ic text-lg">arrow_forward</span>
                  Se connecter
                </>
              )}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs font-semibold text-faint">
            <span className="h-px flex-1 bg-line" />
            Ou
            <span className="h-px flex-1 bg-line" />
          </div>

          <button
            type="button"
            className="flex w-full items-center justify-center gap-2.5 rounded-[11px] border-[1.5px] border-line py-3 text-sm font-bold text-ink hover:bg-page"
          >
            Se connecter avec Google
          </button>

          <p className="mt-7 text-center text-sm text-body">
            Vous n'avez pas de compte ?{' '}
            <Link to={PATHS.inscription} className="font-bold text-brand-600 hover:text-brand-700">
              Inscription
            </Link>
          </p>

          {import.meta.env.DEV && (
            <div className="mt-8 rounded-[12px] border border-dashed border-line-field bg-page p-4">
              <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-faint">
                Accès rapide — développement uniquement
              </p>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => handleDevLogin(r.key)}
                    className="rounded-lg border border-line-field bg-white px-3 py-2 text-xs font-semibold text-ink hover:bg-page"
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
