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
