from django.contrib import admin

from .models import StatistiquesQuotidiennes


@admin.register(StatistiquesQuotidiennes)
class StatistiquesQuotidiennesAdmin(admin.ModelAdmin):
    list_display = ['date', 'zone', 'type_incident', 'nombre_incidents', 'nombre_incidents_critiques']
    list_filter = ['type_incident']
    date_hierarchy = 'date'
