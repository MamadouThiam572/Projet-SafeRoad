from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.boitiers.models import Boitier
from apps.conducteurs.models import Conducteur
from apps.core.models import ModeleHorodate
from apps.core.regions import Region

# Rôles autorisés à traiter un signalement (voir Signalement.TRANSITIONS).
_VERIFICATION = frozenset({'admin', 'super_admin'})


class Signalement(ModeleHorodate):
    """Danger routier signalé par un conducteur depuis l'application (position du téléphone),
    à vérifier par l'administrateur de la région concernée."""

    class TypeDanger(models.TextChoices):
        NID_DE_POULE = 'nid_de_poule', 'Nid-de-poule'
        CHAUSSEE_DEGRADEE = 'chaussee_degradee', 'Chaussée dégradée'
        SIGNALISATION_ABSENTE = 'signalisation_absente', 'Signalisation absente'
        CHAUSSEE_INONDEE = 'chaussee_inondee', 'Chaussée inondée'
        OBSTACLE = 'obstacle', 'Obstacle'
        AUTRE = 'autre', 'Autre'

    class Statut(models.TextChoices):
        A_VERIFIER = 'a_verifier', 'À vérifier'
        EN_VERIFICATION = 'en_verification', 'En vérification'
        # Validation technique (admin régional / super admin) ; la reconnaissance officielle
        # appartient à l'ANASER, au niveau des zones (voir apps/zones/models.py).
        VALIDE = 'valide', 'Validé techniquement'
        REJETE = 'rejete', 'Rejeté'

    S = Statut
    # (statut actuel, nouveau statut) -> rôles autorisés. Toute transition absente est refusée.
    TRANSITIONS = {
        (S.A_VERIFIER, S.EN_VERIFICATION): _VERIFICATION,
        (S.A_VERIFIER, S.VALIDE): _VERIFICATION,
        (S.EN_VERIFICATION, S.VALIDE): _VERIFICATION,
        (S.A_VERIFIER, S.REJETE): _VERIFICATION,
        (S.EN_VERIFICATION, S.REJETE): _VERIFICATION,
    }
    # Un rejet doit dire pourquoi : le conducteur et l'historique en gardent la trace.
    TRANSITIONS_A_MOTIVER = {(S.A_VERIFIER, S.REJETE), (S.EN_VERIFICATION, S.REJETE)}
    del S

    # SET_NULL : un compte supprimé ne fait pas disparaître le danger qu'il a signalé.
    conducteur = models.ForeignKey(
        Conducteur, on_delete=models.SET_NULL, null=True, related_name='signalements',
    )
    # Boîtier rattaché au conducteur au moment du signalement (aucun s'il n'en a pas encore).
    boitier = models.ForeignKey(
        Boitier, on_delete=models.SET_NULL, null=True, blank=True, related_name='signalements',
    )
    type_danger = models.CharField(max_length=25, choices=TypeDanger.choices)
    description = models.TextField(blank=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    # Précision annoncée par le GPS du téléphone (API Geolocation du navigateur), en mètres.
    precision_metres = models.FloatField(null=True, blank=True)
    # Déduite de la position (apps.core.geo.region_depuis_gps), jamais saisie par le conducteur.
    region = models.CharField(max_length=20, choices=Region.choices)
    localite = models.CharField(max_length=150, blank=True)
    # Jamais servie publiquement (visages, plaques) : voir SignalementViewSet.photo.
    photo = models.ImageField(upload_to='signalements/%Y/%m/', null=True, blank=True)
    statut = models.CharField(max_length=20, choices=Statut.choices, default=Statut.A_VERIFIER)

    class Meta:
        indexes = [
            models.Index(fields=['region', 'statut']),
            models.Index(fields=['latitude', 'longitude']),
        ]
        ordering = ['-date_creation']

    def __str__(self):
        return f"Signalement #{self.pk} ({self.type_danger}, {self.statut})"


class HistoriqueStatutSignalement(models.Model):
    """Une ligne par décision sur un signalement : qui (et avec quel rôle), quand, de quel
    statut vers quel statut, et pourquoi (motif obligatoire pour un rejet)."""

    signalement = models.ForeignKey(Signalement, on_delete=models.CASCADE, related_name='historique_statuts')
    statut_precedent = models.CharField(max_length=20, choices=Signalement.Statut.choices)
    statut_nouveau = models.CharField(max_length=20, choices=Signalement.Statut.choices)
    acteur = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='decisions_signalements',
    )
    role_acteur = models.CharField(max_length=15)
    commentaire = models.TextField(blank=True)
    date = models.DateTimeField(default=timezone.now)

    class Meta:
        # 'id' départage deux décisions enregistrées dans la même microseconde.
        ordering = ['date', 'id']

    def __str__(self):
        return f"Signalement #{self.signalement_id} : {self.statut_precedent} → {self.statut_nouveau}"
