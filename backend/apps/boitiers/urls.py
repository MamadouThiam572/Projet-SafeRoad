from rest_framework.routers import DefaultRouter

from .views import BoitierViewSet

router = DefaultRouter()
router.register('boitiers', BoitierViewSet, basename='boitier')

urlpatterns = router.urls
