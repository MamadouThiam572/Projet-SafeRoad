from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.alertes.models import Alerte
from apps.boitiers.models import Boitier
from apps.configuration.models import ConfigurationSysteme


class Command(BaseCommand):
    help = (
        "Crée une alerte « boîtier hors ligne » pour chaque boîtier actif silencieux depuis plus "
        "de ConfigurationSysteme.delai_hors_ligne_minutes. À planifier (tâche Windows / cron) "
        "toutes les 5 minutes. Un boîtier qui n'a encore jamais émis n'est pas concerné, et une "
        "alerte encore ouverte n'est pas dupliquée."
    )

    def handle(self, *args, **options):
        delai = ConfigurationSysteme.instance().delai_hors_ligne_minutes
        limite = timezone.now() - timezone.timedelta(minutes=delai)
        silencieux = Boitier.objects.filter(
            statut=Boitier.Statut.ACTIF, derniere_localisation_maj__lt=limite,
        ).exclude(
            alertes__motif=Alerte.Motif.HORS_LIGNE,
            alertes__statut__in=[Alerte.Statut.NOUVELLE, Alerte.Statut.EN_COURS],
        ).select_related('conducteur')

        crees = 0
        for boitier in silencieux:
            Alerte.objects.create(
                source=Alerte.Source.BOITIER, niveau=Alerte.Niveau.VIGILANCE, motif=Alerte.Motif.HORS_LIGNE,
                boitier=boitier, conducteur=getattr(boitier, 'conducteur', None),
            )
            crees += 1
        self.stdout.write(f"{crees} alerte(s) « boîtier hors ligne » créée(s) (délai : {delai} min).")
