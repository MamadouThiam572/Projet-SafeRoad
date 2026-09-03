import { useMetaPage } from '../../hooks/useMetaPage'

export function MentionsLegalesPage() {
  useMetaPage({
    titre: 'Mentions légales',
    description: "Éditeur, hébergement et propriété intellectuelle de la plateforme SafeRoad.",
    chemin: '/mentions-legales',
  })

  return (
    <div className="container py-5" style={{ maxWidth: 820 }}>
      <h1 className="h3 mb-4">Mentions légales</h1>
      <div className="surface-card p-4 p-md-5" style={{ lineHeight: 1.7 }}>
        <div className="alert alert-warning mb-4" role="note">
          SafeRoad est, à ce stade, un projet en développement. Les informations ci-dessous sont un
          gabarit à compléter avec les coordonnées officielles avant toute mise en production.
        </div>

        <h2 className="h5 mt-4 mb-2">Éditeur du site</h2>
        <p>
          [Nom de l'organisme ou de l'auteur du projet]<br />
          [Adresse]<br />
          Contact : [email de contact]
        </p>

        <h2 className="h5 mt-4 mb-2">Hébergement</h2>
        <p>[Nom de l'hébergeur, adresse]</p>

        <h2 className="h5 mt-4 mb-2">Propriété intellectuelle</h2>
        <p>
          Le nom SafeRoad, les illustrations et l'identité visuelle sont la propriété de leurs auteurs
          respectifs. Les données de zones à risque et statistiques publiées sont mises à disposition à
          titre informatif pour la prévention routière.
        </p>

        <h2 className="h5 mt-4 mb-2">Responsabilité</h2>
        <p>
          Les zones affichées sont issues d'une détection automatisée (regroupement des incidents rapportés
          par les boîtiers embarqués) puis validées par un administrateur avant publication. Elles ne
          dispensent pas de la prudence au volant et ne sauraient engager la responsabilité de l'éditeur en
          cas d'accident.
        </p>
      </div>
    </div>
  )
}
