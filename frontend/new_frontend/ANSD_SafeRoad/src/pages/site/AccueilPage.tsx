import { Link } from 'react-router-dom'
import heroRoadUrl from '@/assets/images/hero-road.png'
import newsAccidentUrl from '@/assets/images/news-accident-dakar.png'
import newsBoitiersUrl from '@/assets/images/news-boitiers-iot.png'
import newsModeleIaUrl from '@/assets/images/news-modele-ia.png'
import { DemoPanel } from '@/components/site/DemoPanel'
import { SafeRoadMap } from '@/components/site/SafeRoadMap'
import { Reveal } from '@/components/site/Reveal'
import { useCountUp } from '@/hooks/useCountUp'
import { useInView } from '@/hooks/useInView'
import { useNarrowGrid } from '@/hooks/useNarrowGrid'
import { PATHS } from '@/routes/paths'

const KPIS: { value: number; decimals?: number; suffix?: string; label: string; period: string }[] = [
  { value: 128, label: 'Incidents détectés', period: 'sur les 12 derniers mois' },
  { value: 42, label: 'Boîtiers actifs', period: 'en service actuellement' },
  { value: 67, label: 'Zones identifiées', period: 'sur le territoire national' },
  { value: 99.4, decimals: 1, suffix: '%', label: 'Disponibilité', period: 'plateforme, 12 derniers mois' },
]

const FEATURES: [string, string, string][] = [
  ['hub', 'Collecte IoT', 'Des boîtiers embarqués mesurent les conditions de conduite et les situations autour du véhicule..'],
  ['auto_awesome', 'Validation des situations à risque', "Les données issues des différents capteurs sont croisées afin de vérifier qu’une situation détectée présente réellement un risque."],
  ['map', 'Carte interactive', 'Localise les zones à risque et leur niveau, à jour dès qu\u2019une validation est faite.'],
  ['notifications_active', 'Alertes temps réel', 'Lorsqu\u2019une situation dangereuse est confirmée, le conducteur est averti directement à bord du véhicule.'],
]

const PARTNERS = ['ANASER', 'Ministère des Transports', 'Sénégal Numérique', 'Orange Digital Center']

const NEWS: { image: string; category: string; date: string; title: string; excerpt: string }[] = [
  {
    image: newsAccidentUrl,
    category: 'Zones à risque',
    date: '10 septembre 2026',
    title: "Comprendre les zones à risque de l'agglomération dakaroise",
    excerpt: "Comment la plateforme identifie une récurrence d'incidents avant qu'elle ne soit validée par un administrateur.",
  },
  {
    image: newsBoitiersUrl,
    category: 'IoT',
    date: '2 septembre 2026',
    title: 'Comment fonctionnent nos boîtiers embarqués',
    excerpt: 'Le rôle des boîtiers IoT dans la remontée des données de conduite et de route en temps réel.',
  },
  {
    image: newsModeleIaUrl,
    category: 'Intelligence artificielle',
    date: '25 août 2026',
    title: "Comment SafeRoad valide une situation à risque",
    excerpt: "L'analyse identifie les récurrences ; la validation d'une zone reste une décision humaine, réservée à l'ANASER.",
  },
]

function KpiStat({ value, decimals = 0, suffix = '', label, period }: (typeof KPIS)[number]) {
  const [ref, inView] = useInView<HTMLDivElement>(0.4)
  const count = useCountUp(value, inView, decimals)

  return (
    <div ref={ref} className="rounded-[16px] border border-line bg-white p-6 shadow-card">
      <p className="text-kpi-value m-0 text-ink">
        {count.toFixed(decimals)}
        {suffix}
      </p>
      <p className="mt-2 text-sm font-bold text-ink">{label}</p>
      <p className="text-label-secondary m-0 mt-1">{period}</p>
    </div>
  )
}

