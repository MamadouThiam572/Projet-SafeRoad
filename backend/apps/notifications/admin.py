from django.contrib import admin

from .models import NotificationAdmin as NotificationAdminModel


@admin.register(NotificationAdminModel)
class NotificationAdminAdmin(admin.ModelAdmin):
    list_display = ['id', 'type_notification', 'destinataire', 'lue', 'date_creation']
    list_filter = ['type_notification', 'lue']
