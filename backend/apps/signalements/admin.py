from django.contrib import admin

from .models import HistoriqueStatutSignalement, Signalement


@admin.register(Signalement)
class SignalementAdmin(admin.ModelAdmin):
    list_display = ['id', 'type_danger', 'region', 'localite', 'statut', 'conducteur', 'date_creation']
    list_filter = ['statut', 'type_danger', 'region']


@admin.register(HistoriqueStatutSignalement)
class HistoriqueStatutSignalementAdmin(admin.ModelAdmin):
    list_display = ['id', 'signalement', 'statut_precedent', 'statut_nouveau', 'acteur', 'role_acteur', 'date']
