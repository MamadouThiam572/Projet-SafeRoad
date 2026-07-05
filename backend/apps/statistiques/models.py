from django.db import models

from apps.incidents.models import Incident
from apps.zones.models import Zone


class StatistiquesQuotidiennes(models.Model):
    date = models.DateField()
    zone = models.ForeignKey(
        Zone,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='statistiques_quotidiennes',
        help_text="Null = agrégat global (toutes zones confondues)",
    )
    type_incident = models.CharField(
        max_length=20,
        choices=Incident.TypeIncident.choices,
        null=True,
        blank=True,
        help_text="Null = tous types d'incidents confondus",
    )
    nombre_incidents = models.PositiveIntegerField(default=0)
    nombre_incidents_critiques = models.PositiveIntegerField(default=0)
    nombre_zones_actives = models.PositiveIntegerField(default=0)
    date_generation = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Postgres traite NULL comme distinct dans une contrainte unique : cette contrainte ne bloque
        # donc pas les doublons quand zone/type_incident sont NULL. L'idempotence réelle (une ligne par
        # date/zone/type, y compris les agrégats globaux) est assurée par update_or_create() côté
        # commande generer_statistiques, pas par cette contrainte seule.
        constraints = [
            models.UniqueConstraint(fields=['date', 'zone', 'type_incident'], name='statistique_jour_zone_type_unique')
        ]
        ordering = ['-date']

    def __str__(self):
        return f"Statistiques {self.date} — zone={self.zone_id} — type={self.type_incident}"
