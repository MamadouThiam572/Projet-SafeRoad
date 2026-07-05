from django.conf import settings
from django.db import models

from apps.core.models import ModeleHorodate
from apps.incidents.models import Incident
from apps.zones.models import Zone


class AlerteAnaser(ModeleHorodate):
    class ActionPrevue(models.TextChoices):
        AUCUNE = 'aucune', 'Aucune'
        SIGNALISATION = 'signalisation', 'Signalisation'
        RALENTISSEUR = 'ralentisseur', 'Ralentisseur'
        ECLAIRAGE = 'eclairage', 'Éclairage'
        AUTRE = 'autre', 'Autre'

    class Statut(models.TextChoices):
        SOUMISE = 'soumise', 'Soumise'
        EN_COURS = 'en_cours', 'En cours'
        REALISEE = 'realisee', 'Réalisée'

    zone = models.ForeignKey(Zone, on_delete=models.CASCADE, null=True, blank=True, related_name='feedbacks_anaser')
    incident = models.ForeignKey(
        Incident, on_delete=models.CASCADE, null=True, blank=True, related_name='feedbacks_anaser'
    )
    auteur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='feedbacks_anaser')
    commentaire = models.TextField()
    action_prevue = models.CharField(max_length=15, choices=ActionPrevue.choices, default=ActionPrevue.AUCUNE)
    details_action = models.TextField(blank=True)
    statut = models.CharField(max_length=10, choices=Statut.choices, default=Statut.SOUMISE)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(zone__isnull=False) | models.Q(incident__isnull=False),
                name='alerte_anaser_zone_ou_incident_requis',
            )
        ]
        ordering = ['-date_creation']

    def __str__(self):
        return f"Feedback ANASER #{self.pk} ({self.statut})"
