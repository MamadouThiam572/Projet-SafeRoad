from rest_framework.permissions import BasePermission

from apps.boitiers.models import Boitier
from apps.conducteurs.models import Conducteur


def _a_pour_role(request, *roles):
    return bool(
        request.user
        and request.user.is_authenticated
        and getattr(request.user, 'role', None) in roles
    )


class EstBoitier(BasePermission):
    def has_permission(self, request, view):
        return isinstance(request.user, Boitier)


class EstConducteur(BasePermission):
    def has_permission(self, request, view):
        return isinstance(request.user, Conducteur)


class EstSuperAdministrateur(BasePermission):
    """Portée nationale, privilèges supérieurs — notamment seul rôle habilité à gérer les
    comptes (voir AdministrateurViewSet)."""

    def has_permission(self, request, view):
        return _a_pour_role(request, 'super_admin')


class EstAdministrateurRegional(BasePermission):
    """Administrateur régional seul (pas le super administrateur) — utile pour les vues qui
    ne doivent jamais s'appliquer à un super administrateur."""

    def has_permission(self, request, view):
        return _a_pour_role(request, 'admin')


class EstAdministrateur(BasePermission):
    """Administrateur régional OU super administrateur — le super administrateur peut tout
    ce qu'un administrateur régional peut, plus la gestion des comptes (EstSuperAdministrateur
    seule sur AdministrateurViewSet)."""

    def has_permission(self, request, view):
        return _a_pour_role(request, 'admin', 'super_admin')


class EstAnaser(BasePermission):
    def has_permission(self, request, view):
        return _a_pour_role(request, 'anaser')


class EstAdminOuAnaser(BasePermission):
    """Administrateur régional, super administrateur, ou ANASER."""

    def has_permission(self, request, view):
        return _a_pour_role(request, 'admin', 'super_admin', 'anaser')
