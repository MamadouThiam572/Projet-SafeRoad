from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.core.mots_de_passe import ChangementMotDePasseView, DemandeReinitialisationView, ReinitialisationView
from apps.core.permissions import EstConducteur

from .models import Conducteur
from .views import (
    ConducteurGestionViewSet,
    ConnexionConducteurView,
    DeconnexionConducteurView,
    InscriptionConducteurView,
    MoiConducteurView,
    RafraichirConducteurView,
)

router = DefaultRouter()
router.register('conducteurs', ConducteurGestionViewSet, basename='conducteur')

urlpatterns = [
    path('auth/conducteur/inscription/', InscriptionConducteurView.as_view(), name='conducteur-inscription'),
    path('auth/conducteur/login/', ConnexionConducteurView.as_view(), name='conducteur-login'),
    path('auth/conducteur/refresh/', RafraichirConducteurView.as_view(), name='conducteur-refresh'),
    path('auth/conducteur/logout/', DeconnexionConducteurView.as_view(), name='conducteur-logout'),
    path('conducteur/moi/', MoiConducteurView.as_view(), name='conducteur-moi'),
    path('auth/conducteur/mot-de-passe/oubli/', DemandeReinitialisationView.as_view(modele=Conducteur),
         name='conducteur-mot-de-passe-oubli'),
    path('auth/conducteur/mot-de-passe/reinitialiser/', ReinitialisationView.as_view(modele=Conducteur),
         name='conducteur-mot-de-passe-reinitialiser'),
    path('conducteur/moi/mot-de-passe/', ChangementMotDePasseView.as_view(permission_classes=[EstConducteur]),
         name='conducteur-mot-de-passe-changer'),
] + router.urls