export function AccueilPage() {
  const [kpiRef, kpiNarrow] = useNarrowGrid<HTMLDivElement>(640)

  return (
    <div>
      {/* 1. Hero — photo hero-road.png assombrie, deux colonnes */}
      <section className="relative overflow-hidden bg-navy-900 text-white">
        <img
          src={heroRoadUrl}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
        {/*
         * Voile en dégradé diagonal à 100° : 95% d'opacité à gauche (texte
         * lisible sur navy quasi opaque) → 34% à droite (la route reste
         * visible derrière les cartes flottantes). Un voile uniforme aurait
         * forcé à choisir entre lisibilité et photo ; le dégradé donne les deux.
         */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'linear-gradient(100deg, rgba(8,40,58,.95) 0%, rgba(8,40,58,.34) 100%)',
          }}
        />

        {/*
         * Deux colonnes sans requête média : repeat(auto-fit,minmax(340px,1fr)).
         * Chaque colonne réclame 340px minimum puis partage l'espace à égalité ;
         * dès que ça ne tient plus, elles s'empilent automatiquement.
         */}
        <div className="container-site relative grid items-center gap-[52px] py-20 sm:py-24 [grid-template-columns:repeat(auto-fit,minmax(340px,1fr))]">
          {/*
           * Colonne de texte en pointer-events:none — les cartes flottantes de
           * la carte pourrait déborder sur cette zone ; sans ça, un clic
           * près du bord pourrait tomber dans le vide plutôt que d'atteindre
           * la carte. Seul le bloc des boutons repasse en pointer-events:auto.
           */}
          <div className="pointer-events-none">
            <span className="text-kicker text-brand-400">SYSTÈME EMBARQUÉ · IoT · GPS · Radar Doppler</span>
            <h1 className="text-hero mt-5 text-white">
              SafeRoad <span className="text-brand-400">Sénégal</span>
            </h1>
            <p className="text-section-title mt-2 max-w-xl text-white">
            La technologie au service de la sécurité routière.
            </p>
            <p className="mt-5 max-w-lg text-[15px] leading-[1.7] text-white/[.78]">
              SafeRoad est un système intelligent qui surveille les situations de conduite en temps réel 
              à l'aide de boîtiers embarqués. Il détecte et analyse les situations potentiellement dangereuses,
               alerte le
               conducteur et exploite les données collectées pour identifier les risques routiers 
               récurrents et contribuer à leur prévention.
            </p>

            <div className="pointer-events-auto mt-8 flex flex-wrap gap-3">
              <Link
                to={PATHS.inscription}
                className="flex items-center gap-2 rounded-full bg-brand-600 px-[30px] py-[17px] text-sm font-bold text-white shadow-[0_14px_28px_rgba(14,158,122,.35)] transition-all duration-200 hover:-translate-y-[2px] hover:bg-brand-700"
              >
                Commencer maintenant
                <span className="ic text-lg">arrow_forward</span>
              </Link>
              <Link
                to={PATHS.aPropos}
                className="flex items-center gap-2 rounded-full border-[1.5px] border-white/40 px-[30px] py-[17px] text-sm font-semibold text-white transition-colors hover:bg-white/[.12]"
              >
                En savoir plus
              </Link>
            </div>
          </div>

          <SafeRoadMap variant="compact" />
        </div>
      </section>

      {/* 2. Quatre KPI */}
      <section className="bg-white py-20">
        <div className="container-site">
          <div
            ref={kpiRef}
            className={`grid gap-5 ${kpiNarrow ? 'grid-cols-1' : 'grid-cols-4'}`}
          >
            {KPIS.map((kpi, i) => (
              <Reveal key={kpi.label} delay={i * 80}>
                <KpiStat {...kpi} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Fonctionnalités */}
      <section className="bg-field py-20">
        <div className="container-site">
          <Reveal>
            <span className="text-kicker text-brand-600">Comment ça marche</span>
            <h2 className="text-section-title mt-2 max-w-xl text-ink">De la détection à la prévention</h2>
          </Reveal>

          <div className="mt-10 grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(248px,1fr))]">
            {FEATURES.map(([icon, title, description], i) => (
              <Reveal key={title} delay={i * 80}>
                <div className="group h-full rounded-[16px] border border-line bg-white p-6 shadow-card transition-all duration-[260ms] hover:-translate-y-1 hover:shadow-card-hover">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50">
                    <span className="ic text-2xl text-brand-600">{icon}</span>
                  </span>
                  <h3 className="text-card-title mt-4 text-ink">{title}</h3>
                  <p className="mt-2 text-sm leading-[1.7] text-body">{description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Démonstration + mission */}
      <section className="bg-white py-20">
        <div className="container-site grid items-center gap-14 lg:grid-cols-2">
          <Reveal>
            <DemoPanel />
          </Reveal>

          <Reveal delay={100}>
            <div
              className="rounded-[20px] p-8 sm:p-10"
              style={{ background: 'linear-gradient(160deg, #e7f5f0 0%, #ffffff 100%)' }}
            >
              <span className="text-kicker text-brand-600">Notre mission</span>
              <h2 className="text-section-title mt-2 text-ink">Prévenir le risque avant qu'il ne devienne un accident</h2>
              <p className="mt-4 text-[15px] leading-[1.7] text-body">
                SafeRoad surveille les situations de conduite en temps réel, détecte et valide les situations potentiellement dangereuses
                et alerte le conducteur lorsque cela est nécessaire. Les données collectées permettent ensuite d'identifier les risques
                routiers récurrents et de contribuer aux actions de prévention.
              </p>
              <ul className="mt-6 flex flex-col gap-3">
                {[
                  ['straighten', 'Surveiller les conditions de conduite en temps réel'],
                  ['search', 'Détecter et valider les situations potentiellement dangereuses'],
                  ['shield', 'Prévenir le conducteur et contribuer à l’identification des zones à risque'],
                ].map(([icon, label]) => (
                  <li key={label} className="flex items-center gap-3 text-sm font-semibold text-ink">
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-white shadow-card">
                      <span className="ic text-lg text-brand-600">{icon}</span>
                    </span>
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 5. Ils nous font confiance */}
      <section className="bg-field py-16">
        <div className="container-site">
          <Reveal>
            <p className="text-label-secondary m-0 text-center uppercase tracking-wide">Un système pensé pour les acteurs de la sécurité routière</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 border-y border-line py-6">
              {PARTNERS.map((name) => (
                <span key={name} className="text-sm font-extrabold tracking-tight text-faint">
                  {name}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* 6. Actualités */}
      <section className="bg-white py-20">
        <div className="container-site">
          <Reveal>
            <span className="text-kicker text-brand-600">Actualités</span>
            <h2 className="text-section-title mt-2 max-w-xl text-ink">Ce qui se passe sur la plateforme</h2>
          </Reveal>

          <div className="mt-10 grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
            {NEWS.map((article, i) => (
              <Reveal key={article.title} delay={i * 80}>
                <Link
                  to={PATHS.actualites}
                  className="group flex h-full flex-col overflow-hidden rounded-[16px] border border-line bg-white shadow-card transition-all duration-[260ms] hover:-translate-y-1 hover:shadow-card-hover"
                >
                  <img src={article.image} alt="" aria-hidden="true" className="aspect-video w-full object-cover" />
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-wide text-brand-600">
                      {article.category}
                      <span className="text-label-secondary font-normal normal-case tracking-normal">
                        · {article.date}
                      </span>
                    </div>
                    <h3 className="text-card-title mt-3 text-ink">{article.title}</h3>
                    <p className="mt-2 flex-1 text-sm leading-[1.65] text-body">{article.excerpt}</p>
                    <span className="mt-4 flex items-center gap-1.5 text-sm font-bold text-brand-600">
                      Lire l'article
                      <span className="ic text-base">arrow_forward</span>
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Appel final */}
      <section className="bg-navy-900 py-20 text-white">
        <div className="container-site flex flex-col items-center gap-6 text-center">
          <h2 className="text-section-title max-w-xl text-white">Prêt à rouler plus sereinement ?</h2>
          <p className="max-w-md text-[15px] leading-[1.7] text-white/[.78]">
            Créez un compte pour recevoir des alertes en temps réel sur les zones à risque autour de vous.
          </p>
          <Link
            to={PATHS.inscription}
            className="flex items-center gap-2 whitespace-nowrap rounded-[11px] bg-brand-600 px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-brand-700"
          >
            Créer un compte
            <span className="ic text-lg">arrow_forward</span>
          </Link>
        </div>
      </section>
    </div>
  )
}
