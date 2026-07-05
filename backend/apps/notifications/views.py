from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.permissions import EstAdministrateur

from .models import NotificationAdmin
from .serializers import NotificationAdminSerializer


class NotificationAdminViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = NotificationAdmin.objects.all()
    serializer_class = NotificationAdminSerializer
    permission_classes = [EstAdministrateur]

    @action(detail=True, methods=['patch'], url_path='lue')
    def marquer_lue(self, request, pk=None):
        notification = self.get_object()
        notification.lue = True
        notification.save(update_fields=['lue'])
        return Response(NotificationAdminSerializer(notification).data)
