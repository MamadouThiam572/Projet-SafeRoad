from django.conf import settings
from django.db import models

from apps.boitiers.models import Boitier
from apps.incidents.models import Incident
from apps.zones.models import Zone


class Alerte(models.Model):
    """Fil d'alertes des administrateurs, toutes sources confondues :
    - véhicule : incident moyen ou critique remonté par un boîtier ;
    - zone : le même, survenu dans une zone reconnue par l'ANASER ;
    - boîtier : boîtier actif qui n'envoie plus de données (commande verifier_boitiers_hors_ligne)."""

    class Source(models.TextChoices):
        ZONE = 'zone', 'Zone à risque'
        VEHICULE = 'vehicule', 'Véhicule'
        BOITIER = 'boitier', 'Boîtier'

    class Niveau(models.TextChoices):
        VIGILANCE = 'vigilance', 'Vigilance'
        CRITIQUE = 'critique', 'Critique'

    class Motif(models.TextChoices):
        INCIDENT = 'incident', 'Incident détecté'
        HORS_LIGNE = 'hors_ligne', 'Boîtier hors ligne'

    class Statut(models.TextChoices):
        NOUVELLE = 'nouvelle', 'Nouvelle'
        EN_COURS = 'en_cours', 'En cours'
        TRAITEE = 'traitee', 'Traitée'

    S = Statut
    # « Prendre en charge » puis « Marquer résolue » ; une alerte peut aussi être résolue directement.
    TRANSITIONS = {(S.NOUVELLE, S.EN_COURS), (S.NOUVELLE, S.TRAITEE), (S.EN_COURS, S.TRAITEE)}
    del S

    source = models.CharField(max_length=10, choices=Source.choices, default=Source.VEHICULE)
    niveau = models.CharField(max_length=10, choices=Niveau.choices, default=Niveau.CRITIQUE)
    motif = models.CharField(max_length=15, choices=Motif.choices, default=Motif.INCIDENT)
    incident = models.OneToOneField(Incident, on_delete=models.CASCADE, null=True, blank=True, related_name='alerte')
    zone = models.ForeignKey(Zone, on_delete=models.SET_NULL, null=True, blank=True, related_name='alertes')
    # Toujours renseigné à la création : c'est sa région qui sert au filtrage régional.
    boitier = models.ForeignKey(Boitier, on_delete=models.CASCADE, null=True, related_name='alertes')
    # Conducteur qui portait le boîtier au moment de l'alerte (voir aussi AlerteProximite).
    conducteur = models.ForeignKey(
        'conducteurs.Conducteur', on_delete=models.SET_NULL, null=True, blank=True, related_name='alertes',
    )
    statut = models.CharField(max_length=10, choices=Statut.choices, default=Statut.NOUVELLE)
    prise_en_charge_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='alertes_prises_en_charge'
    )
    prise_en_charge_le = models.DateTimeField(null=True, blank=True)
    traitee_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='alertes_traitees'
    )
    traitee_le = models.DateTimeField(null=True, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['statut', 'source'])]
        ordering = ['-date_creation']

    def __str__(self):
        return f"Alerte {self.source} #{self.pk} ({self.statut})"


class AlerteProximite(models.Model):
    class CanalLed(models.TextChoices):
        VERT = 'vert', 'Vert'
        JAUNE = 'jaune', 'Jaune'
        ROUGE = 'rouge', 'Rouge'

    boitier = models.ForeignKey(Boitier, on_delete=models.CASCADE, related_name='alertes_proximite')
    # Conducteur qui portait le boîtier au moment de l'alerte : un boîtier peut changer de
    # conducteur, et le suivant ne doit pas voir les alertes de son prédécesseur.
    conducteur = models.ForeignKey(
        'conducteurs.Conducteur', on_delete=models.SET_NULL, null=True, blank=True, related_name='alertes_proximite',
    )
    zone = models.ForeignKey(Zone, on_delete=models.CASCADE, related_name='alertes_proximite')
    distance_metres = models.FloatField()
    latitude = models.FloatField()
    longitude = models.FloatField()
    # Canaux déclenchés localement par le boîtier (LED/buzzer/message vocal DFPlayer), déterminés
    # par le niveau_danger de la zone au moment de l'alerte — voir apps.alertes.utils.
    canal_led = models.CharField(max_length=10, choices=CanalLed.choices, default=CanalLed.VERT)
    canal_buzzer_declenche = models.BooleanField(default=False)
    canal_audio_declenche = models.BooleanField(default=False)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['boitier', 'zone', 'date_creation']),
        ]
        ordering = ['-date_creation']

    def __str__(self):
        return f"Proximité {self.boitier_id} → zone {self.zone_id} ({self.distance_metres} m)"
