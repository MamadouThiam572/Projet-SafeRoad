from rest_framework import serializers

from .models import Incident, ObservationIncident


class IncidentSerializer(serializers.ModelSerializer):
    # Libellés lisibles pour le frontend — même mécanisme que ZoneSerializer/BoitierSerializer
    # (TextChoices Django, get_*_display() ne coûte rien de plus à exposer).
    type_incident_libelle = serializers.CharField(source='get_type_incident_display', read_only=True)
    niveau_gravite_libelle = serializers.CharField(source='get_niveau_gravite_display', read_only=True)
    statut_libelle = serializers.CharField(source='get_statut_display', read_only=True)

    class Meta:
        model = Incident
        fields = '__all__'
        read_only_fields = [
            'id', 'recu_le', 'niveau_gravite', 'synced', 'historique_sync', 'zone', 'position_fiable', 'statut',
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


class ObservationIncidentSerializer(serializers.ModelSerializer):
    statut_precedent_libelle = serializers.CharField(source='get_statut_precedent_display', read_only=True)
    statut_nouveau_libelle = serializers.CharField(source='get_statut_nouveau_display', read_only=True)
    acteur_nom = serializers.SerializerMethodField()

    class Meta:
        model = ObservationIncident
        fields = [
            'id', 'statut_precedent', 'statut_precedent_libelle', 'statut_nouveau', 'statut_nouveau_libelle',
            'texte', 'acteur', 'acteur_nom', 'role_acteur', 'date',
        ]
        read_only_fields = fields

    def get_acteur_nom(self, obj):
        return f"{obj.acteur.prenom} {obj.acteur.nom}" if obj.acteur else None
