from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Administrateur


class SafeRoadTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['email'] = user.email
        token['role'] = user.role
        token['nom'] = user.nom
        token['prenom'] = user.prenom
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        self.user.derniere_connexion = timezone.now()
        self.user.save(update_fields=['derniere_connexion'])
        data['role'] = self.user.role
        data['email'] = self.user.email
        data['nom'] = self.user.nom
        data['prenom'] = self.user.prenom
        return data


class AdministrateurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Administrateur
        fields = ['id', 'email', 'nom', 'prenom', 'role', 'is_active', 'derniere_connexion', 'date_creation']
        read_only_fields = ['id', 'derniere_connexion', 'date_creation']


class AdministrateurCreationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = Administrateur
        fields = ['id', 'email', 'nom', 'prenom', 'role', 'password']

    def create(self, validated_data):
        password = validated_data.pop('password')
        return Administrateur.objects.create_user(password=password, **validated_data)
