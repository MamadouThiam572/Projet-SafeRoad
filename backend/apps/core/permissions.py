from rest_framework.permissions import BasePermission

from apps.boitiers.models import Boitier


class EstBoitier(BasePermission):
    def has_permission(self, request, view):
        return isinstance(request.user, Boitier)


class EstAdministrateur(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'role', None) == 'admin'
        )


class EstAnaser(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'role', None) == 'anaser'
        )


class EstAdminOuAnaser(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'role', None) in ('admin', 'anaser')
        )
