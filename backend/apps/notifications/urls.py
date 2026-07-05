from rest_framework.routers import DefaultRouter

from .views import NotificationAdminViewSet

router = DefaultRouter()
router.register('notifications', NotificationAdminViewSet, basename='notification')

urlpatterns = router.urls
