import secrets

from django.core.cache import cache
from django.db import transaction
from django.db.models import Count, OuterRef, Subquery
from django.utils import timezone
from geopy.distance import geodesic
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.alertes.models import AlerteProximite
from apps.alertes.utils import determiner_canaux_alerte
from apps.conducteurs.models import Conducteur
from apps.configuration.models import ConfigurationSysteme
from apps.core.cache_keys import CACHE_CLE_ZONES_ACTIVES, CACHE_TTL_ZONES_ACTIVES_SECONDES
from apps.core.geo import boite_englobante
from apps.core.pagination import PaginationListeGestion
from apps.core.permissions import EstAdministrateur, EstAnaser, EstBoitier
from apps.core.regionalisation import FiltreRegional
from apps.zones.models import Zone

from .models import Boitier, HistoriqueBoitier
from .serializers import (
    AffectationSerializer,
    BoitierAnaserSerializer,
    BoitierCreationSerializer,
    BoitierSerializer,
    HistoriqueBoitierSerializer,
    PositionSerializer,
)

# Numéros d'urgence au Sénégal, rappelés dans les SMS d'alerte.
NUMEROS_SECOURS = {'samu': '1515', 'sapeurs_pompiers': '18', 'police': '17'}

# Écart toléré entre l'horloge GPS du boîtier et celle du serveur.
DERIVE_HORLOGE_TOLEREE_MINUTES = 5


def _zones_validees_actives():
    """Liste des zones reconnues par l'ANASER et actives (seules zones publiques), en cache
    court : elle ne change qu'à un changement de statut d'une zone, pas à chaque position
    remontée par un boîtier — qui est le chemin le plus sollicité du système (un appel par
    boîtier et par intervalle de synchronisation)."""
    zones = cache.get(CACHE_CLE_ZONES_ACTIVES)
    if zones is None:
        zones = list(
            Zone.objects.filter(statut_validation=Zone.StatutValidation.RECONNUE, actif=True)
            .only('id', 'latitude_centre', 'longitude_centre', 'niveau_danger')
        )
        cache.set(CACHE_CLE_ZONES_ACTIVES, zones, CACHE_TTL_ZONES_ACTIVES_SECONDES)
    return zones


def _tracer(boitier, evenement, acteur, conducteur=None, commentaire=''):
    HistoriqueBoitier.objects.create(
        boitier=boitier, evenement=evenement, conducteur=conducteur, acteur=acteur,
        role_acteur=getattr(acteur, 'role', ''), commentaire=commentaire,
    )


