import logging
from collections import Counter

import numpy as np
from geopy.distance import geodesic
from sklearn.cluster import DBSCAN

from apps.configuration.models import ConfigurationSysteme
from apps.core.geo import boite_englobante
from apps.incidents.models import Incident
from apps.signalements.models import Signalement

from .models import Zone

RAYON_TERRE_METRES = 6371000

logger = logging.getLogger(__name__)


def _niveau_danger(score_danger):
    if score_danger >= 15:
        return Zone.NiveauDanger.CRITIQUE
    if score_danger >= 4:
        return Zone.NiveauDanger.VIGILANCE
    return Zone.NiveauDanger.NORMALE


def _signalements_valides_autour(latitude, longitude, rayon_metres):
    """Nombre de signalements validés par un administrateur dans le rayon de la zone."""
    delta_latitude, delta_longitude = boite_englobante(latitude, longitude, rayon_metres)
    candidats = Signalement.objects.filter(
        statut=Signalement.Statut.VALIDE,
        latitude__range=(latitude - delta_latitude, latitude + delta_latitude),
        longitude__range=(longitude - delta_longitude, longitude + delta_longitude),
    ).only('latitude', 'longitude')
    return sum(
        1 for s in candidats
        if geodesic((latitude, longitude), (s.latitude, s.longitude)).meters <= rayon_metres
    )


def _region_majoritaire(incidents_du_cluster, latitude_centre, longitude_centre):
    """Région d'une zone = région majoritaire des boîtiers de ses incidents contributeurs
    (décidé après le clustering géographique national, jamais pour le partitionner — voir
    l'audit de l'étape 4D). Les incidents dont le boîtier n'a pas de région assignée ne
    participent pas au décompte. Retourne None — comportement sûr, jamais une région
    devinée — si aucune région n'a de majorité stricte, et signale le cas dans les logs
    plutôt que de trancher silencieusement."""
    compteur = Counter(inc.boitier.region for inc in incidents_du_cluster if inc.boitier.region)
    if not compteur:
        logger.warning(
            "Zone autour de (%.5f, %.5f) : aucun des %d incident(s) contributeur(s) n'a de "
            "boîtier régionalisé — région laissée à NULL.",
            latitude_centre, longitude_centre, len(incidents_du_cluster),
        )
        return None

    plus_frequentes = compteur.most_common()
    region_haut, effectif_haut = plus_frequentes[0]
    if len(plus_frequentes) > 1 and plus_frequentes[1][1] == effectif_haut:
        logger.warning(
            "Zone autour de (%.5f, %.5f) : pas de région majoritaire claire parmi les "
            "boîtiers contributeurs (égalité %s) — région laissée à NULL.",
            latitude_centre, longitude_centre, dict(plus_frequentes),
        )
        return None

    return region_haut


def generer_zones_depuis_incidents():
    """Reclustère l'ensemble des incidents géolocalisés en zones accidentogènes (DBSCAN/haversine).

    Les zones déjà engagées dans le workflow de validation ne sont pas recréées : si un nouveau cluster
    correspond spatialement à une zone existante, ses statistiques sont mises à jour sans toucher
    à son statut_validation. Sinon une nouvelle zone PROPOSEE est créée.
    """
    config = ConfigurationSysteme.instance()
    # select_related('boitier') : la région de chaque incident (pour la région majoritaire
    # de sa zone, calculée plus bas) se lit sur son boîtier, jamais sur ses propres champs —
    # Incident ne porte pas de région propre (voir étape 4B).
    incidents = list(
        # Une position GPS douteuse (peu de satellites / HDOP élevé) placerait la zone au
        # mauvais endroit : ces incidents restent enregistrés mais ne comptent pas ici.
        # Les fausses détections écartées par un administrateur ne comptent pas non plus.
        Incident.objects.filter(position_fiable=True).exclude(statut=Incident.Statut.REJETE)
        .select_related('boitier')
        .only('id', 'latitude', 'longitude', 'niveau_gravite', 'boitier__region', 'boitier_id')
    )

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
        # Les incidents capteurs ont créé le cluster ; les signalements validés alentour ne
        # font qu'en renforcer le score (données du boîtier prioritaires).
        nombre_signalements = _signalements_valides_autour(
            latitude_centre, longitude_centre, config.rayon_clustering_metres,
        )
        score_danger = nombre_incidents + 2 * nombre_critiques + config.poids_signalement_valide * nombre_signalements
        niveau_danger = _niveau_danger(score_danger)
        region = _region_majoritaire(incidents_du_cluster, latitude_centre, longitude_centre)

        # Pré-filtre bounding box (exploitable par un index B-tree sur latitude_centre/
        # longitude_centre) avant le calcul géodésique précis mais coûteux : on ne
        # calcule `geodesic()` que sur les quelques zones proches, plus sur toutes les
        # zones actives à chaque cluster.
        delta_latitude, delta_longitude = boite_englobante(latitude_centre, longitude_centre, config.rayon_clustering_metres)
        zones_candidates = Zone.objects.filter(
            actif=True,
            latitude_centre__range=(latitude_centre - delta_latitude, latitude_centre + delta_latitude),
            longitude_centre__range=(longitude_centre - delta_longitude, longitude_centre + delta_longitude),
        )

        zone_existante = None
        for zone in zones_candidates:
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
            zone_existante.nombre_signalements = nombre_signalements
            zone_existante.score_danger = score_danger
            zone_existante.niveau_danger = niveau_danger
            zone_existante.region = region
            zone_existante.save()
            zone = zone_existante
            zones_mises_a_jour += 1
        else:
            zone = Zone.objects.create(
                latitude_centre=latitude_centre,
                longitude_centre=longitude_centre,
                rayon_metres=config.rayon_clustering_metres,
                nombre_incidents=nombre_incidents,
                nombre_signalements=nombre_signalements,
                score_danger=score_danger,
                niveau_danger=niveau_danger,
                region=region,
            )
            zones_creees += 1

        Incident.objects.filter(id__in=[inc.id for inc in incidents_du_cluster]).update(zone=zone)

    return {
        'zones_creees': zones_creees,
        'zones_mises_a_jour': zones_mises_a_jour,
        'incidents_traites': len(incidents),
    }
