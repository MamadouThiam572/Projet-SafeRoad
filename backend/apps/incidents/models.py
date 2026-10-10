from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.boitiers.models import Boitier, HistoriqueSync
from apps.zones.models import Zone


# Rôles autorisés à traiter un incident (voir Incident.TRANSITIONS).
_TRAITEMENT = frozenset({'admin', 'super_admin'})


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

    class Statut(models.TextChoices):
        # Traitement administratif de l'incident détecté par le boîtier.
        NOUVEAU = 'nouveau', 'Nouveau'
        EN_COURS = 'en_cours', 'En cours'
        VALIDE = 'valide', 'Validé'
        CLOTURE = 'cloture', 'Clôturé'
        # Fausse détection (dos-d'âne pris pour un choc, capteur défaillant…) : l'incident reste
        # enregistré mais ne compte plus dans le calcul des zones (voir clustering.py).
        REJETE = 'rejete', 'Rejeté (faux positif)'

    S = Statut
    # (statut actuel, nouveau statut) -> rôles autorisés. Toute transition absente est refusée.
    TRANSITIONS = {
        (S.NOUVEAU, S.EN_COURS): _TRAITEMENT,
        (S.NOUVEAU, S.VALIDE): _TRAITEMENT,
        (S.EN_COURS, S.VALIDE): _TRAITEMENT,
        (S.VALIDE, S.CLOTURE): _TRAITEMENT,
        (S.NOUVEAU, S.REJETE): _TRAITEMENT,
        (S.EN_COURS, S.REJETE): _TRAITEMENT,
    }
    # Écarter une donnée capteur doit toujours être justifié.
    TRANSITIONS_A_MOTIVER = {(S.NOUVEAU, S.REJETE), (S.EN_COURS, S.REJETE)}
    del S

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
    statut = models.CharField(max_length=15, choices=Statut.choices, default=Statut.NOUVEAU)

    class Meta:
        indexes = [
            models.Index(fields=['boitier', 'horodatage']),
            models.Index(fields=['type_incident']),
            models.Index(fields=['synced']),
            models.Index(fields=['position_fiable']),
            models.Index(fields=['statut']),
        ]
        ordering = ['-horodatage']

    def __str__(self):
        return f"Incident {self.type_incident} — {self.boitier_id} ({self.horodatage})"


class ObservationIncident(models.Model):
    """Historique du traitement d'un incident : un changement de statut (statut_precedent →
    statut_nouveau, avec son motif) ou une simple observation (statuts vides)."""

    incident = models.ForeignKey(Incident, on_delete=models.CASCADE, related_name='observations')
    statut_precedent = models.CharField(max_length=15, choices=Incident.Statut.choices, blank=True)
    statut_nouveau = models.CharField(max_length=15, choices=Incident.Statut.choices, blank=True)
    texte = models.TextField(blank=True)
    acteur = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='observations_incidents',
    )
    role_acteur = models.CharField(max_length=15)
    date = models.DateTimeField(default=timezone.now)

    class Meta:
        # 'id' départage deux entrées enregistrées dans la même microseconde.
        ordering = ['date', 'id']

    def __str__(self):
        return f"Incident #{self.incident_id} : {self.statut_nouveau or 'observation'}"
