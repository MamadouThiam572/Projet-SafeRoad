from rest_framework import serializers

from .models import Boitier, HistoriqueSync


class BoitierSerializer(serializers.ModelSerializer):
    statut_libelle = serializers.CharField(source='get_statut_display', read_only=True)
    region_libelle = serializers.CharField(source='get_region_display', read_only=True)

    class Meta:
        model = Boitier
        fields = [
            'id', 'proprietaire_nom', 'proprietaire_telephone', 'numero_immatriculation',
            'region', 'region_libelle',
            'derniere_latitude', 'derniere_longitude', 'derniere_localisation_maj',
            'derniere_vitesse_gps', 'dernier_hdop', 'dernier_nombre_satellites',
            'statut', 'statut_libelle', 'date_creation', 'date_maj',
        ]
        read_only_fields = [
            'id', 'derniere_latitude', 'derniere_longitude', 'derniere_localisation_maj',
            'derniere_vitesse_gps', 'dernier_hdop', 'dernier_nombre_satellites',
        ]


class BoitierAnaserSerializer(serializers.ModelSerializer):
    """Vue ANASER : lecture seule, sans aucune donnée permettant d'identifier une personne
    (propriétaire, téléphone, immatriculation, conducteur) ni position GPS — uniquement ce
    qui sert à l'analyse : région, statut, période d'activité et volume d'événements."""

    statut_libelle = serializers.CharField(source='get_statut_display', read_only=True)
    region_libelle = serializers.CharField(source='get_region_display', read_only=True)
    nombre_incidents = serializers.IntegerField(read_only=True)
    nombre_alertes_proximite = serializers.IntegerField(read_only=True)

    class Meta:
        model = Boitier
        fields = [
            'id', 'region', 'region_libelle', 'statut', 'statut_libelle',
            'date_creation', 'derniere_localisation_maj', 'nombre_incidents', 'nombre_alertes_proximite',
        ]
        read_only_fields = fields


class BoitierCreationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Boitier
        fields = ['proprietaire_nom', 'proprietaire_telephone', 'numero_immatriculation', 'region', 'statut']
        # Le modèle garde region nullable (boîtiers historiques créés avant le filtrage
        # régional, voir Boitier.region) mais toute NOUVELLE création doit désormais fournir
        # une région explicite — sans quoi elle deviendrait invisible pour tout administrateur
        # régional (FiltreRegional) sans que personne ne s'en aperçoive. Un administrateur
        # régional n'a de toute façon pas à la fournir : BoitierViewSet.create() la remplace
        # par request.user.region avant validation (voir apps/boitiers/views.py).
        extra_kwargs = {
            'region': {'required': True, 'allow_null': False, 'allow_blank': False},
        }


class PositionSerializer(serializers.Serializer):
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    # Optionnels : un firmware plus ancien qui ne les envoie pas reste accepté.
    vitesse_gps = serializers.FloatField(required=False, allow_null=True, min_value=0)
    hdop = serializers.FloatField(required=False, allow_null=True, min_value=0)
    nombre_satellites = serializers.IntegerField(required=False, allow_null=True, min_value=0)


class HistoriqueSyncSerializer(serializers.ModelSerializer):
    class Meta:
        model = HistoriqueSync
        fields = ['id', 'boitier', 'date_synchronisation', 'nombre_incidents_synchronises', 'succes', 'message_erreur']
        read_only_fields = fields
