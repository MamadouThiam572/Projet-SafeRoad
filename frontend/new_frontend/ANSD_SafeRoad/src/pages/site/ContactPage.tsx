import { useState, type ChangeEvent, type FormEvent } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import heroRoadUrl from '@/assets/images/hero-road.png'
import { Reveal } from '@/components/site/Reveal'

/** Siège SafeRoad — Avenue Bourguiba, Dakar (coordonnées approximatives du centre-ville). */
const OFFICE_POSITION: [number, number] = [14.6937, -17.4441]

const SUBJECTS = ['Question générale', 'Signalement', 'Suggestion', 'Partenariat', 'Support technique', 'Autre']

const SOCIALS = [
  { abbr: 'f', label: 'Facebook' },
  { abbr: 'X', label: 'X (Twitter)' },
  { abbr: 'in', label: 'LinkedIn' },
  { abbr: 'YT', label: 'YouTube' },
]

const MAX_MESSAGE = 1000

/** Marqueur unique — même logique que les zones de la carte (disque coloré, pas l'épingle Leaflet par défaut). */
function officeIcon() {
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:20px;height:20px;border-radius:9999px;background:#dc3a2f;border:3px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.35)"></span>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -12],
  })
}

function InfoCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: string
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[16px] border border-line bg-white p-5 shadow-card">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <span className="ic text-xl">{icon}</span>
      </span>
      <div>
        <p className="m-0 text-sm font-extrabold text-ink">{title}</p>
        <p className="m-0 mt-1 text-[12.5px] leading-[1.5] text-body">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

