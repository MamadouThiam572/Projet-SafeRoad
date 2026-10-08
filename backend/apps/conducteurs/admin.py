from django.contrib import admin

from .models import Conducteur


@admin.register(Conducteur)
class ConducteurAdmin(admin.ModelAdmin):
    list_display = ['email', 'nom', 'prenom', 'boitier', 'is_active', 'date_creation']
    list_filter = ['is_active']
    search_fields = ['email', 'nom', 'prenom', 'telephone']
    readonly_fields = ['password', 'date_creation']
