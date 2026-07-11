from django.conf import settings
from django.db import models

from apps.core.models import ModeleHorodate


class Zone(ModeleHorodate):
    class NiveauDanger(models.TextChoices):
        NORMALE = 'normale', 'Normale'
        VIGILANCE = 'vigilance', 'Vigilance'
        CRITIQUE = 'critique', 'Critique'

    class StatutValidation(models.TextChoices):
        EN_ATTENTE = 'en_attente', 'En attente'
        VALIDEE = 'validee', 'Validée'
        REJETEE = 'rejetee', 'Rejetée'

    nom = models.CharField(max_length=150, blank=True)
    latitude_centre = models.FloatField()
    longitude_centre = models.FloatField()
    rayon_metres = models.FloatField()
    nombre_incidents = models.PositiveIntegerField(default=0)
    score_danger = models.FloatField(default=0)
    niveau_danger = models.CharField(max_length=10, choices=NiveauDanger.choices, default=NiveauDanger.NORMALE)
    statut_validation = models.CharField(
        max_length=10, choices=StatutValidation.choices, default=StatutValidation.EN_ATTENTE
    )
    validee_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='zones_validees'
    )
    validee_le = models.DateTimeField(null=True, blank=True)
    actif = models.BooleanField(default=True)

    class Meta:
        indexes = [
            models.Index(fields=['statut_validation']),
            models.Index(fields=['actif']),
        ]

    def __str__(self):
        return self.nom or f"Zone #{self.pk}"
