from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.core.mots_de_passe import verifier_nouveau_mot_de_passe

from .models import Administrateur


class SafeRoadTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Distingue ce token de ceux émis pour Conducteur (autre table, autre pk) —
        # voir apps.core.authentication.AdministrateurJWTAuthentication/ConducteurJWTAuthentication.
        token['type_compte'] = 'administrateur'
        token['email'] = user.email
        token['role'] = user.role
        token['nom'] = user.nom
        token['prenom'] = user.prenom
        # None pour un super administrateur (portée nationale) ou un compte ANASER —
        # le frontend distingue déjà "pas de région" de "région vide" via cette valeur.
        token['region'] = user.region
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        self.user.derniere_connexion = timezone.now()
        self.user.save(update_fields=['derniere_connexion'])
        data['role'] = self.user.role
        data['email'] = self.user.email
        data['nom'] = self.user.nom
        data['prenom'] = self.user.prenom
        data['region'] = self.user.region
        return data


class ValidationCoherenceRoleRegionMixin:
    """Validation de la règle rôle/région (voir Administrateur.erreur_coherence_role_region)
    au niveau serializer — c'est le point d'entrée réel de création/modification des comptes
    (AdministrateurViewSet), le modèle ne validant pas automatiquement à la sauvegarde."""

    def validate(self, attrs):
        attrs = super().validate(attrs)
        role = attrs.get('role', getattr(self.instance, 'role', None) or Administrateur.Role.ADMIN)
        region = attrs.get('region', getattr(self.instance, 'region', None))
        erreur = Administrateur.erreur_coherence_role_region(role, region)
        if erreur:
            raise serializers.ValidationError({'region': erreur})
        return attrs


class AdministrateurSerializer(ValidationCoherenceRoleRegionMixin, serializers.ModelSerializer):
    class Meta:
        model = Administrateur
        fields = [
            'id', 'email', 'nom', 'prenom', 'telephone', 'role', 'region', 'is_active', 'derniere_connexion',
            'date_creation',
        ]
        read_only_fields = ['id', 'derniere_connexion', 'date_creation']


class ProfilSerializer(serializers.ModelSerializer):
    """Profil « soi-même » (voir MoiView) : contrairement à AdministrateurSerializer
    (gestion d'autres comptes, réservée au super administrateur via AdministrateurViewSet),
    rôle, région et statut actif restent en lecture seule ici pour qu'un utilisateur ne
    puisse jamais s'auto-élever de rôle, changer sa propre portée ou se réactiver via son
    propre profil."""

    class Meta:
        model = Administrateur
        fields = [
            'id', 'email', 'nom', 'prenom', 'telephone', 'role', 'region', 'is_active', 'derniere_connexion',
            'date_creation',
        ]
        read_only_fields = ['id', 'email', 'role', 'region', 'is_active', 'derniere_connexion', 'date_creation']


class AdministrateurCreationSerializer(ValidationCoherenceRoleRegionMixin, serializers.ModelSerializer):
    # Facultatif : sans mot de passe, le compte est créé inutilisable et la personne reçoit
    # une invitation par e-mail pour choisir le sien (voir AdministrateurViewSet.perform_create).
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = Administrateur
        fields = ['id', 'email', 'nom', 'prenom', 'telephone', 'role', 'region', 'password']

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if attrs.get('password'):
            donnees_compte = {k: v for k, v in attrs.items() if k != 'password'}
            verifier_nouveau_mot_de_passe(attrs['password'], Administrateur(**donnees_compte), champ='password')
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        return Administrateur.objects.create_user(password=password, **validated_data)
