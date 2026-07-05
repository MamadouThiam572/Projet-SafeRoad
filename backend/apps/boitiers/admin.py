from django.contrib import admin

from .models import Boitier, HistoriqueSync


@admin.register(Boitier)
class BoitierAdmin(admin.ModelAdmin):
    list_display = ['id', 'proprietaire_nom', 'statut', 'derniere_localisation_maj']
    list_filter = ['statut']
    search_fields = ['id', 'proprietaire_nom', 'numero_immatriculation']
    readonly_fields = ['api_key_hash']


@admin.register(HistoriqueSync)
class HistoriqueSyncAdmin(admin.ModelAdmin):
    list_display = ['boitier', 'date_synchronisation', 'nombre_incidents_synchronises', 'succes']
    list_filter = ['succes']
