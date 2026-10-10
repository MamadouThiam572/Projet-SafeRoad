from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class ConfigurationSysteme(models.Model):
    seuil_acceleration_critique = models.FloatField(default=25.0, help_text="m/s², au-delà = incident critique")
    seuil_vitesse_choc = models.FloatField(default=60.0, help_text="km/h, au-delà = incident critique")
    rayon_clustering_metres = models.FloatField(default=300.0)
    min_incidents_pour_zone = models.PositiveIntegerField(default=3)
    rayon_alerte_proximite_metres = models.FloatField(default=1000.0)
    intervalle_sync_secondes = models.PositiveIntegerField(default=60, help_text="Informatif pour le firmware")
    cooldown_alerte_proximite_minutes = models.PositiveIntegerField(default=15)
    duree_grace_regeneration_cle_heures = models.PositiveIntegerField(
        default=24,
        help_text="Durée pendant laquelle l'ancienne clé API d'un boîtier reste valide après régénération, "
                   "le temps de reconfigurer le dispositif sur le terrain.",
    )
    # Fiabilité d'une position GPS du boîtier (module GPS : nombre de satellites et HDOP).
    # En dessous, la position reste enregistrée mais n'entre pas dans le calcul des zones.
    gps_satellites_min = models.PositiveSmallIntegerField(
        default=4, help_text="Nombre minimal de satellites pour une position GPS fiable",
    )
    gps_hdop_max = models.FloatField(
        default=5.0, help_text="HDOP maximal pour une position GPS fiable (plus petit = plus précis)",
    )
    # Les données du boîtier priment : seuls les incidents capteurs créent une zone ; un
    # signalement validé ne fait qu'ajouter ce poids au score d'une zone existante
    # (un incident capteur compte 1, un incident critique 3).
    poids_signalement_valide = models.FloatField(
        default=0.5, help_text="Points ajoutés au score d'une zone par signalement validé dans son rayon",
    )
    # Au-delà de ce délai sans données, un boîtier actif déclenche une alerte « hors ligne »
    # (commande verifier_boitiers_hors_ligne, à planifier toutes les quelques minutes).
    delai_hors_ligne_minutes = models.PositiveIntegerField(
        default=30, help_text="Minutes sans données avant qu'un boîtier actif soit signalé hors ligne",
    )
    date_maj = models.DateTimeField(auto_now=True)
    modifie_par = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)

    def clean(self):
        if self.pk and self.pk != 1:
            raise ValidationError("ConfigurationSysteme est un singleton : une seule ligne (pk=1) est autorisée.")

    def save(self, *args, **kwargs):
        self.pk = 1
        self.full_clean()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("ConfigurationSysteme ne peut pas être supprimée.")

    @classmethod
    def instance(cls):
        return cls.objects.get_or_create(pk=1)[0]

    def __str__(self):
        return "Configuration système"
