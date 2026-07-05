from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.permissions import EstAdministrateur

from .models import Alerte, AlerteProximite
from .serializers import AlerteProximiteSerializer, AlerteSerializer


class AlerteViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = Alerte.objects.all().select_related('incident', 'traitee_par')
    serializer_class = AlerteSerializer
    permission_classes = [EstAdministrateur]

    @action(detail=True, methods=['patch'])
    def traiter(self, request, pk=None):
        alerte = self.get_object()
        alerte.statut = request.data.get('statut', Alerte.Statut.TRAITEE)
        alerte.traitee_par = request.user
        alerte.traitee_le = timezone.now()
        alerte.save(update_fields=['statut', 'traitee_par', 'traitee_le'])
        return Response(AlerteSerializer(alerte).data)


class AlerteProximiteViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = AlerteProximite.objects.all().select_related('boitier', 'zone')
    serializer_class = AlerteProximiteSerializer
    permission_classes = [EstAdministrateur]
