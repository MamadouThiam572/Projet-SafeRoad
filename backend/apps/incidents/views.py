from django.db import transaction
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.pagination import CursorPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.boitiers.models import HistoriqueSync
from apps.configuration.models import ConfigurationSysteme
from apps.core.permissions import EstAdministrateur, EstAdminOuAnaser, EstBoitier
from apps.core.regionalisation import FiltreRegional

from .models import Incident, ObservationIncident
from .serializers import IncidentIngestionSerializer, IncidentSerializer, ObservationIncidentSerializer
from .utils import calculer_gravite, position_gps_fiable


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
            vitesse_gps=serializer.validated_data.get('vitesse_gps'),
        )
        position_fiable = position_gps_fiable(
            config, serializer.validated_data.get('hdop'), serializer.validated_data.get('nombre_satellites'),
        )
        incident = serializer.save(
            boitier=request.user, synced=True, niveau_gravite=niveau_gravite, position_fiable=position_fiable,
        )
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
                vitesse_gps=donnees.get('vitesse_gps'),
            )
            incidents_crees.append(Incident.objects.create(
                boitier=request.user, synced=False, historique_sync=historique,
                niveau_gravite=niveau_gravite,
                position_fiable=position_gps_fiable(config, donnees.get('hdop'), donnees.get('nombre_satellites')),
                **donnees,
            ))

        return Response({
            'historique_sync_id': historique.id,
            'nombre_incidents_crees': len(incidents_crees),
        }, status=201)


class IncidentViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    # Les incidents sont créés exclusivement par les boîtiers (IngestionView/SyncBatchView) :
    # ni création, ni modification des données capteurs ici. Seul leur traitement
    # administratif (statut, observations) est modifiable, par un administrateur.
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

    def get_permissions(self):
        if self.action in ('changer_statut', 'ajouter_observation'):
            # ANASER consulte les incidents mais ne les traite pas.
            return [EstAdministrateur()]
        return super().get_permissions()

    def _tracer(self, incident, texte, statut_precedent='', statut_nouveau=''):
        ObservationIncident.objects.create(
            incident=incident, statut_precedent=statut_precedent, statut_nouveau=statut_nouveau, texte=texte,
            acteur=self.request.user, role_acteur=getattr(self.request.user, 'role', ''),
        )

    @action(detail=True, methods=['patch'], url_path='statut')
    def changer_statut(self, request, pk=None):
        incident = self.get_object()
        ancien = incident.statut
        nouveau = request.data.get('statut')
        commentaire = (request.data.get('commentaire') or '').strip()
        role = getattr(request.user, 'role', None)

        roles_autorises = Incident.TRANSITIONS.get((ancien, nouveau)) if isinstance(nouveau, str) else None
        if roles_autorises is None:
            raise ValidationError({'statut': f"Transition impossible : « {ancien} » → « {nouveau} »."})
        if role not in roles_autorises:
            raise PermissionDenied("Votre rôle ne permet pas cette décision sur l'incident.")
        if (ancien, nouveau) in Incident.TRANSITIONS_A_MOTIVER and not commentaire:
            raise ValidationError({'commentaire': "Le rejet d'une donnée capteur doit être motivé."})

        with transaction.atomic():
            incident.statut = nouveau
            incident.save(update_fields=['statut'])
            self._tracer(incident, commentaire, ancien, nouveau)
        return Response(IncidentSerializer(incident).data)

    @action(detail=True, methods=['post'], url_path='observations')
    def ajouter_observation(self, request, pk=None):
        incident = self.get_object()
        texte = (request.data.get('texte') or '').strip()
        if not texte:
            raise ValidationError({'texte': "L'observation est vide."})
        self._tracer(incident, texte)
        return Response(ObservationIncidentSerializer(incident.observations.last()).data, status=201)

    @action(detail=True, methods=['get'])
    def historique(self, request, pk=None):
        incident = self.get_object()
        entrees = incident.observations.select_related('acteur')
        return Response(ObservationIncidentSerializer(entrees, many=True).data)
