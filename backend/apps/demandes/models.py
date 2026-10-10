from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models import ModeleHorodate
from apps.core.regions import Region


class DemandeInstallation(ModeleHorodate):
    """Demande d'équipement envoyée depuis le site public (sans compte), traitée par
    l'administrateur de la région : contact, rendez-vous, puis installation du boîtier.
    Aucune pièce d'identité n'est collectée en ligne : elle est vérifiée sur place le jour de
    l'installation, et seul son numéro est alors enregistré."""

    class TypeVehicule(models.TextChoices):
        VOITURE = 'voiture', 'Voiture particulière'
        TAXI = 'taxi', 'Taxi'
        BUS = 'bus', 'Bus / car'
        CAMION = 'camion', 'Camion'
        MOTO = 'moto', 'Moto'
        AUTRE = 'autre', 'Autre'

    class Statut(models.TextChoices):
        NOUVELLE = 'nouvelle', 'Nouvelle'
        CONTACTEE = 'contactee', 'Contactée'
        RDV_PLANIFIE = 'rdv_planifie', 'Rendez-vous planifié'
        INSTALLEE = 'installee', 'Installée'
        ANNULEE = 'annulee', 'Annulée'

    STATUTS_OUVERTS = (Statut.NOUVELLE, Statut.CONTACTEE, Statut.RDV_PLANIFIE)

    nom = models.CharField(max_length=100)
    prenom = models.CharField(max_length=100)
    telephone = models.CharField(max_length=30)
    email = models.EmailField(blank=True)
    region = models.CharField(max_length=20, choices=Region.choices)
    commune = models.CharField(max_length=100)
    adresse = models.CharField(max_length=200, blank=True)
    type_vehicule = models.CharField(max_length=10, choices=TypeVehicule.choices)
    immatriculation = models.CharField(max_length=30, blank=True)
    nombre_vehicules = models.PositiveSmallIntegerField(default=1)
    disponibilites = models.CharField(max_length=255, blank=True)
    message = models.TextField(blank=True)
    contact_urgence_nom = models.CharField(max_length=150, blank=True)
    contact_urgence_telephone = models.CharField(max_length=30, blank=True)
    # Accord explicite du demandeur pour l'utilisation de ses coordonnées (obligatoire).
    consentement_donnees = models.BooleanField(default=False)

    statut = models.CharField(max_length=15, choices=Statut.choices, default=Statut.NOUVELLE)
    rdv_date = models.DateTimeField(null=True, blank=True)
    rdv_lieu = models.CharField(max_length=200, blank=True)
    # Renseignés à l'installation.
    numero_cni = models.CharField(max_length=30, blank=True)
    conducteur = models.ForeignKey(
        'conducteurs.Conducteur', on_delete=models.SET_NULL, null=True, blank=True, related_name='demandes_installation',
    )
    boitier = models.ForeignKey(
        'boitiers.Boitier', on_delete=models.SET_NULL, null=True, blank=True, related_name='demandes_installation',
    )

    class Meta:
        indexes = [models.Index(fields=['region', 'statut'])]
        ordering = ['-date_creation']

    def __str__(self):
        return f"Demande #{self.pk} — {self.prenom} {self.nom} ({self.statut})"


class HistoriqueDemande(models.Model):
    """Chaque étape du traitement d'une demande : qui, quand, quel statut, quelle note."""

    demande = models.ForeignKey(DemandeInstallation, on_delete=models.CASCADE, related_name='historique')
    statut_precedent = models.CharField(max_length=15, choices=DemandeInstallation.Statut.choices)
    statut_nouveau = models.CharField(max_length=15, choices=DemandeInstallation.Statut.choices)
    acteur = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='actions_demandes',
    )
    role_acteur = models.CharField(max_length=15)
    commentaire = models.TextField(blank=True)
    date = models.DateTimeField(default=timezone.now)

    class Meta:
        # 'id' départage deux étapes enregistrées dans la même microseconde.
        ordering = ['date', 'id']

    def __str__(self):
        return f"Demande #{self.demande_id} : {self.statut_precedent} → {self.statut_nouveau}"


class MessageContact(models.Model):
    """Message envoyé depuis la page Contact du site (hors demande d'installation)."""

    class Sujet(models.TextChoices):
        QUESTION = 'question', 'Question générale'
        SIGNALEMENT = 'signalement', 'Signalement'
        SUGGESTION = 'suggestion', 'Suggestion'
        PARTENARIAT = 'partenariat', 'Partenariat'
        SUPPORT = 'support', 'Support technique'
        AUTRE = 'autre', 'Autre'

    nom = models.CharField(max_length=150)
    email = models.EmailField()
    telephone = models.CharField(max_length=30, blank=True)
    sujet = models.CharField(max_length=15, choices=Sujet.choices)
    message = models.TextField()
    traite = models.BooleanField(default=False)
    traite_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='messages_traites',
    )
    traite_le = models.DateTimeField(null=True, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date_creation']

    def __str__(self):
        return f"Message de {self.nom} ({self.sujet})"
