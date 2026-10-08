from rest_framework import viewsets
from rest_framework.permissions import BasePermission

from apps.core.pagination import PaginationListeGestion
from apps.core.permissions import EstAdminOuAnaser, EstAnaser

from .models import AlerteAnaser
from .serializers import AlerteAnaserSerializer


class EstAuteurOuSuperAdminPourSuppression(BasePermission):
    """Modification : seul l'auteur ANASER du retour (c'est l'ANASER qui réalise l'action
    sur le terrain, donc qui fait avancer son statut). Suppression : l'auteur, ou le super
    administrateur pour la modération. Les administrateurs régionaux restent en lecture seule."""

    def has_object_permission(self, request, view, obj):
        if obj.auteur_id == request.user.pk:
            return True
        return view.action == 'destroy' and getattr(request.user, 'role', None) == 'super_admin'


class AlerteAnaserViewSet(viewsets.ModelViewSet):
    queryset = AlerteAnaser.objects.all().select_related('zone', 'incident', 'auteur')
    serializer_class = AlerteAnaserSerializer
    pagination_class = PaginationListeGestion

    def get_permissions(self):
        if self.action == 'create':
            return [EstAnaser()]
        if self.action in ('update', 'partial_update', 'destroy'):
            return [EstAdminOuAnaser(), EstAuteurOuSuperAdminPourSuppression()]
        return [EstAdminOuAnaser()]

    def perform_create(self, serializer):
        serializer.save(auteur=self.request.user)
