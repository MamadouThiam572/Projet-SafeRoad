import uuid

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.db import models
from django.utils import timezone

from apps.core.regions import Region


class Boitier(models.Model):
    class Statut(models.TextChoices):
        # État administratif/opérationnel — fixé par un administrateur, jamais déduit
        # automatiquement. À ne pas confondre avec l'absence de communication récente
        # (aucun signal fiable et unifié pour ça aujourd'hui, voir HistoriqueSync/
        # derniere_localisation_maj) ni avec la position GPS (derniere_latitude/longitude).
        ACTIF = 'actif', 'Actif'
        INACTIF = 'inactif', 'Arrêt volontaire'
        MAINTENANCE = 'maintenance', 'Maintenance'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    api_key_hash = models.CharField(max_length=128)
    # Fenêtre de grâce après régénération : l'ancienne clé reste valide jusqu'à expiration,
    # le temps qu'un agent reconfigure physiquement le boîtier sur le terrain.
    api_key_hash_ancien = models.CharField(max_length=128, blank=True, default='')
    api_key_hash_ancien_expire_le = models.DateTimeField(null=True, blank=True)
    proprietaire_nom = models.CharField(max_length=150, blank=True)
    proprietaire_telephone = models.CharField(max_length=30, blank=True)
    numero_immatriculation = models.CharField(max_length=30, blank=True)
    # Région administrative d'affectation du boîtier — distincte de sa position GPS réelle
    # (derniere_latitude/longitude ci-dessous) : un boîtier affecté à Dakar peut circuler
    # ailleurs. Jamais déduite automatiquement du GPS. Reste nullable au niveau du modèle
    # pour les boîtiers historiques (créés avant le filtrage régional, corrigés une fois via
    # la commande corriger_region_donnees_test) ; toute création via l'API l'exige désormais
    # (voir BoitierCreationSerializer.extra_kwargs).
    region = models.CharField(max_length=20, choices=Region.choices, null=True, blank=True)
    derniere_latitude = models.FloatField(null=True, blank=True)
    derniere_longitude = models.FloatField(null=True, blank=True)
    derniere_localisation_maj = models.DateTimeField(null=True, blank=True)
    # Dernières données du module GPS reçues avec la position (supervision / Monitoring).
    derniere_vitesse_gps = models.FloatField(null=True, blank=True, help_text="km/h")
    dernier_hdop = models.FloatField(null=True, blank=True)
    dernier_nombre_satellites = models.PositiveSmallIntegerField(null=True, blank=True)
    # Date/heure GPS de cette position, envoyée par le boîtier. Comparée à
    # derniere_localisation_maj (heure de réception serveur), elle donne la latence de transmission.
    derniere_position_horodatage = models.DateTimeField(null=True, blank=True)
    statut = models.CharField(max_length=15, choices=Statut.choices, default=Statut.ACTIF)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_maj = models.DateTimeField(auto_now=True)

    def set_api_key(self, api_key_en_clair):
        self.api_key_hash = make_password(api_key_en_clair)

    def regenerer_api_key(self, api_key_en_clair, duree_grace_heures):
        """Régénère la clé en gardant l'ancienne valide `duree_grace_heures` de plus,
        pour laisser le temps à un agent de terrain de reconfigurer le dispositif."""
        self.api_key_hash_ancien = self.api_key_hash
        self.api_key_hash_ancien_expire_le = timezone.now() + timezone.timedelta(hours=duree_grace_heures)
        self.api_key_hash = make_password(api_key_en_clair)

    def verifier_api_key(self, api_key_en_clair):
        if check_password(api_key_en_clair, self.api_key_hash):
            return True
        if (
            self.api_key_hash_ancien
            and self.api_key_hash_ancien_expire_le
            and timezone.now() < self.api_key_hash_ancien_expire_le
        ):
            return check_password(api_key_en_clair, self.api_key_hash_ancien)
        return False

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


class HistoriqueBoitier(models.Model):
    """Vie administrative d'un boîtier : enregistrement, puis chaque affectation /
    désaffectation à un conducteur — qui l'a faite, quand, et pour quel conducteur."""

    class Evenement(models.TextChoices):
        ENREGISTRE = 'enregistre', 'Enregistré'
        AFFECTE = 'affecte', 'Affecté'
        DESAFFECTE = 'desaffecte', 'Désaffecté'

    boitier = models.ForeignKey(Boitier, on_delete=models.CASCADE, related_name='historique')
    evenement = models.CharField(max_length=15, choices=Evenement.choices)
    # Référence par chaîne : conducteurs.Conducteur dépend déjà de ce module (Conducteur.boitier).
    conducteur = models.ForeignKey(
        'conducteurs.Conducteur', on_delete=models.SET_NULL, null=True, blank=True, related_name='historique_boitiers',
    )
    acteur = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='actions_boitiers',
    )
    role_acteur = models.CharField(max_length=15, blank=True)
    commentaire = models.TextField(blank=True)
    date = models.DateTimeField(default=timezone.now)

    class Meta:
        # 'id' départage deux événements enregistrés dans la même microseconde.
        ordering = ['-date', '-id']

    def __str__(self):
        return f"Boîtier {self.boitier_id} : {self.evenement}"
