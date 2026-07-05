import numpy as np
from geopy.distance import geodesic
from sklearn.cluster import DBSCAN

from apps.configuration.models import ConfigurationSysteme
from apps.incidents.models import Incident

from .models import Zone

RAYON_TERRE_METRES = 6371000


def _niveau_danger(score_danger):
    if score_danger >= 15:
        return Zone.NiveauDanger.CRITIQUE
    if score_danger >= 8:
        return Zone.NiveauDanger.ELEVE
    if score_danger >= 4:
        return Zone.NiveauDanger.MOYEN
    return Zone.NiveauDanger.FAIBLE


def generer_zones_depuis_incidents():
    """Reclustère l'ensemble des incidents géolocalisés en zones accidentogènes (DBSCAN/haversine).

    Les zones déjà validées/rejetées par un admin ne sont pas recréées : si un nouveau cluster
    correspond spatialement à une zone existante, ses statistiques sont mises à jour sans toucher
    à son statut_validation. Sinon une nouvelle zone EN_ATTENTE est créée.
    """
    config = ConfigurationSysteme.instance()
    incidents = list(Incident.objects.all().only('id', 'latitude', 'longitude', 'niveau_gravite'))

    if len(incidents) < config.min_incidents_pour_zone:
        return {'zones_creees': 0, 'zones_mises_a_jour': 0, 'incidents_traites': len(incidents)}

    coordonnees_radians = np.radians([[inc.latitude, inc.longitude] for inc in incidents])
    eps_radians = config.rayon_clustering_metres / RAYON_TERRE_METRES

    dbscan = DBSCAN(
        eps=eps_radians,
        min_samples=config.min_incidents_pour_zone,
        metric='haversine',
    )
    labels = dbscan.fit_predict(coordonnees_radians)

    zones_creees = 0
    zones_mises_a_jour = 0

    for label in set(labels):
        if label == -1:
            continue

        incidents_du_cluster = [inc for inc, lab in zip(incidents, labels) if lab == label]
        latitude_centre = sum(inc.latitude for inc in incidents_du_cluster) / len(incidents_du_cluster)
        longitude_centre = sum(inc.longitude for inc in incidents_du_cluster) / len(incidents_du_cluster)
        nombre_incidents = len(incidents_du_cluster)
        nombre_critiques = sum(
            1 for inc in incidents_du_cluster if inc.niveau_gravite == Incident.NiveauGravite.CRITIQUE
        )
        score_danger = nombre_incidents + 2 * nombre_critiques
        niveau_danger = _niveau_danger(score_danger)

        zone_existante = None
        for zone in Zone.objects.filter(actif=True):
            distance_metres = geodesic(
                (latitude_centre, longitude_centre), (zone.latitude_centre, zone.longitude_centre)
            ).meters
            if distance_metres <= config.rayon_clustering_metres:
                zone_existante = zone
                break

        if zone_existante:
            zone_existante.latitude_centre = latitude_centre
            zone_existante.longitude_centre = longitude_centre
            zone_existante.rayon_metres = config.rayon_clustering_metres
            zone_existante.nombre_incidents = nombre_incidents
            zone_existante.score_danger = score_danger
            zone_existante.niveau_danger = niveau_danger
            zone_existante.save()
            zone = zone_existante
            zones_mises_a_jour += 1
        else:
            zone = Zone.objects.create(
                latitude_centre=latitude_centre,
                longitude_centre=longitude_centre,
                rayon_metres=config.rayon_clustering_metres,
                nombre_incidents=nombre_incidents,
                score_danger=score_danger,
                niveau_danger=niveau_danger,
            )
            zones_creees += 1

        Incident.objects.filter(id__in=[inc.id for inc in incidents_du_cluster]).update(zone=zone)

    return {
        'zones_creees': zones_creees,
        'zones_mises_a_jour': zones_mises_a_jour,
        'incidents_traites': len(incidents),
    }
