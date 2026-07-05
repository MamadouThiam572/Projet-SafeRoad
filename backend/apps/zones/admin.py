from django.contrib import admin

from .models import Zone


@admin.register(Zone)
class ZoneAdmin(admin.ModelAdmin):
    list_display = ['id', 'nom', 'niveau_danger', 'nombre_incidents', 'statut_validation', 'actif']
    list_filter = ['niveau_danger', 'statut_validation', 'actif']
