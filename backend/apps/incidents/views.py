from rest_framework import mixins, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.boitiers.models import HistoriqueSync
from apps.configuration.models import ConfigurationSysteme
from apps.core.permissions import EstAdminOuAnaser, EstBoitier

from .models import Incident
from .serializers import IncidentIngestionSerializer, IncidentSerializer
from .utils import calculer_gravite


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
    queryset = Incident.objects.all().select_related('boitier', 'zone')
    serializer_class = IncidentSerializer
    permission_classes = [EstAdminOuAnaser]
