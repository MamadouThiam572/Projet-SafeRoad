from django.urls import path

from .views import (
    StatistiquesDashboardView,
    StatistiquesPubliquesView,
    TableauDeBordConducteurView,
    TableauDeBordView,
)

urlpatterns = [
    path('statistiques/dashboard/', StatistiquesDashboardView.as_view(), name='statistiques-dashboard'),
    path('statistiques/publiques/', StatistiquesPubliquesView.as_view(), name='statistiques-publiques'),
    path('tableau-de-bord/', TableauDeBordView.as_view(), name='tableau-de-bord'),
    path('conducteur/tableau-de-bord/', TableauDeBordConducteurView.as_view(), name='tableau-de-bord-conducteur'),
]
