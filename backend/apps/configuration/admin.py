from django.contrib import admin

from .models import ConfigurationSysteme


@admin.register(ConfigurationSysteme)
class ConfigurationSystemeAdmin(admin.ModelAdmin):
    list_display = ['id', 'rayon_clustering_metres', 'min_incidents_pour_zone', 'date_maj']

    def has_add_permission(self, request):
        return not ConfigurationSysteme.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
