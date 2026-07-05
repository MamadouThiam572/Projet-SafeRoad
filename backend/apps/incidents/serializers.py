from rest_framework import serializers

from .models import Incident


class IncidentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Incident
        fields = '__all__'
        read_only_fields = ['id', 'recu_le', 'niveau_gravite', 'synced', 'historique_sync', 'zone']


class IncidentIngestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Incident
        fields = [
            'latitude', 'longitude', 'altitude', 'horodatage', 'type_incident',
            'vitesse_radar', 'acceleration_x', 'acceleration_y', 'acceleration_z',
            'gyro_x', 'gyro_y', 'gyro_z', 'distance_hcsr04',
        ]
