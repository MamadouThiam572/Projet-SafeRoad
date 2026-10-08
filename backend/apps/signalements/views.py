from django.db import transaction
from django.http import FileResponse, Http404
from geopy.distance import geodesic
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.conducteurs.models import Conducteur
from apps.configuration.models import ConfigurationSysteme
from apps.core.geo import boite_englobante
from apps.core.pagination import PaginationListeGestion
from apps.core.permissions import EstAdministrateur, EstAdminOuAnaser, EstConducteur
from apps.core.regionalisation import FiltreRegional
from apps.incidents.models import Incident

from .models import HistoriqueStatutSignalement, Signalement
from .serializers import (
    HistoriqueStatutSignalementSerializer,
    SignalementAnaserSerializer,
    SignalementCreationSerializer,
    SignalementSerializer,
)

# Garde-fou : nombre maximal d'incidents renvoyés autour d'un signalement.
MAX_INCIDENTS_PROCHES = 50


class SignalementViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin,
                         viewsets.GenericViewSet):
    """Conducteur : crée et consulte ses propres signalements. Administrateur régional : ceux
    de sa région (FiltreRegional sur `region`, déduite du GPS). Super admin : tous. ANASER :
    tous, en lecture seule et sans identité du conducteur."""

    pagination_class = PaginationListeGestion
    filter_backends = [FiltreRegional]
    region_lookup_field = 'region'
    throttle_scope = 'signalement'

    def get_permissions(self):
        if self.action == 'create':
            return [EstConducteur()]
        if self.action in ('list', 'retrieve', 'photo'):
            return [(EstConducteur | EstAdminOuAnaser)()]
        if self.action == 'changer_statut':
            # Le rôle exact autorisé dépend de la transition : voir Signalement.TRANSITIONS.
            return [EstAdministrateur()]
        return [EstAdminOuAnaser()]

    def get_throttles(self):
        # Limite les envois en rafale d'un même conducteur (DEFAULT_THROTTLE_RATES['signalement']).
        return [ScopedRateThrottle()] if self.action == 'create' else []

    def _est_conducteur(self):
        return isinstance(self.request.user, Conducteur)

    def get_queryset(self):
        queryset = Signalement.objects.select_related('conducteur', 'boitier')
        if self._est_conducteur():
            queryset = queryset.filter(conducteur=self.request.user)
        return queryset

    def get_serializer_class(self):
        if self.action == 'create':
            return SignalementCreationSerializer
        if getattr(self.request.user, 'role', None) == 'anaser':
            return SignalementAnaserSerializer
        return SignalementSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        signalement = serializer.save(conducteur=request.user, boitier=request.user.boitier)
        return Response(SignalementSerializer(signalement, context={'request': request}).data, status=201)

    @action(detail=True, methods=['get'])
    def photo(self, request, pk=None):
        """La photo n'est jamais exposée comme fichier public : elle passe par les mêmes droits
        que le signalement (son auteur, l'admin de la région, le super admin, l'ANASER)."""
        signalement = self.get_object()
        if not signalement.photo:
            raise Http404("Ce signalement n'a pas de photo.")
        reponse = FileResponse(signalement.photo.open('rb'))
        reponse['Cache-Control'] = 'private, max-age=3600'
        return reponse

    @action(detail=True, methods=['patch'], url_path='statut')
    def changer_statut(self, request, pk=None):
        signalement = self.get_object()
        ancien = signalement.statut
        nouveau = request.data.get('statut')
        commentaire = (request.data.get('commentaire') or '').strip()
        role = getattr(request.user, 'role', None)

        roles_autorises = Signalement.TRANSITIONS.get((ancien, nouveau)) if isinstance(nouveau, str) else None
        if roles_autorises is None:
            raise ValidationError({'statut': f"Transition impossible : « {ancien} » → « {nouveau} »."})
        if role not in roles_autorises:
            raise PermissionDenied("Votre rôle ne permet pas cette décision sur le signalement.")
        if (ancien, nouveau) in Signalement.TRANSITIONS_A_MOTIVER and not commentaire:
            raise ValidationError({'commentaire': "Un rejet doit être motivé."})

        with transaction.atomic():
            signalement.statut = nouveau
            signalement.save(update_fields=['statut', 'date_maj'])
            HistoriqueStatutSignalement.objects.create(
                signalement=signalement, statut_precedent=ancien, statut_nouveau=nouveau,
                acteur=request.user, role_acteur=role, commentaire=commentaire,
            )
        return Response(self.get_serializer(signalement).data)

    @action(detail=True, methods=['get'])
    def historique(self, request, pk=None):
        signalement = self.get_object()
        entrees = signalement.historique_statuts.select_related('acteur')
        return Response(HistoriqueStatutSignalementSerializer(entrees, many=True).data)

    @action(detail=True, methods=['get'], url_path='incidents-proches')
    def incidents_proches(self, request, pk=None):
        """Incidents détectés par les boîtiers autour du signalement, du plus proche au plus
        lointain : des capteurs qui confirment le danger aident l'administrateur à valider.
        Rayon = rayon de clustering des zones (configuration nationale)."""
        signalement = self.get_object()
        rayon = ConfigurationSysteme.instance().rayon_clustering_metres
        delta_latitude, delta_longitude = boite_englobante(signalement.latitude, signalement.longitude, rayon)
        candidats = Incident.objects.filter(
            latitude__range=(signalement.latitude - delta_latitude, signalement.latitude + delta_latitude),
            longitude__range=(signalement.longitude - delta_longitude, signalement.longitude + delta_longitude),
        )
        point = (signalement.latitude, signalement.longitude)
        proches = []
        for incident in candidats:
            distance = geodesic(point, (incident.latitude, incident.longitude)).meters
            if distance <= rayon:
                proches.append((distance, incident))
        proches.sort(key=lambda paire: paire[0])

        return Response({
            'rayon_metres': rayon,
            'nombre': len(proches),
            'incidents': [
                {
                    'id': incident.id,
                    'type_incident': incident.type_incident,
                    'type_incident_libelle': incident.get_type_incident_display(),
                    'niveau_gravite': incident.niveau_gravite,
                    'niveau_gravite_libelle': incident.get_niveau_gravite_display(),
                    'horodatage': incident.horodatage,
                    'latitude': incident.latitude,
                    'longitude': incident.longitude,
                    'position_fiable': incident.position_fiable,
                    'distance_metres': round(distance),
                }
                for distance, incident in proches[:MAX_INCIDENTS_PROCHES]
            ],
        })
