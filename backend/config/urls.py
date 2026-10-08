"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

api_v1 = [
    path('', include('apps.comptes.urls')),
    path('', include('apps.conducteurs.urls')),
    path('', include('apps.boitiers.urls')),
    path('', include('apps.incidents.urls')),
    path('', include('apps.zones.urls')),
    path('', include('apps.alertes.urls')),
    path('', include('apps.anaser.urls')),
    path('', include('apps.notifications.urls')),
    path('', include('apps.statistiques.urls')),
    path('', include('apps.configuration.urls')),
    path('', include('apps.signalements.urls')),
    path('schema/', SpectacularAPIView.as_view(), name='schema'),
    path('docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='docs'),
]

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include(api_v1)),
]