export function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setFileName(e.target.files?.[0]?.name ?? null)
  }

  /*
   * Aucune API de contact n'existe encore côté SafeRoad — ce formulaire
   * valide et affiche une confirmation locale, sans réel envoi. À brancher
   * sur un endpoint réel dès qu'il existera (voir message à Marie).
   */
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !subject || !message.trim()) return
    setSubmitted(true)
  }

  return (
    <div className="bg-white pb-20">
      {/* Bandeau photo — même traitement voile diagonal que le hero de l'Accueil, en plus bas. */}
      <section className="relative overflow-hidden bg-navy-900 text-white">
        <img src={heroRoadUrl} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'linear-gradient(100deg, rgba(8,40,58,.95) 0%, rgba(8,40,58,.5) 100%)' }}
        />

        <div className="container-site relative py-16 sm:py-20">
          <span className="inline-flex items-center rounded-full bg-white/15 px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white">
            Nous contacter
          </span>
          <h1 className="text-hero mt-5 text-white">
            Nous <span className="text-brand-400">contacter</span>
          </h1>
          <p className="mt-3 max-w-lg text-[15px] leading-[1.7] text-white/80">
            Une question, une suggestion ou un signalement ? Notre équipe est à votre écoute.
          </p>

          {/* Badges décoratifs — repris du vocabulaire visuel du hero de l'Accueil, masqués sous lg pour ne pas surcharger le bandeau réduit. */}
          <div className="pointer-events-none absolute right-10 top-10 hidden flex-col items-end gap-3 lg:flex">
            <div className="flex items-center gap-2 rounded-full bg-white/10 py-2 pl-2 pr-4 backdrop-blur-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600">
                <span className="ic text-base">location_on</span>
              </span>
              <span className="text-xs font-bold text-white">Plus de sécurité sur nos routes</span>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-600 shadow-[0_10px_24px_rgba(14,158,122,.4)]">
              <span className="ic text-xl">directions_car</span>
            </span>
          </div>
        </div>
      </section>

      <div className="container-site mt-10">
        {/* Cartes d'information — même grille auto-fit que la page Actualités, zéro requête média pour l'empilement. */}
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
          <InfoCard icon="call" title="Téléphone" subtitle="Du lundi au vendredi, 8h - 17h">
            <p className="m-0 text-sm font-extrabold text-ink">+221 33 123 45 67</p>
          </InfoCard>
          <InfoCard icon="mail" title="Email" subtitle="Nous répondons sous 24h">
            <p className="m-0 text-sm font-extrabold text-ink">contact@saferoad.sn</p>
          </InfoCard>
          <InfoCard icon="location_on" title="Adresse" subtitle="Dakar, Sénégal">
            <p className="m-0 text-sm font-extrabold text-ink">123, Avenue Bourguiba, Dakar, Sénégal</p>
          </InfoCard>
          <InfoCard icon="forum" title="Réseaux sociaux" subtitle="Suivez-nous pour rester informé">
            <div className="mt-1 flex gap-2">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-brand-50 text-xs font-bold text-brand-700 transition-colors hover:bg-brand-600 hover:text-white"
                >
                  {s.abbr}
                </a>
              ))}
            </div>
          </InfoCard>
        </div>

        {/* CTA boîtiers — carte à part, distincte du bandeau de clôture (fond navy plutôt que brand-50) pour ne pas se fondre avec lui plus bas. */}
        <Reveal className="mt-8 flex flex-wrap items-center gap-5 rounded-[18px] bg-navy-900 p-6 text-white sm:p-7">
          <span className="flex h-14 w-14 flex-none items-center justify-center rounded-xl bg-brand-600">
            <span className="ic text-2xl">hub</span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="m-0 text-base font-extrabold text-white">Vous voulez équiper votre véhicule ?</p>
            <p className="m-0 mt-1.5 max-w-xl text-[13.5px] leading-[1.6] text-white/75">
              Nos boîtiers embarqués collectent en continu les données de conduite et de route pour renforcer la
              sécurité sur nos routes. Contactez-nous pour connaître les modalités d'acquisition et d'installation.
            </p>
          </div>
          <a
            href="#contact-form"
            className="flex flex-none items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-700"
          >
            Demander un boîtier
            <span className="ic text-base">arrow_forward</span>
          </a>
        </Reveal>

        <div className="mt-8 grid gap-[26px] [grid-template-columns:repeat(auto-fit,minmax(340px,1fr))]">
          {/* Formulaire */}
          <Reveal id="contact-form" className="rounded-[20px] border border-line bg-white p-6 shadow-card sm:p-7">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <span className="ic text-xl">send</span>
              </span>
              <div>
                <p className="m-0 text-base font-extrabold text-ink">Envoyez-nous un message</p>
                <p className="m-0 mt-0.5 text-[12.5px] text-body">
                  Remplissez le formulaire ci-dessous et nous vous répondrons dans les plus brefs délais.
                </p>
              </div>
            </div>

            {submitted ? (
              <div className="mt-6 flex flex-col items-center gap-2 rounded-[14px] border border-dashed border-brand-200 bg-brand-50 py-10 text-center">
                <span className="ic text-[40px] leading-none text-brand-600">check_circle</span>
                <p className="m-0 text-sm font-extrabold text-ink">Message envoyé</p>
                <p className="max-w-xs text-[13px] leading-[1.5] text-body">
                  Merci {name.split(' ')[0]}, nous vous répondrons sous 24h à {email}.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
                <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-ink">Nom complet *</span>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Votre nom et prénom"
                      className="w-full rounded-[11px] border-[1.5px] border-line-field bg-field px-3.5 py-3 text-sm font-medium text-ink outline-none focus:border-brand-600"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-ink">Email *</span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="votre@email.com"
                      className="w-full rounded-[11px] border-[1.5px] border-line-field bg-field px-3.5 py-3 text-sm font-medium text-ink outline-none focus:border-brand-600"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-ink">Sujet *</span>
                  <select
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-[11px] border-[1.5px] border-line-field bg-field px-3.5 py-3 text-sm font-medium text-ink outline-none focus:border-brand-600"
                  >
                    <option value="" disabled>
                      Choisissez un sujet
                    </option>
                    {SUBJECTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-bold text-ink">Message *</span>
                    <span className="text-[11px] font-semibold text-faint">
                      {message.length}/{MAX_MESSAGE}
                    </span>
                  </div>
                  <textarea
                    required
                    rows={5}
                    maxLength={MAX_MESSAGE}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Écrivez votre message ici…"
                    className="w-full resize-none rounded-[11px] border-[1.5px] border-line-field bg-field px-3.5 py-3 text-sm font-medium text-ink outline-none focus:border-brand-600"
                  />
                </label>

                <div className="rounded-[11px] border border-dashed border-line-field bg-field px-3.5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="block text-xs font-bold text-ink">Joindre un fichier (optionnel)</span>
                      <span className="mt-0.5 block text-[11px] text-faint">
                        {fileName ?? 'Formats acceptés : PDF, JPG, PNG (max. 10 Mo)'}
                      </span>
                    </div>
                    <label className="flex-none cursor-pointer rounded-[9px] border border-line-field bg-white px-3 py-2 text-xs font-bold text-ink transition-colors hover:border-brand-600 hover:text-brand-600">
                      Choisir un fichier
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} className="hidden" />
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  className="mt-1 flex items-center justify-center gap-2 self-start rounded-full bg-brand-600 px-6 py-3 text-sm font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-card-hover"
                >
                  <span className="ic text-base">send</span>
                  Envoyer le message
                </button>
              </form>
            )}
          </Reveal>

          {/* Carte — un seul marqueur (le siège), pas les zones à risque : Leaflet est réutilisé, mais pas le composant SafeRoadMap qui est conçu pour celles-ci. */}
          <Reveal delay={80} className="flex flex-col overflow-hidden rounded-[20px] border border-line bg-white shadow-card">
            <div className="flex items-center gap-2 p-5 pb-0">
              <span className="ic text-lg text-brand-600">location_on</span>
              <p className="m-0 text-base font-extrabold text-ink">Notre localisation</p>
            </div>
            <div className="relative mt-4 h-[320px] w-full">
              <MapContainer center={OFFICE_POSITION} zoom={13} scrollWheelZoom={false} className="h-full w-full">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={OFFICE_POSITION} icon={officeIcon()}>
                  <Popup>
                    SafeRoad Sénégal
                    <br />
                    Dakar, Sénégal
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
          </Reveal>
        </div>

        {/* Bandeau de clôture — même teinte brand-50 que les cartes compteurs de la page Carte. */}
        <div className="mt-10 flex flex-wrap items-center gap-4 rounded-[18px] border border-brand-100 bg-brand-50 p-6">
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-brand-600 text-white">
            <span className="ic text-2xl">shield</span>
          </span>
          <div>
            <p className="m-0 text-[15px] font-extrabold text-ink">Ensemble pour des routes plus sûres</p>
            <p className="m-0 mt-1 text-[13px] leading-[1.5] text-body">
              Signalez un danger, partagez une information ou faites-nous part de vos idées. Votre avis compte !
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
