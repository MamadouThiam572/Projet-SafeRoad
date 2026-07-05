from django.contrib import admin

from .models import AlerteAnaser


@admin.register(AlerteAnaser)
class AlerteAnaserAdmin(admin.ModelAdmin):
    list_display = ['id', 'zone', 'incident', 'auteur', 'statut', 'action_prevue', 'date_creation']
    list_filter = ['statut', 'action_prevue']
