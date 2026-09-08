from rest_framework import mixins, viewsets
from rest_framework.pagination import CursorPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.boitiers.models import HistoriqueSync
from apps.configuration.models import ConfigurationSysteme
from apps.core.permissions import EstAdminOuAnaser, EstBoitier
from apps.core.regionalisation import FiltreRegional

from .models import Incident
from .serializers import IncidentIngestionSerializer, IncidentSerializer
from .utils import calculer_gravite


class IncidentCursorPagination(CursorPagination):
    # Cursor plutôt que numéro de page : Incident grandit en continu (flux IoT), et un
    # OFFSET sur une table sans cesse alimentée dégraderait la pagination par page.
    page_size = 25
    ordering = '-horodatage'


class IngestionView(APIView):
    permission_classes = [EstBoitier]

    def post(self, request):
        serializer = IncidentIngestionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        config = ConfigurationSysteme.instance()
        niveau_gravite = calculer_gravite(
            config,
            serializer.validated_data.get('vitesse_radar'),
            serializer.validated_data.get('acceleration_x'),
            serializer.validated_data.get('acceleration_y'),
            serializer.validated_data.get('acceleration_z'),
        )
        incident = serializer.save(boitier=request.user, synced=True, niveau_gravite=niveau_gravite)
        return Response(IncidentSerializer(incident).data, status=201)


class SyncBatchView(APIView):
    permission_classes = [EstBoitier]

    def post(self, request):
        incidents_data = request.data.get('incidents', [])
        serializer = IncidentIngestionSerializer(data=incidents_data, many=True)
        serializer.is_valid(raise_exception=True)

        config = ConfigurationSysteme.instance()
        historique = HistoriqueSync.objects.create(
            boitier=request.user, nombre_incidents_synchronises=len(serializer.validated_data), succes=True,
        )
        incidents_crees = []
        for donnees in serializer.validated_data:
            niveau_gravite = calculer_gravite(
                config,
                donnees.get('vitesse_radar'),
                donnees.get('acceleration_x'),
                donnees.get('acceleration_y'),
                donnees.get('acceleration_z'),
            )
            incidents_crees.append(Incident.objects.create(
                boitier=request.user, synced=False, historique_sync=historique,
                niveau_gravite=niveau_gravite, **donnees,
            ))

        return Response({
            'historique_sync_id': historique.id,
            'nombre_incidents_crees': len(incidents_crees),
        }, status=201)


class IncidentViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    # Lecture seule (List + Retrieve) : aucune action d'écriture n'existe sur ce ViewSet,
    # les incidents sont créés exclusivement via IngestionView/SyncBatchView (EstBoitier),
    # jamais par un compte administrateur — rien à protéger côté POST/PATCH/PUT/DELETE ici.
    queryset = Incident.objects.all().select_related('boitier', 'zone')
    serializer_class = IncidentSerializer
    permission_classes = [EstAdminOuAnaser]
    pagination_class = IncidentCursorPagination
    # Super admin : tous les incidents. Administrateur régional : uniquement ceux dont le
    # boîtier est affecté à sa région (queryset vide si region=None). ANASER : comportement
    # inchangé (FiltreRegional ne restreint que role='admin'). S'applique à list() ET à
    # retrieve() via get_object() -> filter_queryset(get_queryset()) : un incident d'une
    # autre région renvoie 404, comme s'il n'existait pas.
    filter_backends = [FiltreRegional]
    region_lookup_field = 'boitier__region'
