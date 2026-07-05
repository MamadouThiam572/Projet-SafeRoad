from django.core.management.base import BaseCommand

from apps.zones.clustering import generer_zones_depuis_incidents


class Command(BaseCommand):
    help = "Recalcule les zones accidentogènes par clustering DBSCAN des incidents géolocalisés."

    def handle(self, *args, **options):
        resultat = generer_zones_depuis_incidents()
        self.stdout.write(self.style.SUCCESS(
            f"Zones créées: {resultat['zones_creees']} — "
            f"Zones mises à jour: {resultat['zones_mises_a_jour']} — "
            f"Incidents traités: {resultat['incidents_traites']}"
        ))
