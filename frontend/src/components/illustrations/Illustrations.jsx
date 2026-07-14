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

/* ---------------------------------------------------------------------------
   Boîtier embarqué — l'électronique qui « écoute » le véhicule.
   Pensée pour un fond clair (traits encre).
--------------------------------------------------------------------------- */
export function IllustrationBoitier({ className = '', anime = true }) {
  return (
    <svg
      className={className}
      viewBox="0 0 440 380"
      role="img"
      aria-label="Boîtier de détection embarqué et ses capteurs"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ondes de détection */}
      <g fill="none" stroke="var(--danger-critique)" strokeWidth="2.5" strokeLinecap="round" opacity="0.5">
        <path d="M330 120 A 70 70 0 0 1 330 260">
          {anime && <animate attributeName="opacity" values="0.15;0.6;0.15" dur="2.4s" repeatCount="indefinite" />}
        </path>
        <path d="M356 96 A 104 104 0 0 1 356 284">
          {anime && <animate attributeName="opacity" values="0.1;0.45;0.1" dur="2.4s" begin="0.4s" repeatCount="indefinite" />}
        </path>
        <path d="M382 74 A 136 136 0 0 1 382 306">
          {anime && <animate attributeName="opacity" values="0.05;0.3;0.05" dur="2.4s" begin="0.8s" repeatCount="indefinite" />}
        </path>
      </g>

      {/* corps du boîtier */}
      <rect x="70" y="96" width="210" height="188" rx="18" fill="var(--surface)" stroke="var(--ink)" strokeWidth="3" />
      <rect x="70" y="96" width="210" height="46" rx="18" fill="var(--ink)" />
      <rect x="70" y="120" width="210" height="22" fill="var(--ink)" />
      <circle cx="98" cy="119" r="6" fill="var(--hivis)" />
      <circle cx="120" cy="119" r="6" fill="rgba(255,255,255,0.35)" />

      {/* puce centrale */}
      <rect x="128" y="176" width="94" height="76" rx="8" fill="var(--paper)" stroke="var(--ink)" strokeWidth="2.5" />
      <rect x="150" y="196" width="50" height="36" rx="4" fill="var(--ink)" />
      <g stroke="var(--ink)" strokeWidth="3" strokeLinecap="round">
        <path d="M128 190 H112 M128 214 H112 M128 238 H112" />
        <path d="M222 190 H238 M222 214 H238 M222 238 H238" />
      </g>

      {/* antenne / GPS */}
      <g stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M245 96 V64" />
      </g>
      <circle cx="245" cy="58" r="8" fill="var(--hivis)" stroke="var(--ink)" strokeWidth="2.5" />

      {/* étiquettes capteurs */}
      <g fontFamily="'IBM Plex Mono', monospace" fontSize="13" fill="var(--ink-soft)">
        <circle cx="60" cy="180" r="5" fill="var(--danger-moyen)" />
        <text x="18" y="160" textAnchor="start">GPS</text>
        <circle cx="60" cy="248" r="5" fill="var(--danger-faible)" />
        <text x="18" y="300" textAnchor="start">RADAR</text>
      </g>
      <text x="175" y="330" textAnchor="middle" fontFamily="'IBM Plex Mono', monospace" fontSize="14" fontWeight="700" fill="var(--ink)">ESP32</text>
    </svg>
  )
}

/* ---------------------------------------------------------------------------
   Route en perspective avec un point noir signalé.
   Pensée pour un fond clair (traits encre).
--------------------------------------------------------------------------- */
export function IllustrationRoute({ className = '', anime = true }) {
  return (
    <svg
      className={className}
      viewBox="0 0 460 380"
      role="img"
      aria-label="Route en perspective avec une zone accidentogène signalée"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id="clipRoute">
          <path d="M210 40 L250 40 L410 360 L50 360 Z" />
        </clipPath>
      </defs>

      {/* ciel / arrière-plan */}
      <rect x="0" y="0" width="460" height="380" rx="20" fill="var(--paper)" />
      {/* collines */}
      <path d="M0 210 Q 120 150 230 200 T 460 195 V380 H0 Z" fill="rgba(11,30,61,0.05)" />

      {/* chaussée */}
      <path d="M210 40 L250 40 L410 360 L50 360 Z" fill="var(--ink)" />
      <g clipPath="url(#clipRoute)">
        {/* marquage central */}
        <g stroke="var(--hivis)" strokeWidth="6" strokeLinecap="round" strokeDasharray="26 30">
          <path d="M230 40 V360" />
        </g>
        {/* bords */}
        <g stroke="rgba(255,255,255,0.5)" strokeWidth="3">
          <path d="M212 40 L52 360" />
          <path d="M248 40 L408 360" />
        </g>
        {/* zone de danger sur la chaussée */}
        <ellipse cx="230" cy="250" rx="120" ry="46" fill="var(--danger-critique)" fillOpacity="0.35">
          {anime && <animate attributeName="fill-opacity" values="0.2;0.45;0.2" dur="2.6s" repeatCount="indefinite" />}
        </ellipse>
      </g>

      {/* panneau d'avertissement */}
      <g transform="translate(360 150)">
        <line x1="0" y1="0" x2="0" y2="70" stroke="var(--ink-soft)" strokeWidth="5" strokeLinecap="round" />
        <path d="M0 -46 L34 12 L-34 12 Z" fill="var(--hivis)" stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round" />
        <line x1="0" y1="-26" x2="0" y2="-4" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />
        <circle cx="0" cy="4" r="2.6" fill="var(--ink)" />
      </g>
    </svg>
  )
}
