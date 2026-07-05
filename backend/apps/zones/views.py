from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.core.permissions import EstAdministrateur

from .clustering import generer_zones_depuis_incidents
from .models import Zone
from .serializers import ZoneSerializer


class ZoneViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ZoneSerializer

    def get_permissions(self):
        if self.action in ('valider', 'generer'):
            return [EstAdministrateur()]
        return [AllowAny()]

    def get_queryset(self):
        queryset = Zone.objects.all().order_by('-score_danger')
        utilisateur = self.request.user
        est_admin_ou_anaser = utilisateur.is_authenticated and getattr(utilisateur, 'role', None) in ('admin', 'anaser')
        if not est_admin_ou_anaser:
            queryset = queryset.filter(statut_validation=Zone.StatutValidation.VALIDEE, actif=True)
        return queryset

    @action(detail=True, methods=['patch'])
    def valider(self, request, pk=None):
        zone = self.get_object()
        nouveau_statut = request.data.get('statut_validation', Zone.StatutValidation.VALIDEE)
        if nouveau_statut not in Zone.StatutValidation.values:
            return Response({'detail': 'statut_validation invalide.'}, status=400)
        zone.statut_validation = nouveau_statut
        zone.validee_par = request.user
        zone.validee_le = timezone.now()
        zone.save(update_fields=['statut_validation', 'validee_par', 'validee_le'])
        return Response(ZoneSerializer(zone).data)

    @action(detail=False, methods=['post'])
    def generer(self, request):
        resultat = generer_zones_depuis_incidents()
        return Response(resultat)
