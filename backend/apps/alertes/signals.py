from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.incidents.models import Incident

from .models import Alerte
from .utils import zone_reconnue_contenant

_NIVEAU_PAR_GRAVITE = {
    Incident.NiveauGravite.MOYEN: Alerte.Niveau.VIGILANCE,
    Incident.NiveauGravite.CRITIQUE: Alerte.Niveau.CRITIQUE,
}


@receiver(post_save, sender=Incident)
def creer_alerte_sur_incident(sender, instance, created, **kwargs):
    """Un incident moyen ou critique alerte les administrateurs ; s'il survient dans une zone
    reconnue par l'ANASER, l'alerte est classée « zone » plutôt que « véhicule »."""
    niveau = _NIVEAU_PAR_GRAVITE.get(instance.niveau_gravite)
    if not created or niveau is None:
        return
    zone = zone_reconnue_contenant(instance.latitude, instance.longitude)
    boitier = instance.boitier
    Alerte.objects.get_or_create(incident=instance, defaults={
        'source': Alerte.Source.ZONE if zone else Alerte.Source.VEHICULE,
        'niveau': niveau,
        'motif': Alerte.Motif.INCIDENT,
        'zone': zone,
        'boitier': boitier,
        'conducteur': getattr(boitier, 'conducteur', None),
    })
