import uuid

from django.contrib.auth.hashers import check_password, make_password
from django.db import models


class Boitier(models.Model):
    class Statut(models.TextChoices):
        ACTIF = 'actif', 'Actif'
        INACTIF = 'inactif', 'Inactif'
        MAINTENANCE = 'maintenance', 'Maintenance'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    api_key_hash = models.CharField(max_length=128)
    proprietaire_nom = models.CharField(max_length=150, blank=True)
    proprietaire_telephone = models.CharField(max_length=30, blank=True)
    numero_immatriculation = models.CharField(max_length=30, blank=True)
    derniere_latitude = models.FloatField(null=True, blank=True)
    derniere_longitude = models.FloatField(null=True, blank=True)
    derniere_localisation_maj = models.DateTimeField(null=True, blank=True)
    statut = models.CharField(max_length=15, choices=Statut.choices, default=Statut.ACTIF)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_maj = models.DateTimeField(auto_now=True)

    def set_api_key(self, api_key_en_clair):
        self.api_key_hash = make_password(api_key_en_clair)

    def verifier_api_key(self, api_key_en_clair):
        return check_password(api_key_en_clair, self.api_key_hash)

    def __str__(self):
        return f"Boitier {self.id} ({self.statut})"


class HistoriqueSync(models.Model):
    boitier = models.ForeignKey(Boitier, on_delete=models.CASCADE, related_name='historiques_sync')
    date_synchronisation = models.DateTimeField(auto_now_add=True)
    nombre_incidents_synchronises = models.PositiveIntegerField(default=0)
    succes = models.BooleanField(default=True)
    message_erreur = models.TextField(blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['boitier', 'date_synchronisation']),
        ]
        ordering = ['-date_synchronisation']

    def __str__(self):
        return f"Sync {self.boitier_id} — {self.date_synchronisation}"
