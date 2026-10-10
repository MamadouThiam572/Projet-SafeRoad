from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.core.exceptions import ValidationError
from django.db import models

from apps.core.regions import Region


class AdministrateurManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("L'email est obligatoire")
        email = self.normalize_email(email)
        extra_fields.setdefault('role', Administrateur.Role.ADMIN)
        utilisateur = self.model(email=email, **extra_fields)
        utilisateur.set_password(password)
        utilisateur.save(using=self._db)
        return utilisateur

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', Administrateur.Role.ADMIN)
        return self.create_user(email, password, **extra_fields)


class Administrateur(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        ADMIN = 'admin', 'Administrateur régional'
        SUPER_ADMIN = 'super_admin', 'Super administrateur'
        ANASER = 'anaser', 'ANASER'

    email = models.EmailField(unique=True)
    nom = models.CharField(max_length=100)
    prenom = models.CharField(max_length=100)
    telephone = models.CharField(max_length=30, blank=True)
    role = models.CharField(max_length=15, choices=Role.choices, default=Role.ADMIN)
    # Portée régionale du compte : obligatoire pour un administrateur régional (role=admin),
    # toujours vide pour un super administrateur (portée nationale) ou un compte ANASER
    # (périmètre actuel, pas de restriction régionale automatique — voir étude d'architecture).
    region = models.CharField(max_length=20, choices=Region.choices, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    derniere_connexion = models.DateTimeField(null=True, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    objects = AdministrateurManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['nom', 'prenom']

    @staticmethod
    def erreur_coherence_role_region(role, region):
        """Règle unique rôle/région, réutilisée par le modèle (clean()) et par les
        serializers d'écriture (AdministrateurSerializer/AdministrateurCreationSerializer) —
        une seule source de vérité pour ne jamais laisser les deux diverger.
        Retourne un message d'erreur, ou None si cohérent."""
        if role == Administrateur.Role.ADMIN and not region:
            return "Un administrateur régional doit être rattaché à une région."
        if role in (Administrateur.Role.SUPER_ADMIN, Administrateur.Role.ANASER) and region:
            return "Ce rôle ne doit pas avoir de région associée."
        return None

    def clean(self):
        super().clean()
        erreur = self.erreur_coherence_role_region(self.role, self.region)
        if erreur:
            raise ValidationError({'region': erreur})

    def __str__(self):
        return f"{self.email} ({self.role})"
