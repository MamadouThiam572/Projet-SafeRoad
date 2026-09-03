// Illustrations SVG sur-mesure pour la page d'accueil (auto-contenues, aux
// couleurs de la marque). Aucune dépendance ni image externe : tout est vectoriel,
// net à toutes les tailles et animé via SMIL (r/opacity) pour évoquer la détection.

/* ---------------------------------------------------------------------------
   Vue carte — réseau de routes vu du ciel avec zones de danger qui pulsent.
   Pensée pour le fond bleu nuit du hero (traits clairs).
--------------------------------------------------------------------------- */
export function IllustrationCarte({ className = '', anime = true }) {
  return (
    <svg
      className={className}
      viewBox="0 0 480 440"
      role="img"
      aria-label="Carte vue du ciel avec des zones accidentogènes qui pulsent"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id="cadreCarte">
          <rect x="20" y="20" width="440" height="400" rx="22" />
        </clipPath>
      </defs>

      {/* panneau carte */}
      <rect x="20" y="20" width="440" height="400" rx="22" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" />

      <g clipPath="url(#cadreCarte)">
        {/* pâtés / blocs de ville */}
        <g fill="rgba(255,255,255,0.05)">
          <rect x="48" y="52" width="96" height="70" rx="8" />
          <rect x="196" y="48" width="120" height="58" rx="8" />
          <rect x="352" y="60" width="86" height="90" rx="8" />
          <rect x="44" y="196" width="80" height="96" rx="8" />
          <rect x="300" y="210" width="140" height="80" rx="8" />
          <rect x="70" y="340" width="120" height="70" rx="8" />
          <rect x="264" y="336" width="120" height="80" rx="8" />
        </g>

        {/* réseau de routes */}
        <g fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="18" strokeLinecap="round">
          <path d="M170 0 V440" />
          <path d="M0 165 H480" />
          <path d="M0 315 H480" />
          <path d="M340 0 C 320 140, 400 220, 300 440" />
        </g>
        {/* marquage central haute-visibilité */}
        <g fill="none" stroke="var(--hivis)" strokeWidth="2.5" strokeDasharray="10 14" opacity="0.55">
          <path d="M170 0 V440" />
          <path d="M0 165 H480" />
          <path d="M0 315 H480" />
        </g>
      </g>

      {/* zones de danger (pulsations) */}
      <ZonePulse cx={170} cy={165} couleur="#b23a2e" anime={anime} />
      <ZonePulse cx={340} cy={315} couleur="#c98420" delai="1.1s" anime={anime} />
      <ZonePulse cx={300} cy={92} couleur="#2f9e5b" delai="2s" petit anime={anime} />

      {/* épingle sur la zone critique */}
      <g transform="translate(170 165)">
        <path d="M0 -34 C 16 -34 26 -22 26 -8 C 26 10 0 30 0 30 C 0 30 -26 10 -26 -8 C -26 -22 -16 -34 0 -34 Z"
          fill="var(--hivis)" stroke="#0b1e3d" strokeWidth="2" />
        <circle cx="0" cy="-8" r="9" fill="#0b1e3d" />
      </g>
    </svg>
  )
}

function ZonePulse({ cx, cy, couleur, delai = '0s', petit = false, anime = true }) {
  const base = petit ? 16 : 22
  const max = petit ? 40 : 56
  return (
    <g>
      <circle cx={cx} cy={cy} r={base} fill={couleur} fillOpacity="0.22" stroke={couleur} strokeWidth="2" />
      {anime && (
        <circle cx={cx} cy={cy} r={base} fill="none" stroke={couleur} strokeWidth="2">
          <animate attributeName="r" values={`${base};${max}`} dur="3s" begin={delai} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.7;0" dur="3s" begin={delai} repeatCount="indefinite" />
        </circle>
      )}
    </g>
  )
}
