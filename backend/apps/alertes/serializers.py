from rest_framework import serializers

from .models import Alerte, AlerteProximite


class AlerteSerializer(serializers.ModelSerializer):
    statut_libelle = serializers.CharField(source='get_statut_display', read_only=True)

    class Meta:
        model = Alerte
        fields = '__all__'
        read_only_fields = ['id', 'incident', 'date_creation', 'traitee_par', 'traitee_le']


class AlerteProximiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = AlerteProximite
        fields = [
            'id', 'boitier', 'zone', 'distance_metres', 'latitude', 'longitude',
            'canal_led', 'canal_buzzer_declenche', 'canal_audio_declenche', 'date_creation',
        ]
        read_only_fields = fields


class AlerteConducteurSerializer(serializers.ModelSerializer):
    """Alerte « vous entrez dans une zone à risque » telle que le conducteur la revoit."""

    zone_nom = serializers.SerializerMethodField()
    niveau_danger = serializers.CharField(source='zone.niveau_danger', read_only=True)
    niveau_danger_libelle = serializers.CharField(source='zone.get_niveau_danger_display', read_only=True)
    region = serializers.CharField(source='zone.region', read_only=True, default=None)
    region_libelle = serializers.CharField(source='zone.get_region_display', read_only=True, default=None)

    class Meta:
        model = AlerteProximite
        fields = [
            'id', 'zone', 'zone_nom', 'niveau_danger', 'niveau_danger_libelle', 'region', 'region_libelle',
            'distance_metres', 'latitude', 'longitude',
            'canal_led', 'canal_buzzer_declenche', 'canal_audio_declenche', 'date_creation',
        ]
        read_only_fields = fields

    def get_zone_nom(self, obj):
        return str(obj.zone)
