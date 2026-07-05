from rest_framework import serializers

from .models import NotificationAdmin


class NotificationAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationAdmin
        fields = '__all__'
        read_only_fields = [
            'id', 'destinataire', 'type_notification', 'incident', 'zone', 'boitier', 'message', 'date_creation',
        ]
