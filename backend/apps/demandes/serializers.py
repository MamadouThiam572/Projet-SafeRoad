from django.utils import timezone
from rest_framework import serializers

from .models import DemandeInstallation, HistoriqueDemande, MessageContact


class DemandeInstallationCreationSerializer(serializers.ModelSerializer):
    """Formulaire public de demande d'équipement."""

    nombre_vehicules = serializers.IntegerField(min_value=1, max_value=500, required=False)

    class Meta:
        model = DemandeInstallation
        fields = [
            'nom', 'prenom', 'telephone', 'email', 'region', 'commune', 'adresse', 'type_vehicule',
            'immatriculation', 'nombre_vehicules', 'disponibilites', 'message', 'consentement_donnees',
        ]

    def validate_consentement_donnees(self, valeur):
        if not valeur:
            raise serializers.ValidationError("Votre accord est nécessaire pour que nous puissions vous recontacter.")
        return valeur

    def validate_telephone(self, valeur):
        if sum(c.isdigit() for c in valeur) < 9:
            raise serializers.ValidationError("Numéro de téléphone incomplet.")
        return valeur


class DemandeInstallationSerializer(serializers.ModelSerializer):
    type_vehicule_libelle = serializers.CharField(source='get_type_vehicule_display', read_only=True)
    region_libelle = serializers.CharField(source='get_region_display', read_only=True)
    statut_libelle = serializers.CharField(source='get_statut_display', read_only=True)

    class Meta:
        model = DemandeInstallation
        fields = [
            'id', 'nom', 'prenom', 'telephone', 'email', 'region', 'region_libelle', 'commune', 'adresse',
            'type_vehicule', 'type_vehicule_libelle', 'immatriculation', 'nombre_vehicules', 'disponibilites',
            'message', 'statut', 'statut_libelle', 'rdv_date', 'rdv_lieu', 'numero_cni', 'conducteur', 'boitier',
            'date_creation', 'date_maj',
        ]
        read_only_fields = fields


class RendezVousSerializer(serializers.Serializer):
    rdv_date = serializers.DateTimeField()
    rdv_lieu = serializers.CharField(max_length=200)
    commentaire = serializers.CharField(required=False, allow_blank=True)

    def validate_rdv_date(self, valeur):
        if valeur <= timezone.now():
            raise serializers.ValidationError("Le rendez-vous doit être dans le futur.")
        return valeur


class InstallationSerializer(serializers.Serializer):
    """Saisi par l'administrateur une fois le boîtier posé et la pièce d'identité vérifiée."""

    numero_cni = serializers.CharField(max_length=30)
    # Obligatoire si le demandeur n'en avait pas donné : le compte conducteur en a besoin.
    email = serializers.EmailField(required=False)
    immatriculation = serializers.CharField(max_length=30, required=False, allow_blank=True)
    commentaire = serializers.CharField(required=False, allow_blank=True)


class HistoriqueDemandeSerializer(serializers.ModelSerializer):
    statut_nouveau_libelle = serializers.CharField(source='get_statut_nouveau_display', read_only=True)
    acteur_nom = serializers.SerializerMethodField()

    class Meta:
        model = HistoriqueDemande
        fields = [
            'id', 'statut_precedent', 'statut_nouveau', 'statut_nouveau_libelle', 'acteur', 'acteur_nom',
            'role_acteur', 'commentaire', 'date',
        ]
        read_only_fields = fields

    def get_acteur_nom(self, obj):
        return f"{obj.acteur.prenom} {obj.acteur.nom}" if obj.acteur else None


class MessageContactCreationSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessageContact
        fields = ['nom', 'email', 'telephone', 'sujet', 'message']


class MessageContactSerializer(serializers.ModelSerializer):
    sujet_libelle = serializers.CharField(source='get_sujet_display', read_only=True)

    class Meta:
        model = MessageContact
        fields = [
            'id', 'nom', 'email', 'telephone', 'sujet', 'sujet_libelle', 'message', 'traite', 'traite_par',
            'traite_le', 'date_creation',
        ]
        read_only_fields = fields
