from datetime import timedelta

from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import EstAdminOuAnaser

from .models import StatistiquesQuotidiennes
from .serializers import StatistiquesQuotidiennesSerializer


class StatistiquesDashboardView(APIView):
    permission_classes = [EstAdminOuAnaser]

    def get(self, request):
        queryset = StatistiquesQuotidiennes.objects.all().order_by('-date')
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
