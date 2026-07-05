from rest_framework.routers import DefaultRouter

from .views import AlerteProximiteViewSet, AlerteViewSet

router = DefaultRouter()
router.register('alertes-proximite', AlerteProximiteViewSet, basename='alerte-proximite')
router.register('alertes', AlerteViewSet, basename='alerte')

urlpatterns = router.urls
