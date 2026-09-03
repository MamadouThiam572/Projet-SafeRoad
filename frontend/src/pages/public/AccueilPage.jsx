import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icone } from '../../components/communs/Icone'
import { useMetaPage } from '../../hooks/useMetaPage'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { listerZones } from '../../services/zonesService'

const ETAPES = [
  {
    n: '1',
    etiquette: 'À BORD',
    titre: 'Détection embarquée',
    texte:
      "Le boîtier ESP32 — accéléromètre, radar et GPS — repère chocs, freinages brusques et collisions en temps réel.",
  },
  {
    n: '2',
    etiquette: 'EN ROUTE',
    titre: 'Transmission sécurisée',
    texte:
      "Les données remontent au serveur, ou patientent sur carte SD hors réseau, puis se synchronisent dès le retour du signal.",
  },
  {
    n: '3',
    etiquette: 'SUR LA CARTE',
    titre: 'Zones à risque révélées',
    texte:
      "Les incidents récurrents forment des zones accidentogènes, validées par un administrateur, puis publiées.",
  },
]

const BENEFICES = [
  {
    icone: 'zone',
    stripe: 'var(--danger-critique)',
    titre: 'Cartographie vivante',
    texte: "Chaque zone dangereuse apparaît sur une carte publique, mise à jour au fil des incidents détectés.",
  },
  {
    icone: 'cloche',
    stripe: 'var(--hivis)',
    titre: 'Alertes de proximité',
    texte: "LED, buzzer et signal audio préviennent le conducteur à l'approche d'un point noir.",
  },
  {
    icone: 'boitier',
    stripe: 'var(--danger-moyen)',
    titre: "Fonctionne hors-ligne",
    texte: "Aucune donnée perdue : le boîtier enregistre en local et rattrape la synchronisation.",
  },
  {
    icone: 'utilisateur',
    stripe: 'var(--danger-faible)',
    titre: "Validé par l'humain",
    texte: "Chaque zone est confirmée par un administrateur avant publication : pas de fausse alerte.",
  },
]

export function AccueilPage() {
  useMetaPage({
    titre: "Accueil",
    description:
      "SafeRoad détecte les accidents à la source et cartographie les zones accidentogènes du Sénégal en temps réel, grâce à un boîtier embarqué.",
    chemin: '/',
  })
  const mouvementReduit = usePrefersReducedMotion()
  const anime = !mouvementReduit
  const [nombreZones, setNombreZones] = useState(null)

  useEffect(() => {
    // Discret et non bloquant : un chiffre réel s'il arrive à temps, sinon la page reste
    // telle quelle — jamais de nombre inventé, jamais de spinner qui retarde le hero.
    listerZones().then((zones) => setNombreZones(zones.length)).catch(() => {})
  }, [])

  return (
    <div className="container py-5 accueil">
      {/* ---------- HERO ---------- */}
      <section className="hero-accueil">
        <div className="hero-grid">
          <div className="hero-texte">
            <span className="hero-eyebrow">
              <span className="pastille" />
              Prévention routière · Sénégal
            </span>
            <h1>
              Voir venir l'accident,<br />
              <span className="surligne">avant qu'il n'arrive.</span>
            </h1>
            <p className="accroche">
              SafeRoad combine un dispositif embarqué, la géolocalisation
               et l'analyse intelligente des données pour détecter les situations 
               à risque, identifier les zones accidentogènes et alerter les conducteurs
                avant qu'un accident ne survienne.
            </p>
            <div className="hero-actions">
              <Link to="/carte" className="btn btn-accent btn-lg">
                Voir la carte des zones à risque
              </Link>
              <Link to="/statistiques" className="btn btn-outline-light btn-lg">
                Statistiques publiques
              </Link>
            </div>
            <div className="hero-chips">
              {nombreZones !== null && (
                <span className="hero-chip">
                  <Icone nom="zone" taille={16} />
                  <strong className="font-mono">{nombreZones}</strong> zone{nombreZones > 1 ? 's' : ''} déjà cartographiée{nombreZones > 1 ? 's' : ''}
                </span>
              )}
              <span className="hero-chip"><Icone nom="boitier" taille={16} /> Boîtier ESP32</span>
              <span className="hero-chip"><Icone nom="cloche" taille={16} /> Alerte de proximité</span>
            </div>
          </div>

        </div>
      </section>

      {/* ---------- POURQUOI (émotion, brève) ---------- */}
      <section className="section-accueil pourquoi">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5">
            <div className="section-eyebrow" style={{ color: 'var(--hivis)' }}>Notre raison d'être</div>
            <p className="lede">
              Un accident n'est presque jamais une surprise. C'est souvent <em>le même virage</em>, le
              <em> même croisement</em>,<em>les mêmes comportements à risque</em> encore et encore.
            </p>
          </div>
          <div className="lg:col-span-7">
            <p className="texte">
              SafeRoad analyse ces signaux pour identifier les risques et alerter 
               <strong style={{ color: '#fff' }}>avant</strong> qu'un accident 
              ne survienne.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- COMMENT ÇA MARCHE ---------- */}
      <section className="section-accueil">
        <div className="section-eyebrow">Comment ça marche</div>
        <h2 className="section-titre">Du choc détecté à la zone révélée</h2>
        <p className="section-intro mb-4">
          Trois étapes, du capteur embarqué jusqu'à la carte publique.
        </p>
        <div className="flow">
          {ETAPES.map((etape) => (
            <div className="flow-etape" key={etape.n}>
              <span className="puce-num font-mono">{etape.n}</span>
              <div className="etiquette">{etape.etiquette}</div>
              <h3>{etape.titre}</h3>
              <p>{etape.texte}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- BÉNÉFICES ---------- */}
      <section className="section-accueil">
        <div className="section-eyebrow">Ce que SafeRoad apporte</div>
        <h2 className="section-titre">Une prévention outillée, de bout en bout</h2>
        <p className="section-intro mb-4">
          De la détection à bord jusqu'à la donnée ouverte, chaque brique sert un seul objectif : moins
          d'accidents, mieux anticipés.
        </p>
        <div className="benefices">
          {BENEFICES.map((b) => (
            <div className="benefice" key={b.titre} style={{ '--stripe': b.stripe }}>
              <span className="ico"><Icone nom={b.icone} taille={22} /></span>
              <h3>{b.titre}</h3>
              <p>{b.texte}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- CTA FINAL ---------- */}
      <section className="section-accueil cta-final">
        <h2>Prêt à voir le danger avant tout le monde ?</h2>
        <p>
          Découvrez les zones à risque déjà identifiées, ou plongez dans les statistiques ouvertes de la
          prévention routière au Sénégal.
        </p>
        <div className="cta-actions">
          <Link to="/carte" className="btn btn-primary btn-lg">
            Ouvrir la carte
          </Link>
          <Link to="/statistiques" className="btn btn-outline-primary btn-lg">
            Voir les statistiques
          </Link>
        </div>
      </section>
    </div>
  )
}
