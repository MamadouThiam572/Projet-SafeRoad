from django.conf import settings
from django.db import models

from apps.boitiers.models import Boitier
from apps.incidents.models import Incident
from apps.zones.models import Zone


class NotificationAdmin(models.Model):
    class TypeNotification(models.TextChoices):
        INCIDENT_CRITIQUE = 'incident_critique', 'Incident critique'
        NOUVELLE_ZONE = 'nouvelle_zone', 'Nouvelle zone'
        ZONE_A_VALIDER = 'zone_a_valider', 'Zone à valider'
        SYNC_ECHOUEE = 'sync_echouee', 'Synchronisation échouée'
        FEEDBACK_ANASER = 'feedback_anaser', 'Feedback ANASER'

    destinataire = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications',
        help_text="Null = notification diffusée à tous les administrateurs",
    )
    type_notification = models.CharField(max_length=20, choices=TypeNotification.choices)
    incident = models.ForeignKey(Incident, on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    zone = models.ForeignKey(Zone, on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    boitier = models.ForeignKey(Boitier, on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    message = models.CharField(max_length=255)
    lue = models.BooleanField(default=False)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['destinataire', 'lue']),
        ]
        ordering = ['-date_creation']

    def __str__(self):
        return f"{self.type_notification} — {self.message[:50]}"
