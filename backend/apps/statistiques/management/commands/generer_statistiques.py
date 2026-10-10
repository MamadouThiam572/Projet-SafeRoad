from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.incidents.models import Incident
from apps.signalements.models import Signalement
from apps.zones.models import Zone

from ...models import StatistiquesQuotidiennes


class Command(BaseCommand):
    help = (
        "Génère les statistiques quotidiennes agrégées (globales, par zone, par type). Par défaut : "
        "hier. --jours N recalcule les N derniers jours (rattrape les jours manqués si la tâche "
        "planifiée n'a pas tourné) ; la commande est idempotente."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--date', type=str, default=None,
            help="Date au format AAAA-MM-JJ (par défaut: hier).",
        )
        parser.add_argument(
            '--jours', type=int, default=1,
            help="Nombre de jours à (re)calculer en remontant depuis hier (défaut : 1).",
        )

    def handle(self, *args, **options):
        if options['date']:
            dates = [timezone.datetime.strptime(options['date'], '%Y-%m-%d').date()]
        else:
            hier = timezone.localdate() - timedelta(days=1)
            dates = [hier - timedelta(days=decalage) for decalage in range(max(options['jours'], 1))]
        for date_cible in sorted(dates):
            self._generer(date_cible)

    def _generer(self, date_cible):
        # Les fausses détections écartées par un administrateur ne comptent pas.
        incidents_du_jour = Incident.objects.filter(horodatage__date=date_cible).exclude(
            statut=Incident.Statut.REJETE,
        )
        # Zones publiques : reconnues par l'ANASER et actives.
        nombre_zones_actives = Zone.objects.filter(
            actif=True, statut_validation=Zone.StatutValidation.RECONNUE,
        ).count()

        def _nombre_critiques(queryset):
            return queryset.filter(niveau_gravite=Incident.NiveauGravite.CRITIQUE).count()

        # Agrégat global (toutes zones, tous types confondus)
        StatistiquesQuotidiennes.objects.update_or_create(
            date=date_cible, zone=None, type_incident=None,
            defaults={
                'nombre_incidents': incidents_du_jour.count(),
                'nombre_incidents_critiques': _nombre_critiques(incidents_du_jour),
                'nombre_zones_actives': nombre_zones_actives,
                'nombre_signalements': Signalement.objects.filter(date_creation__date=date_cible).count(),
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
