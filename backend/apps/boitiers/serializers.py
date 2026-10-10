from rest_framework import serializers

from .models import Boitier, HistoriqueBoitier, HistoriqueSync


class BoitierSerializer(serializers.ModelSerializer):
    statut_libelle = serializers.CharField(source='get_statut_display', read_only=True)
    region_libelle = serializers.CharField(source='get_region_display', read_only=True)
    latence_ms = serializers.SerializerMethodField()
    # Conducteur actuellement équipé (Conducteur.boitier, OneToOne inverse) et date de l'affectation.
    conducteur = serializers.SerializerMethodField()
    date_affectation = serializers.SerializerMethodField()

    class Meta:
        model = Boitier
        fields = [
            'id', 'proprietaire_nom', 'proprietaire_telephone', 'numero_immatriculation',
            'region', 'region_libelle',
            'derniere_latitude', 'derniere_longitude', 'derniere_localisation_maj',
            'derniere_vitesse_gps', 'dernier_hdop', 'dernier_nombre_satellites',
            'derniere_position_horodatage', 'latence_ms', 'conducteur', 'date_affectation',
            'statut', 'statut_libelle', 'date_creation', 'date_maj',
        ]
        read_only_fields = [
            'id', 'derniere_latitude', 'derniere_longitude', 'derniere_localisation_maj',
            'derniere_vitesse_gps', 'dernier_hdop', 'dernier_nombre_satellites',
            'derniere_position_horodatage',
        ]

    def get_conducteur(self, obj):
        conducteur = getattr(obj, 'conducteur', None)
        if conducteur is None:
            return None
        return {'id': str(conducteur.id), 'nom': f"{conducteur.prenom} {conducteur.nom}", 'email': conducteur.email}

    def get_date_affectation(self, obj):
        if getattr(obj, 'conducteur', None) is None:
            return None
        # Annotée par BoitierViewSet.get_queryset (une seule requête pour toute la liste).
        if hasattr(obj, 'date_derniere_affectation'):
            return obj.date_derniere_affectation
        derniere = obj.historique.filter(evenement=HistoriqueBoitier.Evenement.AFFECTE).first()
        return derniere.date if derniere else None

    def get_latence_ms(self, obj):
        """Délai entre la mesure GPS et sa réception par le serveur (None sans date GPS)."""
        if not (obj.derniere_position_horodatage and obj.derniere_localisation_maj):
            return None
        delai = obj.derniere_localisation_maj - obj.derniere_position_horodatage
        return max(round(delai.total_seconds() * 1000), 0)


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
    # Date/heure GPS (ISO 8601, de préférence en UTC : « 2026-10-08T14:32:05Z »).
    horodatage = serializers.DateTimeField(required=False, allow_null=True)


class HistoriqueSyncSerializer(serializers.ModelSerializer):
    class Meta:
        model = HistoriqueSync
        fields = ['id', 'boitier', 'date_synchronisation', 'nombre_incidents_synchronises', 'succes', 'message_erreur']
        read_only_fields = fields


class AffectationSerializer(serializers.Serializer):
    conducteur = serializers.UUIDField()
    # Le véhicule suit le conducteur : l'immatriculation du véhicule où le boîtier est
    # installé peut être mise à jour au moment de l'affectation.
    numero_immatriculation = serializers.CharField(max_length=30, required=False, allow_blank=True)
    commentaire = serializers.CharField(required=False, allow_blank=True)


class HistoriqueBoitierSerializer(serializers.ModelSerializer):
    evenement_libelle = serializers.CharField(source='get_evenement_display', read_only=True)
    conducteur_nom = serializers.SerializerMethodField()
    acteur_nom = serializers.SerializerMethodField()

    class Meta:
        model = HistoriqueBoitier
        fields = [
            'id', 'evenement', 'evenement_libelle', 'conducteur', 'conducteur_nom',
            'acteur', 'acteur_nom', 'role_acteur', 'commentaire', 'date',
        ]
        read_only_fields = fields

    def get_conducteur_nom(self, obj):
        return f"{obj.conducteur.prenom} {obj.conducteur.nom}" if obj.conducteur else None

    def get_acteur_nom(self, obj):
        return f"{obj.acteur.prenom} {obj.acteur.nom}" if obj.acteur else None
