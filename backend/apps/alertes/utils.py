from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from geopy.distance import geodesic

from apps.core.sms import envoyer_sms

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


# Un choc remonté en différé (boîtier resté hors réseau) n'est plus une urgence à signaler.
FRAICHEUR_URGENCE_MINUTES = 15
# Un même accident peut produire plusieurs détections : un seul envoi par boîtier sur ce délai.
DELAI_ENTRE_URGENCES_MINUTES = 10


def prevenir_choc_critique(alerte):
    """SMS à l'administrateur de la région du boîtier, e-mail au super administrateur. Le
    contact d'urgence du conducteur est prévenu par le boîtier lui-même (SIM800L)."""
    from apps.comptes.models import Administrateur

    from .models import Alerte

    incident, boitier = alerte.incident, alerte.boitier
    maintenant = timezone.now()
    if incident is None or maintenant - incident.horodatage > timezone.timedelta(minutes=FRAICHEUR_URGENCE_MINUTES):
        return
    deja_prevenu = Alerte.objects.filter(
        boitier=boitier, niveau=Alerte.Niveau.CRITIQUE, motif=Alerte.Motif.INCIDENT,
        date_creation__gte=maintenant - timezone.timedelta(minutes=DELAI_ENTRE_URGENCES_MINUTES),
    ).exclude(pk=alerte.pk).exists()
    if deja_prevenu:
        return

    heure = timezone.localtime(incident.horodatage).strftime('%H:%M')
    vehicule = boitier.numero_immatriculation or f"boîtier {str(boitier.id)[:8]}"
    if alerte.conducteur:
        vehicule += f" ({alerte.conducteur.prenom} {alerte.conducteur.nom})"
    vitesse = incident.vitesse_radar if incident.vitesse_radar is not None else incident.vitesse_gps
    vitesse_texte = f", {round(vitesse)} km/h" if vitesse is not None else ""
    position = f"https://maps.google.com/?q={incident.latitude:.5f},{incident.longitude:.5f}"
    message = (
        f"SafeRoad - CHOC CRITIQUE a {heure}, {vehicule}{vitesse_texte}. Position : {position} "
        f"- A confirmer. SAMU 1515, Pompiers 18."
    )

    admins_region = Administrateur.objects.filter(
        role=Administrateur.Role.ADMIN, region=boitier.region, is_active=True,
    ).exclude(telephone='')
    for admin in admins_region:
        envoyer_sms(admin.telephone, message)

    super_admins = Administrateur.objects.filter(role=Administrateur.Role.SUPER_ADMIN, is_active=True)
    destinataires = [compte.email for compte in super_admins]
    if destinataires:
        send_mail(f"SafeRoad — Choc critique ({vehicule})", message, settings.DEFAULT_FROM_EMAIL, destinataires)
