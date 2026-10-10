from rest_framework.routers import DefaultRouter

from .views import DemandeInstallationViewSet, MessageContactViewSet

router = DefaultRouter()
router.register('demandes-installation', DemandeInstallationViewSet, basename='demande-installation')
router.register('messages-contact', MessageContactViewSet, basename='message-contact')

urlpatterns = router.urls
