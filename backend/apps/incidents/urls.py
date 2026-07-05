from rest_framework.routers import DefaultRouter

from django.urls import path

from .views import IncidentViewSet, IngestionView, SyncBatchView

router = DefaultRouter()
router.register('incidents', IncidentViewSet, basename='incident')

urlpatterns = [
    path('incidents/ingestion/', IngestionView.as_view(), name='incident-ingestion'),
    path('incidents/sync-batch/', SyncBatchView.as_view(), name='incident-sync-batch'),
] + router.urls
