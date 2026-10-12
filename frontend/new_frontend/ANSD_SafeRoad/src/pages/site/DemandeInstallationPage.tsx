import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import heroRoadUrl from '@/assets/images/hero-road.png'
import { ApiError, envoyerDemandeInstallation, type DemandeInstallation, type TypeVehicule } from '@/lib/api'
import { REGIONS } from '@/lib/regions'
import { PATHS } from '@/routes/paths'

const TYPES_VEHICULE: { valeur: TypeVehicule; label: string }[] = [
  { valeur: 'voiture', label: 'Voiture particulière' },
  { valeur: 'taxi', label: 'Taxi' },
  { valeur: 'bus', label: 'Bus / car' },
  { valeur: 'camion', label: 'Camion' },
  { valeur: 'moto', label: 'Moto' },
  { valeur: 'autre', label: 'Autre' },
]

const ETAPES: [string, string, string][] = [
  ['edit_note', 'Votre demande', 'Vous remplissez ce formulaire, sans créer de compte.'],
  ['call', 'Prise de contact', 'Un conseiller de votre région vous appelle.'],
  ['event', 'Rendez-vous', 'Vous recevez la date et le lieu de l’installation.'],
  ['directions_car', 'Installation', 'Le boîtier est posé et votre compte conducteur activé par email.'],
]

const CHAMP =
  'w-full rounded-[11px] border-[1.5px] border-line-field bg-field px-3.5 py-3 text-sm font-medium text-ink outline-none focus:border-brand-600'

const VIDE: DemandeInstallation = {
  prenom: '',
  nom: '',
  telephone: '',
  email: '',
  region: '',
  commune: '',
  adresse: '',
  type_vehicule: 'voiture',
  immatriculation: '',
  nombre_vehicules: 1,
  disponibilites: '',
  message: '',
  contact_urgence_nom: '',
  contact_urgence_telephone: '',
  consentement_donnees: false,
}

function Champ({ label, aide, children }: { label: string; aide?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-ink">{label}</span>
      {children}
      {aide && <span className="mt-1 block text-[11px] text-faint">{aide}</span>}
    </label>
  )
}

/**
 * Demande d'installation d'un boîtier — seule porte d'entrée publique pour devenir conducteur
 * SafeRoad (pas d'inscription libre). Aucune pièce d'identité n'est demandée en ligne : elle
 * est vérifiée sur place le jour de l'installation.
 */
