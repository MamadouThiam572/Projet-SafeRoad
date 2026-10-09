from rest_framework import serializers

from .models import HistoriqueStatutZone, Zone


class ZoneSerializer(serializers.ModelSerializer):
    # Libellés lisibles pour le frontend — Zone.NiveauDanger/StatutValidation sont déjà
    # des TextChoices Django, get_*_display() ne coûte rien de plus à exposer.
    niveau_danger_libelle = serializers.CharField(source='get_niveau_danger_display', read_only=True)
    statut_validation_libelle = serializers.CharField(source='get_statut_validation_display', read_only=True)
    region_libelle = serializers.CharField(source='get_region_display', read_only=True)

    class Meta:
        model = Zone
        fields = '__all__'
        # statut_validation ne change que via l'action `statut` (workflow + historique).
        read_only_fields = [
            'id', 'latitude_centre', 'longitude_centre', 'rayon_metres', 'nombre_incidents', 'nombre_signalements',
            'score_danger', 'niveau_danger', 'region', 'statut_validation', 'date_creation', 'date_maj',
        ]


class HistoriqueStatutZoneSerializer(serializers.ModelSerializer):
    statut_precedent_libelle = serializers.CharField(source='get_statut_precedent_display', read_only=True)
    statut_nouveau_libelle = serializers.CharField(source='get_statut_nouveau_display', read_only=True)
    acteur_nom = serializers.SerializerMethodField()

    class Meta:
        model = HistoriqueStatutZone
        fields = [
            'id', 'statut_precedent', 'statut_precedent_libelle', 'statut_nouveau', 'statut_nouveau_libelle',
            'acteur', 'acteur_nom', 'role_acteur', 'commentaire', 'date',
        ]
        read_only_fields = fields

    def get_acteur_nom(self, obj):
        return f"{obj.acteur.prenom} {obj.acteur.nom}" if obj.acteur else None
