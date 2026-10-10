from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.boitiers.models import HistoriqueSync
from apps.incidents.models import Incident
from apps.signalements.models import Signalement
from apps.zones.models import HistoriqueStatutZone, Zone

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
    if created and instance.statut_validation == Zone.StatutValidation.PROPOSEE:
        NotificationAdmin.objects.create(
            type_notification=NotificationAdmin.TypeNotification.ZONE_A_VALIDER,
            zone=instance,
            message=f"Nouvelle zone accidentogène détectée ({instance.nombre_incidents} incidents) à vérifier.",
        )


@receiver(post_save, sender=HistoriqueSync)
def notifier_sync_echouee(sender, instance, created, **kwargs):
    if created and not instance.succes:
        NotificationAdmin.objects.create(
            type_notification=NotificationAdmin.TypeNotification.SYNC_ECHOUEE,
            boitier=instance.boitier,
            message=f"Échec de synchronisation pour le boîtier {instance.boitier_id}: {instance.message_erreur}",
        )


@receiver(post_save, sender=Signalement)
def notifier_nouveau_signalement(sender, instance, created, **kwargs):
    # Diffusion : le filtrage régional des notifications (voir views.py) la réserve à
    # l'administrateur de la région du signalement et au super administrateur.
    if created:
        lieu = instance.localite or instance.get_region_display()
        NotificationAdmin.objects.create(
            type_notification=NotificationAdmin.TypeNotification.NOUVEAU_SIGNALEMENT,
            signalement=instance,
            message=f"Nouveau signalement à vérifier : {instance.get_type_danger_display()} ({lieu}).",
        )


@receiver(post_save, sender=HistoriqueStatutZone)
def notifier_workflow_zone(sender, instance, created, **kwargs):
    """Soumission d'une zone -> l'ANASER est prévenue ; décision de l'ANASER (reconnaissance,
    rejet, demande de complément) -> les administrateurs de la région de la zone le sont."""
    if not created:
        return
    zone = instance.zone
    if instance.statut_nouveau == Zone.StatutValidation.SOUMISE_ANASER:
        NotificationAdmin.objects.create(
            type_notification=NotificationAdmin.TypeNotification.ZONE_SOUMISE_ANASER,
            audience=NotificationAdmin.Audience.ANASER, zone=zone,
            message=f"Zone à reconnaître : {zone} ({zone.nombre_incidents} incidents), validée techniquement.",
        )
    elif instance.role_acteur == 'anaser':
        decision = instance.get_statut_nouveau_display()
        motif = f" — {instance.commentaire}" if instance.commentaire else ""
        NotificationAdmin.objects.create(
            type_notification=NotificationAdmin.TypeNotification.DECISION_ANASER,
            audience=NotificationAdmin.Audience.PERSONNEL, zone=zone,
            message=f"ANASER : {zone} → {decision}{motif}"[:255],
        )
