from django.urls import path

from .views import StatistiquesDashboardView, StatistiquesPubliquesView

urlpatterns = [
    path('statistiques/dashboard/', StatistiquesDashboardView.as_view(), name='statistiques-dashboard'),
    path('statistiques/publiques/', StatistiquesPubliquesView.as_view(), name='statistiques-publiques'),
]
