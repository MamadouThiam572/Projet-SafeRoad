import { useMetaPage } from '../../hooks/useMetaPage'

export function PolitiqueConfidentialitePage() {
  useMetaPage({
    titre: 'Politique de confidentialité',
    description: "Quelles données SafeRoad collecte, pourquoi, et ce qui est rendu public.",
    chemin: '/confidentialite',
  })

  return (
    <div className="container py-5" style={{ maxWidth: 820 }}>
      <h1 className="h3 mb-4">Politique de confidentialité</h1>
      <div className="surface-card p-4 p-md-5" style={{ lineHeight: 1.7 }}>
        <p className="text-sm text-ink-soft mb-4">Dernière mise à jour : {new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })}</p>

        <h2 className="h5 mt-4 mb-2">Ce qui est public</h2>
        <p>
          Les pages publiques de SafeRoad (carte des zones, statistiques) n'affichent que des données
          <strong> agrégées et anonymisées</strong> : un niveau de danger et un nombre d'incidents par zone,
          des totaux quotidiens. Aucune donnée individuelle (identité, position d'un véhicule précis,
          contenu d'un incident) n'est jamais exposée sur ces pages.
        </p>

        <h2 className="h5 mt-4 mb-2">Ce qui est collecté, et pourquoi</h2>
        <p>Pour permettre la détection et la cartographie, le système enregistre :</p>
        <ul className="mt-2 mb-3" style={{ paddingLeft: '1.4em', listStyleType: 'disc' }}>
          <li><strong>Boîtiers embarqués</strong> — identité du propriétaire (nom, téléphone), immatriculation, position GPS la plus récente. Nécessaire pour associer un boîtier à son détenteur et le géolocaliser.</li>
          <li><strong>Incidents détectés</strong> — position, horodatage, mesures des capteurs (accéléromètre, radar, gyroscope). Sert exclusivement à calculer la gravité et à alimenter le regroupement en zones à risque.</li>
          <li><strong>Comptes administrateurs et agents ANASER</strong> — email, nom, rôle. Nécessaire à l'authentification et à la traçabilité des validations.</li>
        </ul>
        <p>Ces données ne sont accessibles qu'aux administrateurs et agents ANASER authentifiés — jamais au public.</p>

        <h2 className="h5 mt-4 mb-2">Durée de conservation</h2>
        <p>
          <em>Non définie à ce stade du projet.</em> Aucune purge automatique n'est actuellement en place.
          Ce point doit être précisé par l'ANASER avant toute mise en production, conformément au cadre
          sénégalais de protection des données personnelles (loi n° 2008-12, sous le contrôle de la
          Commission de protection des données personnelles — CDP).
        </p>

        <h2 className="h5 mt-4 mb-2">Vos droits</h2>
        <p>
          Toute personne dont les données sont enregistrées (propriétaire d'un boîtier, agent) peut demander
          l'accès, la rectification ou la suppression de ses données auprès de l'organisme responsable du
          traitement.
        </p>

        <div className="alert alert-warning mt-4" role="note">
          <strong>Page à finaliser avant mise en production réelle :</strong> coordonnées du responsable de
          traitement, du délégué à la protection des données et durée de conservation définitive — à
          compléter par l'ANASER.
        </div>
      </div>
    </div>
  )
}
