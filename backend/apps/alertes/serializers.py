from rest_framework import serializers

from .models import Alerte, AlerteProximite


class AlerteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alerte
        fields = '__all__'
        read_only_fields = ['id', 'incident', 'date_creation', 'traitee_par', 'traitee_le']


class AlerteProximiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = AlerteProximite
        fields = '__all__'
        read_only_fields = fields
