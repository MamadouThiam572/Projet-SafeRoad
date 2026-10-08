from django.urls import reverse
from rest_framework import serializers

from apps.core.geo import region_depuis_gps

from .models import HistoriqueStatutSignalement, Signalement

TAILLE_MAX_PHOTO_OCTETS = 5 * 1024 * 1024
FORMATS_PHOTO_ACCEPTES = {'JPEG', 'PNG', 'WEBP'}


class SignalementCreationSerializer(serializers.ModelSerializer):
    """Envoyé par le conducteur (multipart si une photo est jointe). La région n'est jamais
    fournie : elle est déduite de la position GPS."""

    latitude = serializers.FloatField(min_value=-90, max_value=90)
    longitude = serializers.FloatField(min_value=-180, max_value=180)
    precision_metres = serializers.FloatField(min_value=0, required=False, allow_null=True)

    class Meta:
        model = Signalement
        fields = ['type_danger', 'description', 'latitude', 'longitude', 'precision_metres', 'localite', 'photo']

    def validate_photo(self, photo):
        if photo is None:
            return photo
        if photo.size > TAILLE_MAX_PHOTO_OCTETS:
            raise serializers.ValidationError("La photo ne doit pas dépasser 5 Mo.")
        # `image` est posé par la validation Pillow de ImageField : format réel du fichier,
        # pas seulement son extension.
        format_reel = getattr(getattr(photo, 'image', None), 'format', None)
        if format_reel not in FORMATS_PHOTO_ACCEPTES:
            raise serializers.ValidationError("Formats acceptés : JPEG, PNG ou WebP.")
        return photo

    def validate(self, attrs):
        region = region_depuis_gps(attrs['latitude'], attrs['longitude'])
        if region is None:
            raise serializers.ValidationError({'latitude': "Cette position est hors du Sénégal."})
        attrs['region'] = region
        return attrs


class SignalementSerializer(serializers.ModelSerializer):
    type_danger_libelle = serializers.CharField(source='get_type_danger_display', read_only=True)
    statut_libelle = serializers.CharField(source='get_statut_display', read_only=True)
    region_libelle = serializers.CharField(source='get_region_display', read_only=True)
    conducteur_nom = serializers.SerializerMethodField()
    # Adresse protégée de la photo (jamais l'URL du fichier) : voir SignalementViewSet.photo.
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = Signalement
        fields = [
            'id', 'conducteur', 'conducteur_nom', 'boitier',
            'type_danger', 'type_danger_libelle', 'description',
            'latitude', 'longitude', 'precision_metres', 'region', 'region_libelle', 'localite',
            'photo_url', 'statut', 'statut_libelle', 'date_creation', 'date_maj',
        ]
        read_only_fields = fields

    def get_conducteur_nom(self, obj):
        return f"{obj.conducteur.prenom} {obj.conducteur.nom}" if obj.conducteur else None

    def get_photo_url(self, obj):
        if not obj.photo:
            return None
        chemin = reverse('signalement-photo', args=[obj.pk])
        requete = self.context.get('request')
        return requete.build_absolute_uri(chemin) if requete else chemin


class SignalementAnaserSerializer(SignalementSerializer):
    """ANASER analyse les dangers signalés, sans données permettant d'identifier le conducteur."""

    class Meta(SignalementSerializer.Meta):
        fields = [f for f in SignalementSerializer.Meta.fields if f not in ('conducteur', 'conducteur_nom')]
        read_only_fields = fields


class HistoriqueStatutSignalementSerializer(serializers.ModelSerializer):
    statut_precedent_libelle = serializers.CharField(source='get_statut_precedent_display', read_only=True)
    statut_nouveau_libelle = serializers.CharField(source='get_statut_nouveau_display', read_only=True)
    acteur_nom = serializers.SerializerMethodField()

    class Meta:
        model = HistoriqueStatutSignalement
        fields = [
            'id', 'statut_precedent', 'statut_precedent_libelle', 'statut_nouveau', 'statut_nouveau_libelle',
            'acteur', 'acteur_nom', 'role_acteur', 'commentaire', 'date',
        ]
        read_only_fields = fields

    def get_acteur_nom(self, obj):
        return f"{obj.acteur.prenom} {obj.acteur.nom}" if obj.acteur else None
