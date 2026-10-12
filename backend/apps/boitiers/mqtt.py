"""Traduction des messages MQTT du boîtier SafeRoad (firmware ESP32) vers le backend.

Le boîtier publie sur un broker MQTT (HiveMQ en Wi-Fi, Mosquitto en GSM), et non sur l'API HTTP :
- `saferoad/data` : une mesure toutes les 500 ms (position si le GPS capte, vitesses, distances,
  accélérations, événement en cours, excès de vitesse, réseau utilisé) ;
- `saferoad/alertes` : un événement détecté et déjà validé par le croisement des capteurs
  (`{"alerte": "Freinage", "valeur": 3.2, "timestamp": <ms depuis l'allumage>}`). Rejoué depuis
  la carte SD après une coupure, il peut aussi arriver sur `saferoad/data` : c'est la clé
  `alerte` qui le reconnaît, pas le topic.

Le serveur fait confiance au classement du boîtier (pas de recalcul de gravité à partir d'un
seul capteur). Le boîtier est reconnu par son adresse MAC (`mac`, à ajouter par le firmware) ;
un message sans `mac` ni `boitier_id` est attribué à MQTT_BOITIER_PAR_DEFAUT (le prototype).
Sans `horodatage`, un message est daté à sa réception.
"""

import json
import logging
import math
import uuid
from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.configuration.models import ConfigurationSysteme
from apps.incidents.models import Incident
from apps.incidents.utils import gravite_pour, position_gps_fiable

from .models import Boitier, normaliser_mac
from .views import enregistrer_position

logger = logging.getLogger(__name__)

T = Incident.TypeIncident
# Événements du firmware (analyserConduite / analyserSecuriteEtAfficher) -> types d'incident.
EVENEMENTS = {
    'Freinage': T.FREINAGE_BRUSQUE,
    'Acceleration': T.ACCELERATION_BRUSQUE,
    'Virage': T.VIRAGE_DANGEREUX,
    'Virage+Freinage': T.VIRAGE_DANGEREUX,
    'Virage+Acceleration': T.VIRAGE_DANGEREUX,
    'SecousseDangereuse': T.SECOUSSE_DANGEREUSE,
    'RouteDefectueuse': T.ROUTE_DEGRADEE,
    'ObstacleCritique': T.OBSTACLE_CRITIQUE,
    # Filet de sécurité : à n'envoyer que pour un accident confirmé par plusieurs capteurs.
    'Accident': T.ACCIDENT,
}
# Niveaux d'excès de vitesse du firmware, du moins au plus grave, avec leur gravité.
NIVEAUX_EXCES = ['Normal', 'ExcesUrbain', 'ExcesRoute', 'GrandExces']
GRAVITE_EXCES = {
    'ExcesUrbain': Incident.NiveauGravite.FAIBLE,
    'ExcesRoute': Incident.NiveauGravite.FAIBLE,
    'GrandExces': Incident.NiveauGravite.MOYEN,
}

# Une position enregistrée au plus toutes les N secondes (le boîtier mesure toutes les 500 ms).
INTERVALLE_POSITION_SECONDES = 10
# Un même événement répété (ex. obstacle critique toutes les 2 s) ne crée qu'un incident par fenêtre.
DELAI_ENTRE_INCIDENTS_SECONDES = 30
# Une alerte sans position reprend la dernière position connue si elle a moins de N secondes.
FRAICHEUR_DERNIERE_POSITION_SECONDES = 60


def _nombre(valeur):
    """Valeur numérique finie, sinon None (le JSON du firmware peut contenir nan / inf)."""
    if isinstance(valeur, bool) or not isinstance(valeur, (int, float)) or not math.isfinite(valeur):
        return None
    return float(valeur)


# Un même boîtier inconnu ne génère qu'une notification par fenêtre (il publie toutes les 500 ms).
FENETRE_NOTIFICATION_INCONNU = timedelta(hours=1)


