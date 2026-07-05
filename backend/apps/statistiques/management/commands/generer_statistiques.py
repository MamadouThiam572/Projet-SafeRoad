from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.incidents.models import Incident
from apps.zones.models import Zone

from ...models import StatistiquesQuotidiennes


class Command(BaseCommand):
    help = "Génère les statistiques quotidiennes agrégées (globales, par zone, par type) pour une date donnée."

    def add_arguments(self, parser):
        parser.add_argument(
            '--date', type=str, default=None,
            help="Date au format AAAA-MM-JJ (par défaut: hier).",
        )

    def handle(self, *args, **options):
        if options['date']:
            date_cible = timezone.datetime.strptime(options['date'], '%Y-%m-%d').date()
        else:
            date_cible = timezone.now().date() - timedelta(days=1)

        incidents_du_jour = Incident.objects.filter(horodatage__date=date_cible)
        nombre_zones_actives = Zone.objects.filter(actif=True).count()

        def _nombre_critiques(queryset):
            return queryset.filter(niveau_gravite=Incident.NiveauGravite.CRITIQUE).count()

        # Agrégat global (toutes zones, tous types confondus)
        StatistiquesQuotidiennes.objects.update_or_create(
            date=date_cible, zone=None, type_incident=None,
            defaults={
                'nombre_incidents': incidents_du_jour.count(),
                'nombre_incidents_critiques': _nombre_critiques(incidents_du_jour),
                'nombre_zones_actives': nombre_zones_actives,
            },
        )

        # Agrégat par type d'incident (toutes zones confondues)
        for type_incident, _ in Incident.TypeIncident.choices:
            incidents_du_type = incidents_du_jour.filter(type_incident=type_incident)
            if not incidents_du_type.exists():
                continue
            StatistiquesQuotidiennes.objects.update_or_create(
                date=date_cible, zone=None, type_incident=type_incident,
                defaults={
                    'nombre_incidents': incidents_du_type.count(),
                    'nombre_incidents_critiques': _nombre_critiques(incidents_du_type),
                    'nombre_zones_actives': nombre_zones_actives,
                },
            )

        # Agrégat par zone (tous types confondus)
        for zone in Zone.objects.filter(actif=True):
            incidents_de_la_zone = incidents_du_jour.filter(zone=zone)
            if not incidents_de_la_zone.exists():
                continue
            StatistiquesQuotidiennes.objects.update_or_create(
                date=date_cible, zone=zone, type_incident=None,
                defaults={
                    'nombre_incidents': incidents_de_la_zone.count(),
                    'nombre_incidents_critiques': _nombre_critiques(incidents_de_la_zone),
                    'nombre_zones_actives': nombre_zones_actives,
                },
            )

        self.stdout.write(self.style.SUCCESS(f"Statistiques générées pour le {date_cible}."))
