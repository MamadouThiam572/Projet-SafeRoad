from rest_framework import serializers

from .models import Zone


class ZoneSerializer(serializers.ModelSerializer):
    # Libellés lisibles pour le frontend — Zone.NiveauDanger/StatutValidation sont déjà
    # des TextChoices Django, get_*_display() ne coûte rien de plus à exposer.
    niveau_danger_libelle = serializers.CharField(source='get_niveau_danger_display', read_only=True)
    statut_validation_libelle = serializers.CharField(source='get_statut_validation_display', read_only=True)
    region_libelle = serializers.CharField(source='get_region_display', read_only=True)

    class Meta:
        model = Zone
        fields = '__all__'
        read_only_fields = [
            'id', 'latitude_centre', 'longitude_centre', 'rayon_metres', 'nombre_incidents',
            'score_danger', 'niveau_danger', 'region', 'validee_par', 'validee_le', 'date_creation', 'date_maj',
        ]
