from rest_framework import viewsets

from apps.core.permissions import EstAdminOuAnaser, EstAnaser

from .models import AlerteAnaser
from .serializers import AlerteAnaserSerializer


class AlerteAnaserViewSet(viewsets.ModelViewSet):
    queryset = AlerteAnaser.objects.all().select_related('zone', 'incident', 'auteur')
    serializer_class = AlerteAnaserSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [EstAnaser()]
        return [EstAdminOuAnaser()]

    def perform_create(self, serializer):
        serializer.save(auteur=self.request.user)
