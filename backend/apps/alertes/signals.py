from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.incidents.models import Incident

from .models import Alerte


@receiver(post_save, sender=Incident)
def creer_alerte_si_critique(sender, instance, created, **kwargs):
    if instance.niveau_gravite == Incident.NiveauGravite.CRITIQUE:
        Alerte.objects.get_or_create(incident=instance)
