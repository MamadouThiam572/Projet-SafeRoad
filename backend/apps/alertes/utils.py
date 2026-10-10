from geopy.distance import geodesic

from apps.core.geo import boite_englobante
from apps.zones.models import Zone

# Rayon de recherche des zones candidates (au-delà du plus grand rayon de zone réaliste).
_RAYON_RECHERCHE_ZONES_METRES = 5_000


def zone_reconnue_contenant(latitude, longitude):
    """Zone reconnue par l'ANASER (et active) dont le cercle contient ce point, la plus proche
    de son centre s'il y en a plusieurs ; None sinon."""
    delta_latitude, delta_longitude = boite_englobante(latitude, longitude, _RAYON_RECHERCHE_ZONES_METRES)
    candidates = Zone.objects.filter(
        statut_validation=Zone.StatutValidation.RECONNUE, actif=True,
        latitude_centre__range=(latitude - delta_latitude, latitude + delta_latitude),
        longitude_centre__range=(longitude - delta_longitude, longitude + delta_longitude),
    )
    contenantes = []
    for zone in candidates:
        distance = geodesic((latitude, longitude), (zone.latitude_centre, zone.longitude_centre)).meters
        if distance <= zone.rayon_metres:
            contenantes.append((distance, zone))
    return min(contenantes, key=lambda paire: paire[0])[1] if contenantes else None

# Correspondance niveau_danger de la zone -> canaux déclenchés localement par le boîtier
# (LED verte/jaune/rouge, buzzer, message vocal DFPlayer FR/Wolof). Le boîtier applique cette
# même règle en local dès réception du niveau_danger ; le backend la rejoue ici uniquement pour
# enregistrer un historique/audit côté admin, sans dépendre d'un retour du boîtier.
_CANAL_LED_PAR_NIVEAU = {
    Zone.NiveauDanger.NORMALE: 'vert',
    Zone.NiveauDanger.VIGILANCE: 'jaune',
    Zone.NiveauDanger.CRITIQUE: 'rouge',
}


def determiner_canaux_alerte(niveau_danger):
    canal_led = _CANAL_LED_PAR_NIVEAU.get(niveau_danger, 'vert')
    canal_sonore_actif = canal_led in ('jaune', 'rouge')
    return {
        'canal_led': canal_led,
        'canal_buzzer_declenche': canal_sonore_actif,
        'canal_audio_declenche': canal_sonore_actif,
    }
