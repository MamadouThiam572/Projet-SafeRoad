from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.pagination import PaginationListeGestion
from apps.core.permissions import EstAdministrateur
from apps.core.regionalisation import FiltreRegional

from .models import Alerte, AlerteProximite
from .serializers import AlerteProximiteSerializer, AlerteSerializer


class AlerteViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = Alerte.objects.all().select_related('incident', 'traitee_par')
    serializer_class = AlerteSerializer
    permission_classes = [EstAdministrateur]
    pagination_class = PaginationListeGestion
    # Super admin : toutes les alertes. Administrateur régional : uniquement celles dont
    # l'incident est rattaché à un boîtier de sa région (queryset vide si region=None).
    # ANASER n'a de toute façon pas accès à ce ViewSet (EstAdministrateur, pas EstAdminOuAnaser)
    # — comportement inchangé. S'applique à list/retrieve ET à l'action traiter() ci-dessous,
    # qui passe par get_object() -> filter_queryset(get_queryset()) : rien à modifier dedans.
    filter_backends = [FiltreRegional]
    region_lookup_field = 'incident__boitier__region'

    @action(detail=True, methods=['patch'])
    def traiter(self, request, pk=None):
        alerte = self.get_object()
        nouveau_statut = request.data.get('statut', Alerte.Statut.TRAITEE)
        if nouveau_statut not in Alerte.Statut.values:
            return Response({'detail': 'statut invalide.'}, status=400)
        alerte.statut = nouveau_statut
        alerte.traitee_par = request.user
        alerte.traitee_le = timezone.now()
        alerte.save(update_fields=['statut', 'traitee_par', 'traitee_le'])
        return Response(AlerteSerializer(alerte).data)


class AlerteProximiteViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = AlerteProximite.objects.all().select_related('boitier', 'zone')
    serializer_class = AlerteProximiteSerializer
    permission_classes = [EstAdministrateur]
    # boitier est une FK directe (pas seulement zone) : ancrage le plus fiable pour la
    # région, cohérent avec Boitier.region (étape 4A) sans toucher à Zone (hors périmètre).
    filter_backends = [FiltreRegional]
    region_lookup_field = 'boitier__region'
