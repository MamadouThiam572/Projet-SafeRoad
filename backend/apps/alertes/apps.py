from django.apps import AppConfig


class AlertesConfig(AppConfig):
    name = 'apps.alertes'
    label = 'alertes'

    def ready(self):
        from . import signals  # noqa: F401

