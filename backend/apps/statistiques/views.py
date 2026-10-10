from datetime import timedelta

from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.alertes.models import Alerte, AlerteProximite
from apps.boitiers.models import Boitier
from apps.comptes.models import Administrateur
from apps.conducteurs.models import Conducteur
from apps.configuration.models import ConfigurationSysteme
from apps.core.permissions import EstAdminOuAnaser, EstConducteur
from apps.core.regionalisation import appliquer_filtre_regional
from apps.core.regions import Region
from apps.incidents.models import Incident
from apps.signalements.models import Signalement
from apps.zones.models import HistoriqueStatutZone, Zone

from .models import StatistiquesQuotidiennes
from .serializers import StatistiquesQuotidiennesSerializer


class StatistiquesDashboardView(APIView):
    permission_classes = [EstAdminOuAnaser]

    def get(self, request):
        # Un administrateur régional ne doit voir que les statistiques de sa région : on
        # réutilise le même mécanisme que les autres ViewSets (FiltreRegional), via
        # 'zone__region' puisque StatistiquesQuotidiennes ne porte pas de région propre
        # (voir apps/statistiques/models.py). Ceci exclut aussi les agrégats globaux
        # (zone=None) pour un admin régional : ce sont des totaux nationaux, jamais une
        # donnée de sa région. super_admin et anaser gardent la portée nationale actuelle.
        queryset = appliquer_filtre_regional(
            StatistiquesQuotidiennes.objects.all().order_by('-date'), request.user, 'zone__region',
        )
        zone_id = request.query_params.get('zone')
        if zone_id:
            queryset = queryset.filter(zone_id=zone_id)
        return Response(StatistiquesQuotidiennesSerializer(queryset[:365], many=True).data)


class StatistiquesPubliquesView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        depuis = timezone.now().date() - timedelta(days=30)
        queryset = StatistiquesQuotidiennes.objects.filter(
            zone__isnull=True, type_incident__isnull=True, date__gte=depuis,
        ).order_by('date')
        return Response(StatistiquesQuotidiennesSerializer(queryset, many=True).data)


# Statuts « à traiter » du point de vue de chaque rôle (zones à valider du tableau de bord).
_ZONES_A_TRAITER_TECHNIQUE = [
    Zone.StatutValidation.PROPOSEE, Zone.StatutValidation.EN_VERIFICATION, Zone.StatutValidation.VALIDEE_TECHNIQUEMENT,
]
_SIGNALEMENTS_EN_ATTENTE = [Signalement.Statut.A_VERIFIER, Signalement.Statut.EN_VERIFICATION]
_ALERTES_ACTIVES = [Alerte.Statut.NOUVELLE, Alerte.Statut.EN_COURS]
JOURS_MAX = 365


def _par_jour(queryset, champ_date, depuis):
    lignes = (
        queryset.filter(**{f'{champ_date}__gte': depuis})
        .annotate(jour=TruncDate(champ_date)).values('jour').annotate(n=Count('id'))
    )
    return {ligne['jour']: ligne['n'] for ligne in lignes}


def _compter_par_region(queryset, champ_region, filtre=None):
    if filtre is not None:
        queryset = queryset.filter(filtre)
    return {ligne[champ_region]: ligne['n'] for ligne in queryset.values(champ_region).annotate(n=Count('id'))}