export function DemandeInstallationPage() {
  const [demande, setDemande] = useState<DemandeInstallation>(VIDE)
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [envoyee, setEnvoyee] = useState(false)

  function modifier<K extends keyof DemandeInstallation>(champ: K, valeur: DemandeInstallation[K]) {
    setDemande((d) => ({ ...d, [champ]: valeur }))
    if (erreur) setErreur('')
  }

  async function envoyer(e: FormEvent) {
    e.preventDefault()
    if (!demande.consentement_donnees) {
      setErreur('Votre accord est nécessaire pour que nous puissions vous recontacter.')
      return
    }
    setEnvoi(true)
    try {
      await envoyerDemandeInstallation({ ...demande, email: demande.email.trim() })
      setEnvoyee(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Envoi impossible pour le moment.')
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <div className="bg-white pb-20">
      <section className="relative overflow-hidden bg-navy-900 text-white">
        <img src={heroRoadUrl} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'linear-gradient(100deg, rgba(8,40,58,.95) 0%, rgba(8,40,58,.5) 100%)' }}
        />
        <div className="container-site relative py-16 sm:py-20">
          <span className="inline-flex items-center rounded-full bg-white/15 px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white">
            Équiper mon véhicule
          </span>
          <h1 className="text-hero mt-5 text-white">
            Demander un <span className="text-brand-400">boîtier SafeRoad</span>
          </h1>
          <p className="mt-3 max-w-lg text-[15px] leading-[1.7] text-white/80">
            Laissez vos coordonnées : un conseiller de votre région vous recontacte pour fixer le rendez-vous
            d’installation.
          </p>
        </div>
      </section>

      <div className="container-site mt-10">
        <ol className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
          {ETAPES.map(([icone, titre, texte], i) => (
            <li key={titre} className="rounded-[16px] border border-line bg-white p-4 shadow-card">
              <span className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-brand-50 text-brand-600">
                <span className="ic text-xl">{icone}</span>
              </span>
              <p className="m-0 mt-3 text-sm font-extrabold text-ink">
                {i + 1}. {titre}
              </p>
              <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-body">{texte}</p>
            </li>
          ))}
        </ol>

        <div className="mx-auto mt-10 max-w-3xl rounded-[20px] border border-line bg-white p-6 shadow-card sm:p-8">
          {envoyee ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <span className="ic text-3xl">check_circle</span>
              </span>
              <p className="m-0 text-lg font-extrabold text-ink">Demande envoyée, merci {demande.prenom} !</p>
              <p className="m-0 max-w-md text-sm leading-relaxed text-body">
                Un conseiller de la région de {REGIONS.find((r) => r.slug === demande.region)?.label} vous contactera
                au {demande.telephone} pour fixer le rendez-vous.
                {demande.email && ' Un accusé de réception vient de vous être envoyé par email.'}
              </p>
              <Link to={PATHS.home} className="mt-2 text-sm font-bold text-brand-600 hover:text-brand-700">
                Retour à l’accueil
              </Link>
            </div>
          ) : (
            <form onSubmit={envoyer} className="flex flex-col gap-6">
              <fieldset className="flex flex-col gap-4">
                <legend className="mb-3 text-base font-extrabold text-ink">Vos coordonnées</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Champ label="Prénom *">
                    <input required value={demande.prenom} onChange={(e) => modifier('prenom', e.target.value)} autoComplete="given-name" className={CHAMP} />
                  </Champ>
                  <Champ label="Nom *">
                    <input required value={demande.nom} onChange={(e) => modifier('nom', e.target.value)} autoComplete="family-name" className={CHAMP} />
                  </Champ>
                  <Champ label="Téléphone *">
                    <input required type="tel" placeholder="+221 77 123 45 67" value={demande.telephone} onChange={(e) => modifier('telephone', e.target.value)} autoComplete="tel" className={CHAMP} />
                  </Champ>
                  <Champ label="Email" aide="Recommandé : votre compte conducteur sera activé par email.">
                    <input type="email" value={demande.email} onChange={(e) => modifier('email', e.target.value)} autoComplete="email" className={CHAMP} />
                  </Champ>
                  <Champ label="Région *">
                    <select required value={demande.region} onChange={(e) => modifier('region', e.target.value)} className={CHAMP}>
                      <option value="" disabled>
                        Choisissez votre région
                      </option>
                      {REGIONS.map((r) => (
                        <option key={r.slug} value={r.slug}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </Champ>
                  <Champ label="Commune / quartier *">
                    <input required value={demande.commune} onChange={(e) => modifier('commune', e.target.value)} className={CHAMP} />
                  </Champ>
                </div>
                <Champ label="Adresse">
                  <input value={demande.adresse} onChange={(e) => modifier('adresse', e.target.value)} autoComplete="street-address" className={CHAMP} />
                </Champ>
              </fieldset>

              <fieldset className="flex flex-col gap-4">
                <legend className="mb-3 text-base font-extrabold text-ink">Votre véhicule</legend>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Champ label="Type *">
                    <select value={demande.type_vehicule} onChange={(e) => modifier('type_vehicule', e.target.value as TypeVehicule)} className={CHAMP}>
                      {TYPES_VEHICULE.map((t) => (
                        <option key={t.valeur} value={t.valeur}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </Champ>
                  <Champ label="Immatriculation">
                    <input placeholder="DK-1234-AB" value={demande.immatriculation} onChange={(e) => modifier('immatriculation', e.target.value)} className={CHAMP} />
                  </Champ>
                  <Champ label="Nombre de véhicules" aide="Pour une flotte (taxis, bus…).">
                    <input type="number" min={1} max={500} value={demande.nombre_vehicules} onChange={(e) => modifier('nombre_vehicules', Math.max(1, Number(e.target.value) || 1))} className={CHAMP} />
                  </Champ>
                </div>
                <Champ label="Vos disponibilités pour l’installation">
                  <input placeholder="Ex. : en semaine après 17 h, le samedi matin" value={demande.disponibilites} onChange={(e) => modifier('disponibilites', e.target.value)} className={CHAMP} />
                </Champ>
              </fieldset>

              <fieldset className="flex flex-col gap-4">
                <legend className="mb-1 text-base font-extrabold text-ink">Contact d’urgence (facultatif)</legend>
                <p className="m-0 text-[12.5px] leading-relaxed text-body">
                  SafeRoad sert à prévenir les accidents. Si l’un survient malgré tout, le boîtier prévient
                  directement cette personne par SMS, avec la position du véhicule.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Champ label="Nom du proche">
                    <input value={demande.contact_urgence_nom} onChange={(e) => modifier('contact_urgence_nom', e.target.value)} className={CHAMP} />
                  </Champ>
                  <Champ label="Téléphone du proche">
                    <input type="tel" placeholder="+221 77 765 43 21" value={demande.contact_urgence_telephone} onChange={(e) => modifier('contact_urgence_telephone', e.target.value)} className={CHAMP} />
                  </Champ>
                </div>
              </fieldset>

              <Champ label="Message">
                <textarea rows={3} value={demande.message} onChange={(e) => modifier('message', e.target.value)} className={`${CHAMP} resize-none`} />
              </Champ>

              <label className="flex items-start gap-2.5 text-xs font-semibold leading-relaxed text-body">
                <input
                  type="checkbox"
                  checked={demande.consentement_donnees}
                  onChange={(e) => modifier('consentement_donnees', e.target.checked)}
                  className="mt-0.5 h-4 w-4 flex-none rounded border-line-field accent-brand-600"
                />
                J’accepte que SafeRoad Sénégal utilise ces informations pour me recontacter au sujet de l’installation.
                Aucune pièce d’identité n’est demandée en ligne : elle sera vérifiée le jour de l’installation.
              </label>

              {erreur && (
                <div className="flex items-center gap-2 rounded-[10px] border border-danger-200 bg-danger-50 px-3.5 py-3 text-xs font-semibold text-danger-700">
                  <span className="ic text-base">error</span>
                  {erreur}
                </div>
              )}

              <button
                type="submit"
                disabled={envoi}
                className="flex items-center justify-center gap-2 self-start rounded-full bg-brand-600 px-6 py-3.5 text-sm font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-700 disabled:cursor-wait disabled:opacity-70"
              >
                <span className="ic text-base">send</span>
                {envoi ? 'Envoi…' : 'Envoyer ma demande'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
