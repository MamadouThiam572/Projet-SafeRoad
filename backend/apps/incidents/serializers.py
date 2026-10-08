from rest_framework import serializers

from .models import Incident


class IncidentSerializer(serializers.ModelSerializer):
    # Libellés lisibles pour le frontend — même mécanisme que ZoneSerializer/BoitierSerializer
    # (TextChoices Django, get_*_display() ne coûte rien de plus à exposer).
    type_incident_libelle = serializers.CharField(source='get_type_incident_display', read_only=True)
    niveau_gravite_libelle = serializers.CharField(source='get_niveau_gravite_display', read_only=True)

    class Meta:
        model = Incident
        fields = '__all__'
        read_only_fields = [
            'id', 'recu_le', 'niveau_gravite', 'synced', 'historique_sync', 'zone', 'position_fiable',
        ]


class IncidentIngestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Incident
        fields = [
            'latitude', 'longitude', 'altitude', 'horodatage', 'type_incident',
            'vitesse_radar', 'acceleration_x', 'acceleration_y', 'acceleration_z',
            'gyro_x', 'gyro_y', 'gyro_z', 'distance_hcsr04',
            'vitesse_gps', 'hdop', 'nombre_satellites',
        ]
        extra_kwargs = {
            'vitesse_gps': {'min_value': 0},
            'hdop': {'min_value': 0},
        }
