from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import Conducteur


class ConducteurInscriptionSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = Conducteur
        fields = ['id', 'email', 'nom', 'prenom', 'telephone', 'password']

    def validate(self, attrs):
        # Mêmes règles que les comptes Django (AUTH_PASSWORD_VALIDATORS : mot de passe trop
        # courant, entièrement numérique, trop proche de l'email/nom…), pas seulement la longueur.
        donnees_compte = {k: v for k, v in attrs.items() if k != 'password'}
        try:
            validate_password(attrs['password'], user=Conducteur(**donnees_compte))
        except DjangoValidationError as erreur:
            raise serializers.ValidationError({'password': list(erreur.messages)})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        return Conducteur.objects.create_user(password=password, **validated_data)


class ProfilConducteurSerializer(serializers.ModelSerializer):
    # Dérivés du boîtier rattaché — jamais saisis par le conducteur, voir Conducteur.boitier.
    plaque_immatriculation = serializers.CharField(source='boitier.numero_immatriculation', read_only=True, default=None)
    numero_boitier = serializers.CharField(source='boitier.id', read_only=True, default=None)

    class Meta:
        model = Conducteur
        fields = [
            'id', 'email', 'nom', 'prenom', 'telephone', 'adresse',
            'plaque_immatriculation', 'numero_boitier',
            'pref_alertes_critiques', 'pref_alertes_vigilance', 'pref_annonce_vocale', 'pref_sensibilite_nuit',
            'date_creation',
        ]
        read_only_fields = ['id', 'email', 'date_creation']
