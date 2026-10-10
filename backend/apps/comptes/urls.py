from django.urls import path
from rest_framework.permissions import IsAuthenticated
from rest_framework.routers import DefaultRouter

from apps.core.mots_de_passe import ChangementMotDePasseView, DemandeReinitialisationView, ReinitialisationView

from .models import Administrateur
from .views import (
    AdministrateurViewSet,
    LoginView,
    LogoutView,
    MoiView,
    RefreshView,
    revoquer_sessions_personnel,
)

router = DefaultRouter()
router.register('administrateurs', AdministrateurViewSet, basename='administrateur')

urlpatterns = [
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/refresh/', RefreshView.as_view(), name='refresh'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/me/', MoiView.as_view(), name='me'),
    path('auth/mot-de-passe/oubli/', DemandeReinitialisationView.as_view(modele=Administrateur),
         name='mot-de-passe-oubli'),
    path('auth/mot-de-passe/reinitialiser/', ReinitialisationView.as_view(
        modele=Administrateur, apres_changement=revoquer_sessions_personnel,
    ), name='mot-de-passe-reinitialiser'),
    path('auth/mot-de-passe/changer/', ChangementMotDePasseView.as_view(permission_classes=[IsAuthenticated]),
         name='mot-de-passe-changer'),
] + router.urls
