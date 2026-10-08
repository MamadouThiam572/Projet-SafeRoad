from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models import ModeleHorodate
from apps.core.regions import Region

# Rôles autorisés pour chaque étape du workflow de validation (voir Zone.TRANSITIONS).
_VALIDATION_TECHNIQUE = frozenset({'admin', 'super_admin'})
_VALIDATION_INSTITUTIONNELLE = frozenset({'anaser'})
_ADMINISTRATION = frozenset({'super_admin'})


class Zone(ModeleHorodate):
    class NiveauDanger(models.TextChoices):
        NORMALE = 'normale', 'Normale'
        VIGILANCE = 'vigilance', 'Vigilance'
        CRITIQUE = 'critique', 'Critique'

    class StatutValidation(models.TextChoices):
        # Validation en deux étapes : technique (administrateur régional, ou super admin),
        # puis institutionnelle (ANASER). Chaque libellé dit qui a décidé quoi.
        PROPOSEE = 'proposee', 'Proposée'
        EN_VERIFICATION = 'en_verification', 'En vérification'
        VALIDEE_TECHNIQUEMENT = 'validee_technique', 'Validée techniquement'
        SOUMISE_ANASER = 'soumise_anaser', 'Soumise à ANASER'
        RECONNUE = 'reconnue', 'Reconnue par ANASER'
        REJETEE = 'rejetee', 'Rejetée'
        ARCHIVEE = 'archivee', 'Archivée'

    S = StatutValidation
    # (statut actuel, nouveau statut) -> rôles autorisés. Toute transition absente est refusée.
    TRANSITIONS = {
        (S.PROPOSEE, S.EN_VERIFICATION): _VALIDATION_TECHNIQUE,
        (S.PROPOSEE, S.VALIDEE_TECHNIQUEMENT): _VALIDATION_TECHNIQUE,
        (S.EN_VERIFICATION, S.VALIDEE_TECHNIQUEMENT): _VALIDATION_TECHNIQUE,
        (S.VALIDEE_TECHNIQUEMENT, S.SOUMISE_ANASER): _VALIDATION_TECHNIQUE,
        (S.PROPOSEE, S.REJETEE): _VALIDATION_TECHNIQUE,
        (S.EN_VERIFICATION, S.REJETEE): _VALIDATION_TECHNIQUE,
        (S.VALIDEE_TECHNIQUEMENT, S.REJETEE): _VALIDATION_TECHNIQUE,
        (S.SOUMISE_ANASER, S.RECONNUE): _VALIDATION_INSTITUTIONNELLE,
        (S.SOUMISE_ANASER, S.REJETEE): _VALIDATION_INSTITUTIONNELLE,
        # Demande d'informations complémentaires : la zone repart en vérification technique.
        (S.SOUMISE_ANASER, S.EN_VERIFICATION): _VALIDATION_INSTITUTIONNELLE,
        (S.RECONNUE, S.ARCHIVEE): _ADMINISTRATION,
        (S.REJETEE, S.ARCHIVEE): _ADMINISTRATION,
    }
    # Décisions qui doivent être motivées (« sur quelles bases ? ») dans l'historique.
    TRANSITIONS_A_MOTIVER = {
        (S.PROPOSEE, S.REJETEE),
        (S.EN_VERIFICATION, S.REJETEE),
        (S.VALIDEE_TECHNIQUEMENT, S.REJETEE),
        (S.SOUMISE_ANASER, S.REJETEE),
        (S.SOUMISE_ANASER, S.EN_VERIFICATION),
    }
    del S

    nom = models.CharField(max_length=150, blank=True)
    # Région déduite après coup de la majorité des boîtiers des incidents contributeurs
    # (voir clustering.py `_region_majoritaire`) — jamais du clustering lui-même, qui reste
    # national. Null si aucune région n'est clairement majoritaire, ou si le clustering
    # n'a pas encore tourné sur cette zone.
    region = models.CharField(max_length=20, choices=Region.choices, null=True, blank=True)
    latitude_centre = models.FloatField(db_index=True)
    longitude_centre = models.FloatField(db_index=True)
    rayon_metres = models.FloatField()
    nombre_incidents = models.PositiveIntegerField(default=0)
    score_danger = models.FloatField(default=0)
    niveau_danger = models.CharField(max_length=10, choices=NiveauDanger.choices, default=NiveauDanger.NORMALE)
    # Qui a décidé quoi et quand : voir HistoriqueStatutZone, seule source de traçabilité.
    statut_validation = models.CharField(
        max_length=20, choices=StatutValidation.choices, default=StatutValidation.PROPOSEE
    )
    actif = models.BooleanField(default=True)

    class Meta:
        indexes = [
            models.Index(fields=['statut_validation']),
            models.Index(fields=['actif']),
        ]

    def __str__(self):
        return self.nom or f"Zone #{self.pk}"


class HistoriqueStatutZone(models.Model):
    """Une ligne par décision du workflow de validation : qui (et avec quel rôle au moment
    de la décision), quand, de quel statut vers quel statut, et sur quelles bases."""

    zone = models.ForeignKey(Zone, on_delete=models.CASCADE, related_name='historique_statuts')
    statut_precedent = models.CharField(max_length=20, choices=Zone.StatutValidation.choices)
    statut_nouveau = models.CharField(max_length=20, choices=Zone.StatutValidation.choices)
    acteur = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='decisions_zones'
    )
    # Copie du rôle au moment de la décision : il reste lisible même si le compte change de rôle.
    role_acteur = models.CharField(max_length=15)
    commentaire = models.TextField(blank=True)
    date = models.DateTimeField(default=timezone.now)

    class Meta:
        # 'id' départage deux décisions enregistrées dans la même microseconde.
        ordering = ['date', 'id']

    def __str__(self):
        return f"Zone #{self.zone_id} : {self.statut_precedent} → {self.statut_nouveau}"