def _signaler_boitier_inconnu(mac, donnees):
    """Boîtier qui publie avec une MAC non enregistrée : prévient le(s) super admin(s), qui
    pourront créer sa fiche depuis la page Boîtiers (voir BoitierViewSet.detectes)."""
    from apps.comptes.models import Administrateur
    from apps.notifications.models import NotificationAdmin

    T = NotificationAdmin.TypeNotification
    deja = NotificationAdmin.objects.filter(
        type_notification=T.BOITIER_INCONNU, message__contains=mac,
        date_creation__gte=timezone.now() - FENETRE_NOTIFICATION_INCONNU,
    ).exists()
    if deja:
        return
    latitude, longitude = _nombre(donnees.get('latitude')), _nombre(donnees.get('longitude'))
    ou = f" près de {latitude:.4f}, {longitude:.4f}" if latitude is not None and longitude is not None else ''
    for admin in Administrateur.objects.filter(role=Administrateur.Role.SUPER_ADMIN, is_active=True):
        NotificationAdmin.objects.create(
            destinataire=admin, type_notification=T.BOITIER_INCONNU,
            message=f"Boîtier non enregistré détecté (MAC {mac}){ou}."[:255],
        )


def _boitier_du_message(donnees):
    """Le boîtier qui parle : `boitier_id` (UUID) s'il est envoyé, sinon son adresse MAC
    (`mac`), sinon le boîtier par défaut (prototype dont le firmware n'envoie encore rien).
    Une MAC inconnue n'est jamais attribuée au boîtier par défaut : elle est signalée."""
    actifs = Boitier.objects.filter(statut=Boitier.Statut.ACTIF)
    if donnees.get('boitier_id'):
        try:
            return actifs.filter(pk=uuid.UUID(str(donnees['boitier_id']))).first()
        except ValueError:
            return None
    if 'mac' in donnees:
        mac = normaliser_mac(donnees.get('mac'))
        if mac is None:
            return None
        boitier = Boitier.objects.filter(adresse_mac=mac).first()
        if boitier is None:
            _signaler_boitier_inconnu(mac, donnees)
            return None
        return boitier if boitier.statut == Boitier.Statut.ACTIF else None
    try:
        return actifs.filter(pk=uuid.UUID(str(settings.MQTT_BOITIER_PAR_DEFAUT))).first()
    except ValueError:
        return None


def _horodatage(donnees, maintenant):
    """Heure GPS du message si le firmware l'envoie (ISO 8601, UTC), sinon heure de réception."""
    valeur = donnees.get('horodatage')
    date = parse_datetime(valeur) if isinstance(valeur, str) else None
    if date is None or timezone.is_naive(date) or date > maintenant + timezone.timedelta(minutes=5):
        return maintenant
    return date


def _position(donnees, boitier, maintenant):
    """(latitude, longitude, hdop, satellites) du message, ou à défaut la dernière position
    récente du boîtier ; None si on ne sait pas où placer l'événement."""
    latitude, longitude = _nombre(donnees.get('latitude')), _nombre(donnees.get('longitude'))
    if latitude is not None and longitude is not None and -90 <= latitude <= 90 and -180 <= longitude <= 180:
        return latitude, longitude, _nombre(donnees.get('hdop')), _nombre(donnees.get('satellites'))
    if boitier.derniere_localisation_maj and boitier.derniere_latitude is not None and (
        (maintenant - boitier.derniere_localisation_maj).total_seconds() <= FRAICHEUR_DERNIERE_POSITION_SECONDES
    ):
        return boitier.derniere_latitude, boitier.derniere_longitude, boitier.dernier_hdop, boitier.dernier_nombre_satellites
    return None


