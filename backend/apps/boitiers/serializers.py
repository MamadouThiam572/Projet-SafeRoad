from rest_framework import serializers

from .models import Boitier, HistoriqueSync


class BoitierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Boitier
        fields = [
            'id', 'proprietaire_nom', 'proprietaire_telephone', 'numero_immatriculation',
            'derniere_latitude', 'derniere_longitude', 'derniere_localisation_maj',
            'statut', 'date_creation', 'date_maj',
        ]
        read_only_fields = ['id', 'derniere_latitude', 'derniere_longitude', 'derniere_localisation_maj']


class BoitierCreationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Boitier
        fields = ['proprietaire_nom', 'proprietaire_telephone', 'numero_immatriculation', 'statut']


class PositionSerializer(serializers.Serializer):
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()


class HistoriqueSyncSerializer(serializers.ModelSerializer):
    class Meta:
        model = HistoriqueSync
        fields = ['id', 'boitier', 'date_synchronisation', 'nombre_incidents_synchronises', 'succes', 'message_erreur']
        read_only_fields = fields