class TableauDeBordView(APIView):
    """Chiffres du tableau de bord, calculés en direct. Administrateur régional : sa région
    (un ?region= est ignoré). Super admin et ANASER : national, avec le détail par région et
    un filtre ?region= facultatif. ?jours= (défaut 30, max 365) fixe la période."""

    permission_classes = [EstAdminOuAnaser]

    def get(self, request):
        utilisateur = request.user
        try:
            jours = min(max(int(request.query_params.get('jours', 30)), 1), JOURS_MAX)
        except ValueError:
            raise ValidationError({'jours': "Nombre de jours invalide."})

        national = utilisateur.role in ('super_admin', 'anaser')
        region = request.query_params.get('region') if national else utilisateur.region
        if region and region not in Region.values:
            raise ValidationError({'region': "Région inconnue."})

        maintenant = timezone.now()
        aujourd_hui = timezone.localdate()
        depuis = maintenant - timedelta(days=jours)
        config = ConfigurationSysteme.instance()
        limite_en_ligne = maintenant - timedelta(minutes=config.delai_hors_ligne_minutes)

        def perimetre(queryset, champ_region):
            # Un administrateur régional sans région ne voit rien (même règle que FiltreRegional).
            if not national and not region:
                return queryset.none()
            return queryset.filter(**{champ_region: region}) if region else queryset

        boitiers = perimetre(Boitier.objects.all(), 'region')
        incidents = perimetre(Incident.objects.all(), 'boitier__region')
        alertes = perimetre(Alerte.objects.all(), 'boitier__region')
        signalements = perimetre(Signalement.objects.all(), 'region')
        zones = perimetre(Zone.objects.filter(actif=True), 'region')

        incidents_periode = incidents.filter(horodatage__gte=depuis)
        compte_incidents = incidents.aggregate(
            aujourd_hui=Count('id', filter=Q(horodatage__date=aujourd_hui)),
            hier=Count('id', filter=Q(horodatage__date=aujourd_hui - timedelta(days=1))),
            periode=Count('id', filter=Q(horodatage__gte=depuis)),
            critiques=Count('id', filter=Q(horodatage__gte=depuis, niveau_gravite=Incident.NiveauGravite.CRITIQUE)),
        )
        indicateurs = {
            'boitiers': boitiers.aggregate(
                total=Count('id'),
                actifs=Count('id', filter=Q(statut=Boitier.Statut.ACTIF)),
                en_ligne=Count('id', filter=Q(statut=Boitier.Statut.ACTIF, derniere_localisation_maj__gte=limite_en_ligne)),
                affectes=Count('id', filter=Q(conducteur__isnull=False)),
            ),
            'incidents': compte_incidents,
            'alertes': alertes.aggregate(
                actives=Count('id', filter=Q(statut__in=_ALERTES_ACTIVES)),
                nouvelles=Count('id', filter=Q(statut=Alerte.Statut.NOUVELLE)),
                periode=Count('id', filter=Q(date_creation__gte=depuis)),
            ),
            'signalements': signalements.aggregate(
                periode=Count('id', filter=Q(date_creation__gte=depuis)),
                en_attente=Count('id', filter=Q(statut__in=_SIGNALEMENTS_EN_ATTENTE)),
            ),
            'zones': zones.aggregate(
                reconnues=Count('id', filter=Q(statut_validation=Zone.StatutValidation.RECONNUE)),
                en_validation_technique=Count('id', filter=Q(statut_validation__in=_ZONES_A_TRAITER_TECHNIQUE)),
                soumises_anaser=Count('id', filter=Q(statut_validation=Zone.StatutValidation.SOUMISE_ANASER)),
            ),
        }

        series_incidents = _par_jour(incidents, 'horodatage', depuis)
        series_alertes = _par_jour(alertes, 'date_creation', depuis)
        series_signalements = _par_jour(signalements, 'date_creation', depuis)
        series = []
        for decalage in range(jours - 1, -1, -1):
            jour = aujourd_hui - timedelta(days=decalage)
            series.append({
                'date': jour,
                'incidents': series_incidents.get(jour, 0),
                'alertes': series_alertes.get(jour, 0),
                'signalements': series_signalements.get(jour, 0),
            })

        total_periode = compte_incidents['periode']
        repartition = [
            {
                'type': ligne['type_incident'],
                'libelle': Incident.TypeIncident(ligne['type_incident']).label,
                'nombre': ligne['n'],
                'pourcentage': round(100 * ligne['n'] / total_periode, 1),
            }
            for ligne in incidents_periode.values('type_incident').annotate(n=Count('id')).order_by('-n')
        ]

        a_valider = [Zone.StatutValidation.SOUMISE_ANASER] if utilisateur.role == 'anaser' else _ZONES_A_TRAITER_TECHNIQUE
        zones_a_valider = [
            {'id': z.id, 'nom': str(z), 'niveau_danger': z.niveau_danger, 'statut_validation': z.statut_validation,
             'region': z.region, 'nombre_incidents': z.nombre_incidents, 'date_creation': z.date_creation}
            for z in zones.filter(statut_validation__in=a_valider).order_by('-score_danger')[:10]
        ]
        zones_plus_dangereuses = [
            {'id': z.id, 'nom': str(z), 'niveau_danger': z.niveau_danger, 'region': z.region,
             'nombre_incidents': z.nombre_incidents, 'nombre_signalements': z.nombre_signalements,
             'score_danger': z.score_danger}
            for z in zones.filter(statut_validation=Zone.StatutValidation.RECONNUE).order_by('-score_danger')[:5]
        ]

        donnees = {
            'perimetre': {'national': national and not region, 'region': region, 'jours': jours},
            'indicateurs': indicateurs,
            'series': series,
            'repartition_incidents': repartition,
            'zones_a_valider': zones_a_valider,
            'zones_plus_dangereuses': zones_plus_dangereuses,
            'activite_recente': self._activite_recente(incidents, signalements, alertes, region, national),
        }
        if national:
            donnees['par_region'] = self._par_region(depuis, limite_en_ligne)
        return Response(donnees)

    @staticmethod
    def _activite_recente(incidents, signalements, alertes, region, national, nombre=10):
        """Derniers événements toutes sources confondues, du plus récent au plus ancien."""
        evenements = []
        for i in incidents.select_related('boitier').order_by('-horodatage')[:nombre]:
            evenements.append({'type': 'incident', 'titre': f"{i.get_type_incident_display()} détecté",
                               'niveau': i.niveau_gravite, 'region': i.boitier.region, 'date': i.horodatage})
        for s in signalements.order_by('-date_creation')[:nombre]:
            evenements.append({'type': 'signalement', 'titre': f"Signalement : {s.get_type_danger_display()}",
                               'niveau': None, 'region': s.region, 'date': s.date_creation})
        for a in alertes.filter(source=Alerte.Source.BOITIER).select_related('boitier').order_by('-date_creation')[:nombre]:
            evenements.append({'type': 'boitier', 'titre': "Boîtier hors ligne",
                               'niveau': a.niveau, 'region': a.boitier.region, 'date': a.date_creation})
        decisions = HistoriqueStatutZone.objects.select_related('zone')
        if not national or region:
            decisions = decisions.filter(zone__region=region) if region else decisions.none()
        for d in decisions.order_by('-date', '-id')[:nombre]:
            evenements.append({'type': 'zone', 'titre': f"{d.zone} : {d.get_statut_nouveau_display()}",
                               'niveau': d.zone.niveau_danger, 'region': d.zone.region, 'date': d.date})
        evenements.sort(key=lambda e: e['date'], reverse=True)
        return evenements[:nombre]

    @staticmethod
    def _par_region(depuis, limite_en_ligne):
        boitiers = _compter_par_region(Boitier.objects.all(), 'region')
        affectes = _compter_par_region(Boitier.objects.all(), 'region', Q(conducteur__isnull=False))
        hors_ligne = _compter_par_region(
            Boitier.objects.all(), 'region',
            Q(statut=Boitier.Statut.ACTIF, derniere_localisation_maj__lt=limite_en_ligne),
        )
        incidents = _compter_par_region(Incident.objects.filter(horodatage__gte=depuis), 'boitier__region')
        alertes = _compter_par_region(Alerte.objects.filter(date_creation__gte=depuis), 'boitier__region')
        signalements = _compter_par_region(Signalement.objects.filter(date_creation__gte=depuis), 'region')
        signalements_attente = _compter_par_region(
            Signalement.objects.all(), 'region', Q(statut__in=_SIGNALEMENTS_EN_ATTENTE),
        )
        zones = _compter_par_region(
            Zone.objects.filter(actif=True), 'region', Q(statut_validation=Zone.StatutValidation.RECONNUE),
        )
        zones_attente = _compter_par_region(
            Zone.objects.filter(actif=True), 'region', ~Q(statut_validation__in=[
                Zone.StatutValidation.RECONNUE, Zone.StatutValidation.REJETEE, Zone.StatutValidation.ARCHIVEE,
            ]),
        )
        regions_avec_admin_actif = set(
            Administrateur.objects.filter(role=Administrateur.Role.ADMIN, is_active=True)
            .values_list('region', flat=True)
        )
        return [
            {
                'region': slug, 'libelle': libelle,
                'boitiers': boitiers.get(slug, 0), 'affectes': affectes.get(slug, 0),
                'boitiers_hors_ligne': hors_ligne.get(slug, 0),
                'incidents': incidents.get(slug, 0), 'alertes': alertes.get(slug, 0),
                'signalements': signalements.get(slug, 0), 'signalements_en_attente': signalements_attente.get(slug, 0),
                'zones_reconnues': zones.get(slug, 0), 'zones_en_attente': zones_attente.get(slug, 0),
                'admin_actif': slug in regions_avec_admin_actif,
            }
            for slug, libelle in Region.choices
        ]


