from rest_framework import serializers

from .models import NotificationAdmin


class NotificationAdminSerializer(serializers.ModelSerializer):
    type_notification_libelle = serializers.CharField(source='get_type_notification_display', read_only=True)
    # État « lu » vu par l'administrateur courant : `lue` pour une notification ciblée,
    # annotation `lue_par_moi` (voir NotificationAdminViewSet.get_queryset) pour une diffusion.
    lue = serializers.SerializerMethodField()

    class Meta:
        model = NotificationAdmin
        exclude = ['lue_par']
        read_only_fields = [
            'id', 'destinataire', 'type_notification', 'incident', 'zone', 'boitier', 'message', 'date_creation',
        ]

    def get_lue(self, obj):
        if obj.destinataire_id:
            return obj.lue
        return getattr(obj, 'lue_par_moi', False)