class BoitierViewSet(viewsets.ModelViewSet):
    queryset = Boitier.objects.all().order_by('-date_creation')
    permission_classes = [EstAdministrateur]
    pagination_class = PaginationListeGestion
    # Super admin : tous les boîtiers. Administrateur régional : uniquement ceux de
    # request.user.region (queryset vide si region=None). ANASER : lecture seule nationale,
    # limitée aux informations non personnelles (voir get_permissions/BoitierAnaserSerializer).
    # S'applique automatiquement à list/retrieve/update/partial_update/destroy (et à
    # regenerer_cle, qui passe par get_object()) puisque tous appellent get_queryset() via
    # filter_queryset() — un boîtier d'une autre région n'existe simplement pas dans le
    # queryset filtré, donc 404 comme s'il n'existait pas, pas seulement absent de la liste.
    filter_backends = [FiltreRegional]
    region_lookup_field = 'region'

    def _est_anaser(self):
        return getattr(self.request.user, 'role', None) == 'anaser'

    def get_permissions(self):
        # ANASER (acteur institutionnel) consulte les boîtiers pour l'analyse, sans jamais
        # les gérer : list/retrieve seulement. Toute autre action garde sa permission
        # habituelle (EstAdministrateur, ou EstBoitier pour `position`).
        if self.action in ('list', 'retrieve') and self._est_anaser():
            return [EstAnaser()]
        return super().get_permissions()

    def get_queryset(self):
        derniere_affectation = HistoriqueBoitier.objects.filter(
            boitier=OuterRef('pk'), evenement=HistoriqueBoitier.Evenement.AFFECTE,
        ).order_by('-date', '-id').values('date')[:1]
        queryset = (
            super().get_queryset().select_related('conducteur')
            .annotate(date_derniere_affectation=Subquery(derniere_affectation))
        )
        if self._est_anaser():
            queryset = queryset.annotate(
                nombre_incidents=Count('incidents', distinct=True),
                nombre_alertes_proximite=Count('alertes_proximite', distinct=True),
            )
        return queryset

    def get_serializer_class(self):
        if self._est_anaser():
            return BoitierAnaserSerializer
        if self.action == 'create':
            return BoitierCreationSerializer
        return BoitierSerializer

    def create(self, request, *args, **kwargs):
        donnees = request.data.copy()
        if getattr(request.user, 'role', None) == 'admin':
            # Un administrateur régional ne peut jamais rattacher un boîtier à une autre
            # région que la sienne : la valeur envoyée par le client est purement et
            # simplement remplacée, jamais fusionnée — seul request.user.region fait foi
            # (même principe que FiltreRegional). Un super administrateur reste libre de
            # choisir la région du boîtier créé.
            donnees['region'] = request.user.region
        serializer = self.get_serializer(data=donnees)
        serializer.is_valid(raise_exception=True)
        boitier = serializer.save()
        api_key_en_clair = secrets.token_urlsafe(32)
        boitier.set_api_key(api_key_en_clair)
        boitier.save(update_fields=['api_key_hash'])
        _tracer(boitier, HistoriqueBoitier.Evenement.ENREGISTRE, request.user)
        data = BoitierSerializer(boitier).data
        data['api_key'] = api_key_en_clair
        return Response(data, status=201)

    @action(detail=True, methods=['post'])
    def affecter(self, request, pk=None):
        """Rattache le boîtier à un conducteur (boîtier installé sur son véhicule). Si le
        boîtier équipait déjà quelqu'un d'autre, ce conducteur est d'abord désaffecté. Un
        conducteur ne peut porter qu'un boîtier : il doit être libéré de l'ancien avant."""
        donnees = AffectationSerializer(data=request.data)
        donnees.is_valid(raise_exception=True)
        commentaire = donnees.validated_data.get('commentaire', '')

        with transaction.atomic():
            boitier = self.get_object()
            try:
                conducteur = Conducteur.objects.select_for_update().get(pk=donnees.validated_data['conducteur'])
            except Conducteur.DoesNotExist:
                raise ValidationError({'conducteur': "Conducteur introuvable."})
            if not conducteur.is_active:
                raise ValidationError({'conducteur': "Ce compte conducteur est désactivé."})
            if conducteur.boitier_id == boitier.id:
                raise ValidationError({'conducteur': "Ce boîtier est déjà affecté à ce conducteur."})
            if conducteur.boitier_id is not None:
                raise ValidationError({'conducteur': "Ce conducteur est déjà équipé d'un autre boîtier : désaffectez-le d'abord."})

            precedent = Conducteur.objects.filter(boitier=boitier).first()
            if precedent:
                precedent.boitier = None
                precedent.save(update_fields=['boitier'])
                _tracer(boitier, HistoriqueBoitier.Evenement.DESAFFECTE, request.user, precedent,
                        f"Réaffecté à {conducteur.prenom} {conducteur.nom}")

            conducteur.boitier = boitier
            conducteur.save(update_fields=['boitier'])
            if 'numero_immatriculation' in donnees.validated_data:
                boitier.numero_immatriculation = donnees.validated_data['numero_immatriculation']
                boitier.save(update_fields=['numero_immatriculation', 'date_maj'])
            _tracer(boitier, HistoriqueBoitier.Evenement.AFFECTE, request.user, conducteur, commentaire)

        # Relu via get_queryset() : conducteur et date d'affectation annotée à jour.
        return Response(BoitierSerializer(self.get_queryset().get(pk=boitier.pk)).data)

    @action(detail=True, methods=['post'])
    def desaffecter(self, request, pk=None):
        with transaction.atomic():
            boitier = self.get_object()
            conducteur = Conducteur.objects.select_for_update().filter(boitier=boitier).first()
            if conducteur is None:
                raise ValidationError("Ce boîtier n'est affecté à aucun conducteur.")
            conducteur.boitier = None
            conducteur.save(update_fields=['boitier'])
            _tracer(boitier, HistoriqueBoitier.Evenement.DESAFFECTE, request.user, conducteur,
                    (request.data.get('commentaire') or '').strip())
        # Relu via get_queryset() : conducteur et date d'affectation annotée à jour.
        return Response(BoitierSerializer(self.get_queryset().get(pk=boitier.pk)).data)

    @action(detail=True, methods=['get'])
    def historique(self, request, pk=None):
        boitier = self.get_object()
        entrees = boitier.historique.select_related('conducteur', 'acteur')
        return Response(HistoriqueBoitierSerializer(entrees, many=True).data)

    @action(detail=True, methods=['post'], url_path='regenerer-cle')
    def regenerer_cle(self, request, pk=None):
        boitier = self.get_object()
        config = ConfigurationSysteme.instance()
        api_key_en_clair = secrets.token_urlsafe(32)
        boitier.regenerer_api_key(api_key_en_clair, config.duree_grace_regeneration_cle_heures)
        boitier.save(update_fields=['api_key_hash', 'api_key_hash_ancien', 'api_key_hash_ancien_expire_le'])
        return Response({
            'id': str(boitier.id),
            'api_key': api_key_en_clair,
            'ancienne_cle_valide_jusqu_a': boitier.api_key_hash_ancien_expire_le,
        })

    @action(detail=False, methods=['get'], permission_classes=[EstBoitier])
    def configuration(self, request):
        """Paramètres que le firmware récupère au démarrage puis périodiquement : seuils de
        détection, rythme d'envoi, et numéro du contact d'urgence du conducteur qui porte le
        boîtier (SMS envoyé par le SIM800L lui-même en cas de choc critique, sans dépendre
        d'Internet ni du serveur)."""
        boitier = request.user
        config = ConfigurationSysteme.instance()
        conducteur = getattr(boitier, 'conducteur', None)
        contact = None
        if conducteur and conducteur.contact_urgence_telephone:
            contact = {'nom': conducteur.contact_urgence_nom, 'telephone': conducteur.contact_urgence_telephone}
        return Response({
            'seuil_acceleration_critique': config.seuil_acceleration_critique,
            'seuil_vitesse_choc': config.seuil_vitesse_choc,
            'intervalle_sync_secondes': config.intervalle_sync_secondes,
            'rayon_alerte_proximite_metres': config.rayon_alerte_proximite_metres,
            'conducteur': f"{conducteur.prenom} {conducteur.nom}" if conducteur else None,
            'immatriculation': boitier.numero_immatriculation or None,
            'contact_urgence': contact,
            'numeros_secours': NUMEROS_SECOURS,
        })

    @action(detail=False, methods=['post'], permission_classes=[EstBoitier])
    def position(self, request):
        boitier = request.user
        serializer = PositionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        latitude = serializer.validated_data['latitude']
        longitude = serializer.validated_data['longitude']

        boitier.derniere_latitude = latitude
        boitier.derniere_longitude = longitude
        maintenant = timezone.now()
        boitier.derniere_localisation_maj = maintenant
        horodatage = serializer.validated_data.get('horodatage')
        # Un module GPS sans fix peut renvoyer une date fantaisiste (année 2080, etc.) : une date
        # dans le futur n'est pas gardée, plutôt que de fausser la latence affichée.
        if horodatage and horodatage > maintenant + timezone.timedelta(minutes=DERIVE_HORLOGE_TOLEREE_MINUTES):
            horodatage = None
        boitier.derniere_position_horodatage = horodatage
        boitier.derniere_vitesse_gps = serializer.validated_data.get('vitesse_gps')
        boitier.dernier_hdop = serializer.validated_data.get('hdop')
        boitier.dernier_nombre_satellites = serializer.validated_data.get('nombre_satellites')
        boitier.save(update_fields=[
            'derniere_latitude', 'derniere_longitude', 'derniere_localisation_maj',
            'derniere_vitesse_gps', 'dernier_hdop', 'dernier_nombre_satellites', 'derniere_position_horodatage',
        ])

        config = ConfigurationSysteme.instance()
        position_boitier = (latitude, longitude)
        zone_proche = None
        distance_min = None

        delta_latitude, delta_longitude = boite_englobante(latitude, longitude, config.rayon_alerte_proximite_metres)
        candidats = [
            zone for zone in _zones_validees_actives()
            if abs(zone.latitude_centre - latitude) <= delta_latitude
            and abs(zone.longitude_centre - longitude) <= delta_longitude
        ]
        for zone in candidats:
            distance_metres = geodesic(position_boitier, (zone.latitude_centre, zone.longitude_centre)).meters
            if distance_metres <= config.rayon_alerte_proximite_metres:
                if zone_proche is None or distance_metres < distance_min:
                    zone_proche = zone
                    distance_min = distance_metres

        alerte_proximite = False
        canaux = determiner_canaux_alerte(zone_proche.niveau_danger if zone_proche else None)
        if zone_proche is not None:
            cooldown_debut = timezone.now() - timezone.timedelta(minutes=config.cooldown_alerte_proximite_minutes)
            deja_notifiee_recemment = AlerteProximite.objects.filter(
                boitier=boitier, zone=zone_proche, date_creation__gte=cooldown_debut,
            ).exists()
            if not deja_notifiee_recemment:
                AlerteProximite.objects.create(
                    boitier=boitier, conducteur=getattr(boitier, 'conducteur', None),
                    zone=zone_proche, distance_metres=distance_min,
                    latitude=latitude, longitude=longitude, **canaux,
                )
                alerte_proximite = True

        return Response({
            'alerte_proximite': alerte_proximite,
            'zone': str(zone_proche.id) if zone_proche else None,
            'distance_metres': distance_min,
            'niveau_danger': zone_proche.niveau_danger if zone_proche else None,
            **canaux,
        })
