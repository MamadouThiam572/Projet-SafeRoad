import uuid

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.db import models

from apps.boitiers.models import Boitier


class ConducteurManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("L'email est obligatoire")
        email = self.normalize_email(email)
        conducteur = self.model(email=email, **extra_fields)
        conducteur.set_password(password)
        conducteur.save(using=self._db)
        return conducteur


class Conducteur(AbstractBaseUser):
    # UUID plutôt qu'un entier auto-incrémenté : distingue structurellement ce compte
    # d'un Administrateur (pk entière) pour qu'un token émis pour l'un ne puisse jamais,
    # même par coïncidence de pk, être résolu comme l'autre — voir apps.core.authentication.
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    nom = models.CharField(max_length=100)
    prenom = models.CharField(max_length=100)
    telephone = models.CharField(max_length=30, blank=True)
    adresse = models.CharField(max_length=200, blank=True)
    # Rattachement fait par un administrateur une fois le boîtier physiquement installé sur
    # le véhicule — jamais à l'inscription, où le conducteur n'a pas encore de boîtier.
    boitier = models.OneToOneField(
        Boitier, on_delete=models.SET_NULL, null=True, blank=True, related_name='conducteur'
    )
    # Préférences de notification — défauts alignés sur la maquette frontend (PREF_TOGGLES).
    pref_alertes_critiques = models.BooleanField(default=True)
    pref_alertes_vigilance = models.BooleanField(default=True)
    pref_annonce_vocale = models.BooleanField(default=False)
    pref_sensibilite_nuit = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    objects = ConducteurManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['nom', 'prenom']

    def __str__(self):
        return f"{self.email} (conducteur)"
