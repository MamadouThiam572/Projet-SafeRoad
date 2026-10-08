from datetime import timedelta

from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import EstAdminOuAnaser
from apps.core.regionalisation import appliquer_filtre_regional

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
