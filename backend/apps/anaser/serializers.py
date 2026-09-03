from rest_framework import serializers

from .models import AlerteAnaser


class AlerteAnaserSerializer(serializers.ModelSerializer):
    action_prevue_libelle = serializers.CharField(source='get_action_prevue_display', read_only=True)
    statut_libelle = serializers.CharField(source='get_statut_display', read_only=True)

    class Meta:
        model = AlerteAnaser
        fields = '__all__'
        read_only_fields = ['id', 'auteur', 'date_creation', 'date_maj']

    def validate(self, attrs):
        zone = attrs.get('zone') or getattr(self.instance, 'zone', None)
        incident = attrs.get('incident') or getattr(self.instance, 'incident', None)
        if not zone and not incident:
            raise serializers.ValidationError("Une zone ou un incident doit être renseigné.")
        return attrs
