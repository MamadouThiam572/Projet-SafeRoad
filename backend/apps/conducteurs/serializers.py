from rest_framework import serializers

from .models import Conducteur


class ProfilConducteurSerializer(serializers.ModelSerializer):
    # Dérivés du boîtier rattaché — jamais saisis par le conducteur, voir Conducteur.boitier.
    plaque_immatriculation = serializers.CharField(source='boitier.numero_immatriculation', read_only=True, default=None)
    numero_boitier = serializers.CharField(source='boitier.id', read_only=True, default=None)

    class Meta:
        model = Conducteur
        fields = [
            'id', 'email', 'nom', 'prenom', 'telephone', 'adresse',
            'contact_urgence_nom', 'contact_urgence_telephone',
            'plaque_immatriculation', 'numero_boitier',
            'pref_alertes_critiques', 'pref_alertes_vigilance', 'pref_annonce_vocale', 'pref_sensibilite_nuit',
            'date_creation',
        ]
        read_only_fields = ['id', 'email', 'date_creation']


class ConducteurGestionSerializer(serializers.ModelSerializer):
    """Vue administrateur d'un compte conducteur (lecture seule) : identité, contact et
    boîtier/véhicule actuels, pour choisir à qui affecter un boîtier."""

    boitier = serializers.CharField(source='boitier.id', read_only=True, default=None)
    numero_immatriculation = serializers.CharField(source='boitier.numero_immatriculation', read_only=True, default=None)
    # Région du boîtier porté : un conducteur sans boîtier n'a pas de région connue.
    region = serializers.CharField(source='boitier.region', read_only=True, default=None)

    class Meta:
        model = Conducteur
        fields = [
            'id', 'email', 'nom', 'prenom', 'telephone', 'boitier', 'numero_immatriculation', 'region',
            'is_active', 'date_creation',
        ]
        read_only_fields = fields
