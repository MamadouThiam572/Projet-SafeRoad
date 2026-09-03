from django.db.models import Q
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.permissions import EstAdministrateur

from .models import NotificationAdmin
from .serializers import NotificationAdminSerializer


class NotificationAdminViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = NotificationAdminSerializer
    permission_classes = [EstAdministrateur]

    def get_queryset(self):
        # Un admin ne voit que ses notifications ciblées + les diffusions globales
        # (destinataire=None) — pas les notifications adressées à d'autres admins.
        return (
            NotificationAdmin.objects.filter(Q(destinataire=self.request.user) | Q(destinataire__isnull=True))
            .select_related('incident', 'zone', 'boitier')
        )

    @action(detail=True, methods=['patch'], url_path='lue')
    def marquer_lue(self, request, pk=None):
        notification = self.get_object()
        notification.lue = True
        notification.save(update_fields=['lue'])
        return Response(NotificationAdminSerializer(notification).data)
