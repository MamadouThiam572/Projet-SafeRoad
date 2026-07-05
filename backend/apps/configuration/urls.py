from django.urls import path

from .views import ConfigurationSystemeView

urlpatterns = [
    path('configuration/', ConfigurationSystemeView.as_view(), name='configuration'),
]
