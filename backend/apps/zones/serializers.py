from rest_framework import serializers

from .models import Zone


class ZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Zone
        fields = '__all__'
        read_only_fields = [
            'id', 'latitude_centre', 'longitude_centre', 'rayon_metres', 'nombre_incidents',
            'score_danger', 'niveau_danger', 'validee_par', 'validee_le', 'date_creation', 'date_maj',
        ]
