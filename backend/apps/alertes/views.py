from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.pagination import PaginationListeGestion
from apps.core.permissions import EstAdministrateur, EstConducteur
from apps.core.regionalisation import FiltreRegional

from .models import Alerte, AlerteProximite
from .serializers import AlerteConducteurSerializer, AlerteProximiteSerializer, AlerteSerializer


class AlerteViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = Alerte.objects.all().select_related('incident', 'zone', 'boitier', 'conducteur')
    serializer_class = AlerteSerializer
    permission_classes = [EstAdministrateur]
    pagination_class = PaginationListeGestion
    # Super admin : toutes les alertes. Administrateur régional : celles des boîtiers de sa
    # région (queryset vide si region=None), quelle que soit la source. ANASER n'y a pas accès.
    # S'applique aussi à `statut` via get_object() -> filter_queryset(get_queryset()).
    filter_backends = [FiltreRegional]
    region_lookup_field = 'boitier__region'

    @action(detail=True, methods=['patch'], url_path='statut')
    def changer_statut(self, request, pk=None):
        """« Prendre en charge » (nouvelle -> en_cours) puis « Marquer résolue » (-> traitee)."""
        alerte = self.get_object()
        nouveau = request.data.get('statut')
        if not isinstance(nouveau, str) or (alerte.statut, nouveau) not in Alerte.TRANSITIONS:
            return Response({'statut': f"Transition impossible : « {alerte.statut} » → « {nouveau} »."}, status=400)
        maintenant = timezone.now()
        alerte.statut = nouveau
        champs = ['statut']
        if nouveau == Alerte.Statut.EN_COURS:
            alerte.prise_en_charge_par, alerte.prise_en_charge_le = request.user, maintenant
            champs += ['prise_en_charge_par', 'prise_en_charge_le']
        else:
            alerte.traitee_par, alerte.traitee_le = request.user, maintenant
            champs += ['traitee_par', 'traitee_le']
        alerte.save(update_fields=champs)
        return Response(AlerteSerializer(alerte).data)


class AlerteProximiteViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = AlerteProximite.objects.all().select_related('boitier', 'zone')
    serializer_class = AlerteProximiteSerializer
    permission_classes = [EstAdministrateur]
    # boitier est une FK directe (pas seulement zone) : ancrage le plus fiable pour la
    # région, cohérent avec Boitier.region (étape 4A) sans toucher à Zone (hors périmètre).
    filter_backends = [FiltreRegional]
    region_lookup_field = 'boitier__region'


class AlerteConducteurViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Alertes de zone reçues par le conducteur connecté (uniquement celles déclenchées
    pendant qu'il portait le boîtier). Pagination optionnelle (?page=)."""

    serializer_class = AlerteConducteurSerializer
    permission_classes = [EstConducteur]
    pagination_class = PaginationListeGestion

    def get_queryset(self):
        return AlerteProximite.objects.filter(conducteur=self.request.user).select_related('zone')