class TableauDeBordConducteurView(APIView):
    """Résumé du conducteur connecté sur ?jours= (défaut 30) : son boîtier, ses alertes de
    zone et ses signalements. Le score de conduite et les trajets viendront du boîtier."""

    permission_classes = [EstConducteur]

    def get(self, request):
        conducteur = request.user
        try:
            jours = min(max(int(request.query_params.get('jours', 30)), 1), JOURS_MAX)
        except ValueError:
            raise ValidationError({'jours': "Nombre de jours invalide."})
        depuis = timezone.now() - timedelta(days=jours)
        boitier = conducteur.boitier
        alertes = AlerteProximite.objects.filter(conducteur=conducteur, date_creation__gte=depuis)
        return Response({
            'jours': jours,
            'boitier': {
                'id': str(boitier.id), 'immatriculation': boitier.numero_immatriculation or None,
                'statut': boitier.statut, 'derniere_activite': boitier.derniere_localisation_maj,
            } if boitier else None,
            'alertes': alertes.aggregate(
                total=Count('id'),
                critiques=Count('id', filter=Q(zone__niveau_danger=Zone.NiveauDanger.CRITIQUE)),
            ),
            'signalements': Signalement.objects.filter(conducteur=conducteur).aggregate(
                total=Count('id'),
                en_attente=Count('id', filter=Q(statut__in=_SIGNALEMENTS_EN_ATTENTE)),
                valides=Count('id', filter=Q(statut=Signalement.Statut.VALIDE)),
            ),
        })
