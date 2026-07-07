from django.conf import settings
from django.db import models

from apps.boitiers.models import Boitier
from apps.incidents.models import Incident
from apps.zones.models import Zone


class Alerte(models.Model):
    class Statut(models.TextChoices):
        NOUVELLE = 'nouvelle', 'Nouvelle'
        VUE = 'vue', 'Vue'
        TRAITEE = 'traitee', 'Traitée'

    incident = models.OneToOneField(Incident, on_delete=models.CASCADE, related_name='alerte')
    statut = models.CharField(max_length=10, choices=Statut.choices, default=Statut.NOUVELLE)
    traitee_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='alertes_traitees'
    )
    traitee_le = models.DateTimeField(null=True, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date_creation']

    def __str__(self):
        return f"Alerte incident #{self.incident_id} ({self.statut})"


class AlerteProximite(models.Model):
    class CanalLed(models.TextChoices):
        VERT = 'vert', 'Vert'
        JAUNE = 'jaune', 'Jaune'
        ROUGE = 'rouge', 'Rouge'

    boitier = models.ForeignKey(Boitier, on_delete=models.CASCADE, related_name='alertes_proximite')
    zone = models.ForeignKey(Zone, on_delete=models.CASCADE, related_name='alertes_proximite')
    distance_metres = models.FloatField()
    latitude = models.FloatField()
    longitude = models.FloatField()
    # Canaux déclenchés localement par le boîtier (LED/buzzer/message vocal DFPlayer), déterminés
    # par le niveau_danger de la zone au moment de l'alerte — voir apps.alertes.utils.
    canal_led = models.CharField(max_length=10, choices=CanalLed.choices, default=CanalLed.VERT)
    canal_buzzer_declenche = models.BooleanField(default=False)
    canal_audio_declenche = models.BooleanField(default=False)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['boitier', 'zone', 'date_creation']),
        ]
        ordering = ['-date_creation']

    def __str__(self):
        return f"Proximité {self.boitier_id} → zone {self.zone_id} ({self.distance_metres} m)"
