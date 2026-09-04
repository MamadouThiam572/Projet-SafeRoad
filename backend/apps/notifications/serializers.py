from rest_framework import serializers

from .models import NotificationAdmin


class NotificationAdminSerializer(serializers.ModelSerializer):
    type_notification_libelle = serializers.CharField(source='get_type_notification_display', read_only=True)

    class Meta:
        model = NotificationAdmin
        fields = '__all__'
        read_only_fields = [
            'id', 'destinataire', 'type_notification', 'incident', 'zone', 'boitier', 'message', 'date_creation',
        ]
