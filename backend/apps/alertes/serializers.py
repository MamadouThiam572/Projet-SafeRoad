from django.utils import timezone
from rest_framework import serializers

from apps.core.geo import region_depuis_gps
from apps.core.regions import Region

from .models import Alerte, AlerteProximite


class AlerteSerializer(serializers.ModelSerializer):
    """Alerte telle que l'affiche le fil de l'administrateur : libellés, titre, description,
    lieu et informations du véhicule calculés à partir de la source."""

    source_libelle = serializers.CharField(source='get_source_display', read_only=True)
    niveau_libelle = serializers.CharField(source='get_niveau_display', read_only=True)
    statut_libelle = serializers.CharField(source='get_statut_display', read_only=True)
    titre = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()
    lieu = serializers.SerializerMethodField()
    vehicule = serializers.SerializerMethodField()

    class Meta:
        model = Alerte
        fields = [
            'id', 'source', 'source_libelle', 'niveau', 'niveau_libelle', 'motif', 'statut', 'statut_libelle',
            'titre', 'description', 'lieu', 'vehicule', 'incident', 'zone', 'boitier', 'conducteur',
            'prise_en_charge_par', 'prise_en_charge_le', 'traitee_par', 'traitee_le', 'date_creation',
        ]
        read_only_fields = fields

    def get_titre(self, obj):
        if obj.motif == Alerte.Motif.HORS_LIGNE:
            return "Boîtier hors ligne"
        titre = f"{obj.incident.get_type_incident_display()} détecté" if obj.incident else "Incident détecté"
        return f"{titre} sur une zone à risque" if obj.source == Alerte.Source.ZONE else titre

    def get_description(self, obj):
        if obj.motif == Alerte.Motif.HORS_LIGNE:
            derniere = obj.boitier.derniere_localisation_maj if obj.boitier else None
            if derniere is None:
                return "Aucune donnée reçue de ce boîtier."
            minutes = int((timezone.now() - derniere).total_seconds() // 60)
            return f"Aucune donnée reçue depuis {minutes} min."
        if obj.incident is None:
            return ""
        description = f"Gravité {obj.incident.get_niveau_gravite_display().lower()}, détecté par le boîtier embarqué"
        vitesse = obj.incident.vitesse_radar if obj.incident.vitesse_radar is not None else obj.incident.vitesse_gps
        return f"{description} à {round(vitesse)} km/h." if vitesse is not None else f"{description}."

    def get_lieu(self, obj):
        if obj.zone:
            region = obj.zone.get_region_display() if obj.zone.region else None
            return f"{obj.zone} ({region})" if region else str(obj.zone)
        if obj.incident:
            slug = region_depuis_gps(obj.incident.latitude, obj.incident.longitude)
        elif obj.boitier and obj.boitier.derniere_latitude is not None:
            slug = region_depuis_gps(obj.boitier.derniere_latitude, obj.boitier.derniere_longitude)
        else:
            slug = obj.boitier.region if obj.boitier else None
        return Region(slug).label if slug else None

    def get_vehicule(self, obj):
        """Immatriculation, conducteur et boîtier concernés (le « meta » du fil d'alertes)."""
        if obj.boitier is None:
            return None
        return {
            'boitier': str(obj.boitier.id),
            'immatriculation': obj.boitier.numero_immatriculation or None,
            'conducteur': f"{obj.conducteur.prenom} {obj.conducteur.nom}" if obj.conducteur else None,
        }


class AlerteProximiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = AlerteProximite
        fields = [
            'id', 'boitier', 'zone', 'distance_metres', 'latitude', 'longitude',
            'canal_led', 'canal_buzzer_declenche', 'canal_audio_declenche', 'date_creation',
        ]
        read_only_fields = fields


class AlerteConducteurSerializer(serializers.ModelSerializer):
    """Alerte « vous entrez dans une zone à risque » telle que le conducteur la revoit."""

    zone_nom = serializers.SerializerMethodField()
    niveau_danger = serializers.CharField(source='zone.niveau_danger', read_only=True)
    niveau_danger_libelle = serializers.CharField(source='zone.get_niveau_danger_display', read_only=True)
    region = serializers.CharField(source='zone.region', read_only=True, default=None)
    region_libelle = serializers.CharField(source='zone.get_region_display', read_only=True, default=None)

    class Meta:
        model = AlerteProximite
        fields = [
            'id', 'zone', 'zone_nom', 'niveau_danger', 'niveau_danger_libelle', 'region', 'region_libelle',
            'distance_metres', 'latitude', 'longitude',
            'canal_led', 'canal_buzzer_declenche', 'canal_audio_declenche', 'date_creation',
        ]
        read_only_fields = fields

    def get_zone_nom(self, obj):
        return str(obj.zone)
