from rest_framework.routers import DefaultRouter

from .views import AlerteConducteurViewSet, AlerteProximiteViewSet, AlerteViewSet

router = DefaultRouter()
router.register('alertes-proximite', AlerteProximiteViewSet, basename='alerte-proximite')
router.register('alertes', AlerteViewSet, basename='alerte')
router.register('conducteur/alertes', AlerteConducteurViewSet, basename='alerte-conducteur')

urlpatterns = router.urls
