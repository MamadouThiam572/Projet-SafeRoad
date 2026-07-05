from django.contrib import admin

from .models import Incident


@admin.register(Incident)
class IncidentAdmin(admin.ModelAdmin):
    list_display = ['id', 'boitier', 'type_incident', 'niveau_gravite', 'horodatage', 'synced', 'zone']
    list_filter = ['type_incident', 'niveau_gravite', 'synced']
    search_fields = ['boitier__id']
    date_hierarchy = 'horodatage'
