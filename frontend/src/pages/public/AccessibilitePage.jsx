import { useMetaPage } from '../../hooks/useMetaPage'

export function AccessibilitePage() {
  useMetaPage({
    titre: 'Accessibilité',
    description: "État de conformité aux normes d'accessibilité de SafeRoad.",
    chemin: '/accessibilite',
  })

  return (
    <div className="container py-5" style={{ maxWidth: 820 }}>
      <h1 className="h3 mb-4">Déclaration d'accessibilité</h1>
      <div className="surface-card p-4 p-md-5" style={{ lineHeight: 1.7 }}>
        <p>
          SafeRoad s'efforce de rendre ses pages publiques utilisables par le plus grand nombre, y compris
          au clavier et avec un lecteur d'écran — une exigence particulière pour un service qui transmet une
          information de sécurité.
        </p>

        <h2 className="h5 mt-4 mb-2">État de conformité</h2>
        <p>
          <strong>Conformité partielle.</strong> Aucun audit formel RGAA/WCAG complet par un tiers n'a été
          réalisé à ce stade — l'évaluation ci-dessous est une auto-évaluation.
        </p>

        <h2 className="h5 mt-4 mb-2">Ce qui est en place</h2>
        <ul style={{ paddingLeft: '1.4em', listStyleType: 'disc' }}>
          <li>Contrastes de texte conformes WCAG AA (4,5:1) sur les indicateurs de niveau de danger</li>
          <li>La carte des zones à risque dispose d'un équivalent en liste, consultable au clavier et par lecteur d'écran (les info-bulles de la carte ne le sont pas)</li>
          <li>Navigation au clavier avec indicateur de focus visible sur tous les éléments interactifs</li>
          <li>Animations désactivées si votre système demande de réduire les animations (<code>prefers-reduced-motion</code>)</li>
          <li>Lien d'évitement vers le contenu principal</li>
          <li>Langue de page déclarée (français)</li>
        </ul>

        <h2 className="h5 mt-4 mb-2">Limites connues</h2>
        <ul style={{ paddingLeft: '1.4em', listStyleType: 'disc' }}>
          <li>Pas d'audit par un organisme tiers ni de test avec des utilisateurs de technologies d'assistance</li>
          <li>Les popups de la carte interactive (Leaflet) restent inaccessibles au clavier — d'où la liste alternative, mais elle n'a pas toute l'interactivité de la carte (zoom, survol)</li>
        </ul>

        <h2 className="h5 mt-4 mb-2">Signaler un problème</h2>
        <p>
          Si une partie du site vous reste inaccessible, vous pouvez le signaler à [email de contact
          accessibilité à définir].
        </p>
      </div>
    </div>
  )
}
