const STATUSES: { color: string; label: string }[] = [
  { color: 'bg-danger-600', label: 'Validée' },
  { color: 'bg-warning-600', label: 'En observation' },
  { color: 'bg-success-600', label: 'Normale' },
]

/**
 * Mise en scène décorative du hero — fiche technique §2 bloc 1 : trois plans
 * superposés (aperçu de carte, carte d'alerte, pastille) avec flottement
 * désynchronisé et halo pulsé sur le marqueur d'alerte.
 *
 * Le contour de la « carte » est une forme abstraite, pas la géométrie
 * réelle du Sénégal — le vrai composant cartographique (§3 de la fiche,
 * <saferoad-map>) est un chantier à part, construit sur la page Carte.
 */
export function HeroShowcase() {
  return (
    <div className="relative mx-auto aspect-[4/3.4] w-full max-w-md">
      {/* Plan 1 (z-2) — aperçu de carte, à l'arrière-plan */}
      <div className="absolute inset-0 z-[2] overflow-hidden rounded-[20px] bg-white p-5 shadow-card">
        <svg viewBox="0 0 200 170" className="h-full w-full" aria-hidden="true">
          <path
            d="M40 18 C70 6 120 10 148 30 C172 46 168 78 150 96 C160 112 150 136 122 142 C96 148 68 138 52 116 C28 118 12 96 18 72 C10 54 20 30 40 18 Z"
            fill="#e7f5f0"
            stroke="#25c79a"
            strokeWidth="1.5"
          />
          <circle cx="72" cy="58" r="17" fill="#dc3a2f" fillOpacity="0.16" />
          <circle cx="120" cy="92" r="13" fill="#e8940c" fillOpacity="0.16" />
          <circle cx="94" cy="118" r="10" fill="#1f9d55" fillOpacity="0.16" />
        </svg>

        {/* Halo pulsé — uniquement sur le marqueur d'alerte, fiche §2/§4 */}
        <span className="absolute left-[36%] top-[34%] h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full bg-danger-600/30 animate-ring" />
        <span className="absolute left-[36%] top-[34%] flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-danger-600 text-white shadow-card">
          <span className="ic text-[15px]">place</span>
        </span>
        <span className="absolute left-[60%] top-[54%] h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-warning-600" />
        <span className="absolute left-[47%] top-[70%] h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-success-600" />

        <div className="absolute bottom-4 left-4 flex flex-col gap-1.5 rounded-xl bg-white/90 p-2.5 shadow-card backdrop-blur">
          {STATUSES.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5 text-[10.5px] font-semibold text-body">
              <span className={`h-2 w-2 rounded-full ${s.color}`} />
              {s.label}
            </div>
          ))}
        </div>
      </div>

      {/* Plan 2 (z-3) — carte d'alerte flottante, 6s */}
      <div className="absolute -right-3 top-6 z-[3] w-52 animate-float-a rounded-[16px] bg-white p-4 shadow-card-hover">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-danger-50 text-danger-600">
            <span className="ic text-lg">place</span>
          </span>
          <div className="min-w-0">
            <p className="text-card-title m-0 truncate text-ink">Zone validée</p>
            <p className="text-label-secondary m-0">Route de Rufisque</p>
          </div>
        </div>
        <p className="mt-2.5 text-[13px] leading-[1.65] text-body">
          Récurrence confirmée par un administrateur régional.
        </p>
      </div>

      {/* Plan 3 (z-4) — pastille flottante, 7.5s désynchronisée */}
      <div className="absolute -right-3 bottom-10 z-[4] flex animate-float-b items-center gap-2 rounded-full bg-white px-3.5 py-2 shadow-card-hover">
        <span className="ic text-base text-brand-600">sensors</span>
        <span className="text-[12.5px] font-bold text-ink">Boîtier actif</span>
      </div>
    </div>
  )
}
