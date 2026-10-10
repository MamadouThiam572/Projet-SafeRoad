from django.urls import path
from rest_framework.routers import DefaultRouter

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
] + router.urls