def _creer_incident(boitier, type_incident, donnees, horodatage, maintenant, gravite=None):
    position = _position(donnees, boitier, maintenant)
    if position is None:
        logger.info("MQTT : %s du boîtier %s ignoré, aucune position connue.", type_incident, boitier.pk)
        return None
    gravite = gravite or gravite_pour(type_incident)
    # Anti-répétition par type ET gravité : une aggravation (petit puis grand excès) passe.
    debut_fenetre = maintenant - timezone.timedelta(seconds=DELAI_ENTRE_INCIDENTS_SECONDES)
    if Incident.objects.filter(
        boitier=boitier, type_incident=type_incident, niveau_gravite=gravite, recu_le__gte=debut_fenetre,
    ).exists():
        return None

    latitude, longitude, hdop, satellites = position
    satellites = int(satellites) if satellites is not None else None
    valeur = _nombre(donnees.get('valeur'))
    distance = valeur if type_incident == T.OBSTACLE_CRITIQUE else _nombre(donnees.get('distance'))
    return Incident.objects.create(
        boitier=boitier, latitude=latitude, longitude=longitude, altitude=_nombre(donnees.get('altitude')),
        horodatage=horodatage, type_incident=type_incident,
        niveau_gravite=gravite,
        vitesse_radar=_nombre(donnees.get('vitesse_radar')),
        vitesse_gps=_nombre(donnees.get('vitesse_vehicule', boitier.derniere_vitesse_gps)),
        # Accélérations sans la gravité (« dynamiques »), telles que le boîtier les analyse.
        acceleration_x=_nombre(donnees.get('ax_dynamique')),
        acceleration_y=_nombre(donnees.get('ay_dynamique')),
        acceleration_z=_nombre(donnees.get('az_dynamique')),
        distance_hcsr04=distance, hdop=hdop, nombre_satellites=satellites,
        position_fiable=position_gps_fiable(ConfigurationSysteme.instance(), hdop, satellites),
    )


def _traiter_exces(boitier, donnees, horodatage, maintenant):
    """Un incident quand le boîtier ENTRE dans un niveau d'excès plus grave, pas à chaque mesure."""
    niveau = donnees.get('exces_vitesse')
    if niveau not in NIVEAUX_EXCES:
        return None
    cle = f'mqtt:exces:{boitier.pk}'
    precedent = cache.get(cle, 'Normal')
    cache.set(cle, niveau, timeout=24 * 3600)
    if NIVEAUX_EXCES.index(niveau) <= NIVEAUX_EXCES.index(precedent):
        return None
    return _creer_incident(boitier, T.EXCES_VITESSE, donnees, horodatage, maintenant, GRAVITE_EXCES[niveau])


def traiter_message(topic, charge):
    """Point d'entrée de l'écoute MQTT. Renvoie un résumé (pour les journaux et les tests) ou
    None si le message est ignoré (JSON illisible, boîtier inconnu ou inactif)."""
    try:
        donnees = json.loads(charge)
    except (TypeError, ValueError, UnicodeDecodeError):
        logger.warning("MQTT : message illisible sur %s ignoré.", topic)
        return None
    if not isinstance(donnees, dict):
        return None
    boitier = _boitier_du_message(donnees)
    if boitier is None:
        logger.warning("MQTT : message sur %s sans boîtier connu et actif (boitier_id ou MQTT_BOITIER_PAR_DEFAUT).", topic)
        return None

    maintenant = timezone.now()
    reseau = donnees.get('canal_reseau')
    boitier.signaler_communication(reseau if reseau in ('wifi', 'gsm') else '')
    horodatage = _horodatage(donnees, maintenant)
    resume = {'boitier': str(boitier.pk), 'position': None, 'incidents': []}

    if 'alerte' in donnees:
        type_incident = EVENEMENTS.get(donnees['alerte'])
        if type_incident is None:
            logger.warning("MQTT : événement inconnu « %s » ignoré.", donnees['alerte'])
            return resume
        incident = _creer_incident(boitier, type_incident, donnees, horodatage, maintenant)
        if incident:
            resume['incidents'].append(incident.pk)
        return resume

    latitude, longitude = _nombre(donnees.get('latitude')), _nombre(donnees.get('longitude'))
    if latitude is not None and longitude is not None and cache.add(
        f'mqtt:position:{boitier.pk}', True, timeout=INTERVALLE_POSITION_SECONDES,
    ):
        satellites = _nombre(donnees.get('satellites'))
        resume['position'] = enregistrer_position(
            boitier, latitude, longitude,
            vitesse_gps=_nombre(donnees.get('vitesse_vehicule')), hdop=_nombre(donnees.get('hdop')),
            nombre_satellites=int(satellites) if satellites is not None else None,
            horodatage=horodatage if 'horodatage' in donnees else None,
        )
    incident = _traiter_exces(boitier, donnees, horodatage, maintenant)
    if incident:
        resume['incidents'].append(incident.pk)
    return resume
