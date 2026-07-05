from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.boitiers.models import HistoriqueSync
from apps.incidents.models import Incident
from apps.zones.models import Zone

from .models import NotificationAdmin


@receiver(post_save, sender=Incident)
def notifier_incident_critique(sender, instance, created, **kwargs):
    if created and instance.niveau_gravite == Incident.NiveauGravite.CRITIQUE:
        NotificationAdmin.objects.create(
            type_notification=NotificationAdmin.TypeNotification.INCIDENT_CRITIQUE,
            incident=instance,
            message=f"Incident critique détecté ({instance.type_incident}) pour le boîtier {instance.boitier_id}.",
        )


@receiver(post_save, sender=Zone)
def notifier_zone_a_valider(sender, instance, created, **kwargs):
    if created and instance.statut_validation == Zone.StatutValidation.EN_ATTENTE:
        NotificationAdmin.objects.create(
            type_notification=NotificationAdmin.TypeNotification.ZONE_A_VALIDER,
            zone=instance,
            message=f"Nouvelle zone accidentogène détectée ({instance.nombre_incidents} incidents) à valider.",
        )


@receiver(post_save, sender=HistoriqueSync)
def notifier_sync_echouee(sender, instance, created, **kwargs):
    if created and not instance.succes:
        NotificationAdmin.objects.create(
            type_notification=NotificationAdmin.TypeNotification.SYNC_ECHOUEE,
            boitier=instance.boitier,
            message=f"Échec de synchronisation pour le boîtier {instance.boitier_id}: {instance.message_erreur}",
        )
