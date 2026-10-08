from django.db import models

from apps.boitiers.models import Boitier, HistoriqueSync
from apps.zones.models import Zone


class Incident(models.Model):
    class TypeIncident(models.TextChoices):
        CHOC_VIOLENT = 'choc_violent', 'Choc violent'
        FREINAGE_BRUSQUE = 'freinage_brusque', 'Freinage brusque'
        COLLISION = 'collision', 'Collision'
        CHUTE = 'chute', 'Chute'
        AUTRE = 'autre', 'Autre'

    class NiveauGravite(models.TextChoices):
        FAIBLE = 'faible', 'Faible'
        MOYEN = 'moyen', 'Moyen'
        CRITIQUE = 'critique', 'Critique'

    boitier = models.ForeignKey(Boitier, on_delete=models.PROTECT, related_name='incidents')
    latitude = models.FloatField()
    longitude = models.FloatField()
    altitude = models.FloatField(null=True, blank=True)
    horodatage = models.DateTimeField()
    recu_le = models.DateTimeField(auto_now_add=True)
    type_incident = models.CharField(max_length=20, choices=TypeIncident.choices)
    niveau_gravite = models.CharField(max_length=10, choices=NiveauGravite.choices, default=NiveauGravite.FAIBLE)

    # Valeurs brutes des capteurs au moment de l'incident
    vitesse_radar = models.FloatField(null=True, blank=True)
    acceleration_x = models.FloatField(null=True, blank=True)
    acceleration_y = models.FloatField(null=True, blank=True)
    acceleration_z = models.FloatField(null=True, blank=True)
    gyro_x = models.FloatField(null=True, blank=True)
    gyro_y = models.FloatField(null=True, blank=True)
    gyro_z = models.FloatField(null=True, blank=True)
    distance_hcsr04 = models.FloatField(null=True, blank=True)

    # Données du module GPS au moment de l'incident.
    vitesse_gps = models.FloatField(null=True, blank=True, help_text="km/h")
    hdop = models.FloatField(null=True, blank=True)
    nombre_satellites = models.PositiveSmallIntegerField(null=True, blank=True)
    # Calculé à la réception (voir utils.position_gps_fiable) : une position douteuse est
    # conservée mais exclue du calcul des zones, pour ne pas créer une zone au mauvais endroit.
    position_fiable = models.BooleanField(default=True)

    synced = models.BooleanField(default=True)
    historique_sync = models.ForeignKey(
        HistoriqueSync, on_delete=models.SET_NULL, null=True, blank=True, related_name='incidents'
    )
    zone = models.ForeignKey(Zone, on_delete=models.SET_NULL, null=True, blank=True, related_name='incidents')

    class Meta:
        indexes = [
            models.Index(fields=['boitier', 'horodatage']),
            models.Index(fields=['type_incident']),
            models.Index(fields=['synced']),
            models.Index(fields=['position_fiable']),
        ]
        ordering = ['-horodatage']

    def __str__(self):
        return f"Incident {self.type_incident} — {self.boitier_id} ({self.horodatage})"
