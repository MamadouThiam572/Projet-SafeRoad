import fatouHeleneDiattaUrl from '@/assets/images/fatou-helene-diatta.png'
import mamadouThiamUrl from '@/assets/images/mamadou-thiam.png'

const HIGHLIGHTS = [
  { icon: 'shield', title: 'Sécurité', text: 'Protection des routes et des usagers.' },
  { icon: 'map', title: 'Prévention', text: 'Cartographie des zones à risque.' },
  { icon: 'hub', title: 'IoT', text: 'Données collectées en temps réel.' },
  { icon: 'smart_toy', title: 'IA', text: 'Analyse intelligente et prédictive.' },
]

const TECHS = [
  { icon: 'sensors', title: 'Capteurs', text: 'Collecte de données sur la route et le trafic.' },
  { icon: 'analytics', title: 'Analyse', text: 'Modélisation IA pour la détection des risques.' },
  { icon: 'notifications_active', title: 'Alertes', text: 'Prévention et signalement dans les zones sensibles.' },
  { icon: 'groups', title: 'Partenaires', text: 'Coordination avec les autorités et acteurs locaux.' },
]

export function AProposPage() {
  return (
    <div className="bg-[#eef3f4]">
      <div className="mx-auto max-w-[1220px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="min-h-[calc(100vh-180px)] rounded-[22px] border border-line bg-white p-4 shadow-card sm:p-5 lg:p-6">
          <main className="flex min-h-full flex-col gap-6">
            <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[20px] border border-dashed border-line bg-[#f9fbfc] p-5 sm:p-6">
                <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-700">
                  <span className="ic text-base">verified</span>
                  À propos
                </span>

                <h1 className="mt-5 max-w-xl text-4xl font-extrabold leading-[1.05] tracking-[-0.05em] text-ink sm:text-[2.9rem]">
                  SafeRoad, au service d’une mobilité plus sûre.
                </h1>

                <p className="mt-4 max-w-lg text-[15px] leading-7 text-body">
                  SafeRoad est une plateforme intelligente pensée pour renforcer la sécurité routière au Sénégal. Grâce à
                  la combinaison du GPS, des capteurs IoT, de l’analyse IA et de la cartographie, nous aidons à détecter,
                  comprendre et prévenir les zones à risque avant qu’elles ne deviennent critiques.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  {['Sécurité routière', 'Mobilité durable', 'Analyse intelligente'].map((item) => (
                    <span key={item} className="rounded-full border border-line bg-white px-3 py-2 text-xs font-bold text-body">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-[20px] bg-gradient-to-br from-[#0a2b3d] via-[#0a5867] to-[#0F766E] p-4 text-white shadow-[0_20px_38px_rgba(10,43,61,0.18)] sm:p-5">
                <div className="rounded-[18px] border border-white/15 bg-white/6 p-4 backdrop-blur-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/75">Plateforme</p>
                      <p className="mt-1 text-xl font-extrabold">Vue d’ensemble</p>
                    </div>
                    <span className="rounded-full bg-white/10 p-2">
                      <span className="ic text-xl">network_check</span>
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {['Trafic routier', 'Risque', 'Zone à risque', 'Prédiction'].map((value) => (
                      <div key={value} className="rounded-[14px] border border-white/10 bg-white/5 px-3 py-2.5 text-center text-sm font-semibold text-white/90">
                        {value}
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 rounded-[16px] bg-white/7 p-3.5">
                    <div className="mb-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.12em] text-white/75">
                      <span>Performance</span>
                      <span className="rounded-full bg-white/10 px-2 py-1">+22%</span>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="mb-1 flex items-center justify-between text-[12px] font-semibold text-white/80">
                          <span>Surveillance</span>
                          <span>86%</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/15">
                          <div className="h-2 w-[86%] rounded-full bg-white" />
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between text-[12px] font-semibold text-white/80">
                          <span>Précision</span>
                          <span>92%</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/15">
                          <div className="h-2 w-[92%] rounded-full bg-white" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {HIGHLIGHTS.map((item) => (
                <div key={item.title} className="rounded-[18px] border border-line bg-white p-5 shadow-card">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <span className="ic text-2xl">{item.icon}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-extrabold text-ink">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-body">{item.text}</p>
                </div>
              ))}
            </section>

            <section className="rounded-[24px] bg-[#0b2e3d] p-5 text-white sm:p-7">
              <div className="grid items-center gap-6 lg:grid-cols-[0.95fr_1.05fr]">
                <div>
                  <span className="text-kicker text-brand-400">Technologies</span>
                  <h2 className="mt-3 max-w-md text-3xl font-extrabold leading-tight tracking-[-0.04em] text-white">
                    Des outils conçus pour anticiper les risques et sécuriser les déplacements.
                  </h2>
                  <p className="mt-4 max-w-md text-[15px] leading-7 text-white/75">
                    Nous combinons capteurs, données routières, signalements et intelligence artificielle pour mieux
                    comprendre la mobilité urbaine et régionale et agir plus vite sur les zones vulnérables.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {TECHS.map((tech) => (
                    <div key={tech.title} className="rounded-[18px] border border-white/10 bg-white/5 p-4">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/8">
                        <span className="ic text-2xl text-brand-400">{tech.icon}</span>
                      </span>
                      <p className="mt-4 text-lg font-extrabold text-white">{tech.title}</p>
                      <p className="mt-2 text-sm leading-6 text-white/70">{tech.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-[24px] border border-line bg-white p-5 shadow-card sm:p-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <span className="text-kicker text-brand-600">Équipier</span>
                  <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-ink">
                    Des équipiers engagés pour la sécurité routière
                  </h2>
                  <p className="mt-2 text-sm font-medium text-body">Spécialités complémentaires</p>
                </div>
              </div>

              <div className="mt-7 grid gap-5 lg:grid-cols-2">
                <div className="overflow-hidden rounded-[20px] border border-line bg-field">
                  <div className="flex flex-col sm:flex-row">
                    <div className="sm:w-[42%]">
                      <img src={mamadouThiamUrl} alt="Mamadou Thiam" className="h-full w-full object-cover" />
                    </div>
                    <div className="flex flex-1 flex-col justify-between p-5">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-600">Équipier</p>
                        <h3 className="mt-2 text-2xl font-extrabold text-ink">Mamadou Thiam</h3>
                        <p className="mt-2 text-sm leading-6 text-body">
                          Sécurité routière, gestion de projet numérique et coordination de solutions terrain.
                        </p>
                      </div>
                      <a
                        href="https://www.linkedin.com/in/mamadou-thiam-a80b35219/"
                        target="_blank"
                        rel="noreferrer"
                        className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-brand-600 hover:text-brand-700"
                      >
                        LinkedIn
                        <span className="ic text-base">arrow_forward</span>
                      </a>
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-[20px] border border-line bg-field">
                  <div className="flex flex-col sm:flex-row">
                    <div className="sm:w-[42%]">
                      <img src={fatouHeleneDiattaUrl} alt="Fatou Hélène Diatta" className="h-full w-full object-cover" />
                    </div>
                    <div className="flex flex-1 flex-col justify-between p-5">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-600">Équipière</p>
                        <h3 className="mt-2 text-2xl font-extrabold text-ink">Fatou Hélène Diatta</h3>
                        <p className="mt-2 text-sm leading-6 text-body">
                          Analyse de données, support de terrain et appui à la mise en œuvre des initiatives de sécurité.
                        </p>
                      </div>
                      <a
                        href="https://www.linkedin.com/in/fatou-h%C3%A9l%C3%A8ne-diatta-702a212a3/"
                        target="_blank"
                        rel="noreferrer"
                        className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-brand-600 hover:text-brand-700"
                      >
                        LinkedIn
                        <span className="ic text-base">arrow_forward</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}
