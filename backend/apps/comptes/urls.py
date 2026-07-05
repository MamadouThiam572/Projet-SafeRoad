from rest_framework.routers import DefaultRouter

from django.urls import path

from .views import AdministrateurViewSet, LoginView, MoiView, RefreshView

router = DefaultRouter()
router.register('administrateurs', AdministrateurViewSet, basename='administrateur')

urlpatterns = [
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/refresh/', RefreshView.as_view(), name='refresh'),
    path('auth/me/', MoiView.as_view(), name='me'),
] + router.urls
