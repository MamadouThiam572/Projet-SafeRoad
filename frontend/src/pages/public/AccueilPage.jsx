import { Link } from 'react-router-dom'
import { Icone } from '../../components/communs/Icone'
import {
  IllustrationBoitier,
  IllustrationCarte,
  IllustrationRoute,
} from '../../components/illustrations/Illustrations'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

const ETAPES = [
  {
    n: '1',
    etiquette: 'À BORD',
    titre: 'Détection embarquée',
    texte:
      "Le boîtier ESP32 — accéléromètre, radar et GPS — repère chocs, freinages brusques et collisions en temps réel, au moment même où ils se produisent.",
  },
  {
    n: '2',
    etiquette: 'EN ROUTE',
    titre: 'Transmission sécurisée',
    texte:
      "Les données remontent au serveur, ou patientent sur carte SD hors couverture réseau, puis se synchronisent automatiquement dès le retour du signal.",
  },
  {
    n: '3',
    etiquette: 'SUR LA CARTE',
    titre: 'Zones à risque révélées',
    texte:
      "Les incidents récurrents forment des zones accidentogènes, validées par un administrateur, puis publiées pour alerter conducteurs et autorités.",
  },
]

const CAPTEURS = [
  { fort: 'Accéléromètre', suite: '— détecte chocs et freinages brusques' },
  { fort: 'Radar', suite: "— mesure les distances et la vitesse relative" },
  { fort: 'GPS', suite: '— localise chaque événement au mètre près' },
  { fort: 'Carte SD', suite: '— aucune donnée perdue, même hors réseau' },
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
    texte: "LED, buzzer et signal audio préviennent le conducteur à l'approche d'un point noir, selon son niveau de danger.",
  },
  {
    icone: 'boitier',
    stripe: 'var(--danger-moyen)',
    titre: "Fonctionne hors-ligne",
    texte: "Aucune donnée perdue : le boîtier enregistre en local et rattrape la synchronisation dès qu'il retrouve le réseau.",
  },
  {
    icone: 'incidents',
    stripe: 'var(--ink)',
    titre: 'Trois niveaux de danger',
    texte: "Zones normales, sous vigilance ou critiques : une lecture claire et immédiate du risque, sans ambiguïté.",
  },
  {
    icone: 'utilisateur',
    stripe: 'var(--danger-faible)',
    titre: "Validé par l'humain",
    texte: "Chaque zone est confirmée par un administrateur avant publication : pas de fausse alerte, uniquement du fiable.",
  },
  {
    icone: 'tableau',
    stripe: 'var(--statut-neutre)',
    titre: 'Statistiques ouvertes',
    texte: "Données agrégées et anonymisées, accessibles à tous, pour comprendre et prévenir à l'échelle du territoire.",
  },
]

const IMPACT = [
  { chiffre: '< 1 s', desc: "Entre l'impact et sa détection à bord" },
  { chiffre: '3', desc: 'Canaux d’alerte : lumineux, sonore, vocal' },
  { chiffre: '100 %', desc: 'Des trajets couverts, même sans réseau' },
  { chiffre: '24/7', desc: 'Surveillance continue des zones à risque' },
]

export function AccueilPage() {
  const mouvementReduit = usePrefersReducedMotion()
  const anime = !mouvementReduit

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
              Derrière chaque point sur la carte, une route, un trajet, une vie. SafeRoad relie un boîtier
              embarqué de détection à une plateforme temps réel pour révéler les zones accidentogènes
              et protéger celles et ceux qui les traversent chaque jour.
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
              <span className="hero-chip"><Icone nom="boitier" taille={16} /> Boîtier ESP32</span>
              <span className="hero-chip"><Icone nom="zone" taille={16} /> Détection GPS temps réel</span>
              <span className="hero-chip"><Icone nom="cloche" taille={16} /> Alerte de proximité</span>
            </div>
          </div>

          <div className="hero-radar-col">
            <IllustrationCarte className="hero-illu" anime={anime} />
          </div>
        </div>
      </section>

      {/* ---------- POURQUOI (émotion) ---------- */}
      <section className="section-accueil pourquoi">
        <div className="row g-4 align-items-center">
          <div className="col-lg-5">
            <div className="section-eyebrow" style={{ color: 'var(--hivis)' }}>Notre raison d'être</div>
            <p className="lede">
              Un accident n'est presque jamais une surprise. C'est souvent <em>le même virage</em>, le
              <em> même croisement</em>, encore et encore.
            </p>
          </div>
          <div className="col-lg-7">
            <p className="texte">
              Sur nos routes, certains points concentrent les drames année après année. Le plus souvent,
              on ne les identifie qu'après coup. SafeRoad inverse la logique : en écoutant ce que vivent
              réellement les véhicules, la plateforme fait remonter ces zones{' '}
              <strong style={{ color: '#fff' }}>avant</strong> qu'un nouveau drame ne s'y ajoute — pour que
              la prévention devienne enfin concrète, mesurable et partagée par tous.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- SPLIT : le boîtier ---------- */}
      <section className="section-accueil split">
        <div className="split-texte">
          <div className="section-eyebrow">À bord</div>
          <h2 className="section-titre">Un capteur qui ne dort jamais</h2>
          <p className="section-intro">
            Discret sous le tableau de bord, le boîtier SafeRoad écoute en permanence le comportement du
            véhicule et transforme chaque secousse en information exploitable.
          </p>
          <ul className="split-liste">
            {CAPTEURS.map((c) => (
              <li key={c.fort}>
                <span className="coche"><Icone nom="coche" taille={15} /></span>
                <span><strong>{c.fort}</strong> {c.suite}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="split-illu">
          <IllustrationBoitier anime={anime} />
        </div>
      </section>

      {/* ---------- PARCOURS ---------- */}
      <section className="section-accueil">
        <div className="section-eyebrow">Comment ça marche</div>
        <h2 className="section-titre">Du choc détecté à la zone révélée</h2>
        <p className="section-intro mb-4">
          Trois étapes, du capteur embarqué jusqu'à la carte publique — une chaîne pensée pour ne rien
          perdre, même loin de tout réseau.
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

      {/* ---------- SPLIT : la carte ---------- */}
      <section className="section-accueil split inverse">
        <div className="split-texte">
          <div className="section-eyebrow">Sur la carte</div>
          <h2 className="section-titre">Le danger devient visible</h2>
          <p className="section-intro">
            Les incidents isolés ne disent rien ; regroupés, ils dessinent des points noirs. SafeRoad les
            classe en trois niveaux de danger et les publie sur une carte que chacun peut consulter, du
            conducteur à l'autorité de tutelle.
          </p>
          <div className="hero-actions" style={{ marginTop: 24 }}>
            <Link to="/carte" className="btn btn-primary">
              Explorer la carte <Icone nom="fleche" taille={16} />
            </Link>
          </div>
        </div>
        <div className="split-illu">
          <IllustrationRoute anime={anime} />
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

      {/* ---------- IMPACT ---------- */}
      <section className="section-accueil">
        <div className="section-eyebrow" style={{ color: 'var(--danger-critique)' }}>Ce que garantit la plateforme</div>
        <h2 className="section-titre mb-4">La technologie, au service de chaque trajet</h2>
        <div className="impact">
          {IMPACT.map((i) => (
            <div className="impact-item" key={i.desc}>
              <div className="chiffre">{i.chiffre}</div>
              <div className="desc">{i.desc}</div>
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
