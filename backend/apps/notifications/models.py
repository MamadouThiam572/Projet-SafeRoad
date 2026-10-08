from django.conf import settings
from django.db import models

from apps.boitiers.models import Boitier
from apps.incidents.models import Incident
from apps.signalements.models import Signalement
from apps.zones.models import Zone


class NotificationAdmin(models.Model):
    class TypeNotification(models.TextChoices):
        INCIDENT_CRITIQUE = 'incident_critique', 'Incident critique'
        NOUVELLE_ZONE = 'nouvelle_zone', 'Nouvelle zone'
        ZONE_A_VALIDER = 'zone_a_valider', 'Zone à valider'
        SYNC_ECHOUEE = 'sync_echouee', 'Synchronisation échouée'
        FEEDBACK_ANASER = 'feedback_anaser', 'Feedback ANASER'
        NOUVEAU_SIGNALEMENT = 'nouveau_signalement', 'Nouveau signalement'

    destinataire = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications',
        help_text="Null = notification diffusée à tous les administrateurs",
    )
    type_notification = models.CharField(max_length=25, choices=TypeNotification.choices)
    incident = models.ForeignKey(Incident, on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    zone = models.ForeignKey(Zone, on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    boitier = models.ForeignKey(Boitier, on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    signalement = models.ForeignKey(
        Signalement, on_delete=models.CASCADE, null=True, blank=True, related_name='notifications',
    )
    message = models.CharField(max_length=255)
    # `lue` ne vaut que pour une notification ciblée. Une diffusion (destinataire=None) est
    # partagée par tous les administrateurs : son état « lu » est propre à chacun (lue_par),
    # sinon le premier admin qui la lit la marquerait comme lue pour tous les autres.
    lue = models.BooleanField(default=False)
    lue_par = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name='notifications_lues')
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['destinataire', 'lue']),
        ]
        ordering = ['-date_creation']

    def __str__(self):
        return f"{self.type_notification} — {self.message[:50]}"
