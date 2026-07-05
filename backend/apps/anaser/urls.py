from rest_framework.routers import DefaultRouter

from .views import AlerteAnaserViewSet

router = DefaultRouter()
router.register('alertes-anaser', AlerteAnaserViewSet, basename='alerte-anaser')

urlpatterns = router.urls
