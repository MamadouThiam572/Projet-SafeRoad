from django.core.management.base import BaseCommand
from django.db import transaction

from apps.boitiers.models import Boitier
from apps.core.regions import Region
from apps.zones.models import Zone


class Command(BaseCommand):
    help = (
        "Corrige les données de test/démo créées avant l'introduction du filtrage régional : "
        "assigne une région aux boîtiers et zones existants qui n'en ont encore aucune "
        "(region=NULL). Idempotent — un boîtier ou une zone déjà régionalisé n'est jamais "
        "modifié, aucun autre champ n'est touché. À ne pas rejouer aveuglément une fois que "
        "de nouveaux boîtiers légitimement non régionalisés existeront : vérifier alors "
        "manuellement lesquels doivent recevoir --region avant de l'exécuter."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--region', default=Region.DAKAR,
            help=f"Région à assigner aux boîtiers/zones sans région (défaut : {Region.DAKAR}).",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        region = options['region']
        if region not in Region.values:
            self.stderr.write(self.style.ERROR(
                f"Région inconnue : {region!r}. Valeurs valides : {list(Region.values)}"
            ))
            return

        boitiers = Boitier.objects.filter(region__isnull=True)
        zones = Zone.objects.filter(region__isnull=True)

        ids_boitiers = list(boitiers.values_list('id', flat=True))
        ids_zones = list(zones.values_list('id', flat=True))

        nb_boitiers = boitiers.update(region=region)
        nb_zones = zones.update(region=region)

        self.stdout.write(self.style.SUCCESS(
            f"{nb_boitiers} boîtier(s) mis à jour vers region={region} : {ids_boitiers}"
        ))
        self.stdout.write(self.style.SUCCESS(
            f"{nb_zones} zone(s) mise(s) à jour vers region={region} : {ids_zones}"
        ))
        if nb_boitiers == 0 and nb_zones == 0:
            self.stdout.write("Rien à corriger : plus aucun boîtier/zone sans région.")
