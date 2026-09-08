import secrets

from django.core.cache import cache
from django.utils import timezone
from geopy.distance import geodesic
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.alertes.models import AlerteProximite
from apps.alertes.utils import determiner_canaux_alerte
from apps.configuration.models import ConfigurationSysteme
from apps.core.cache_keys import CACHE_CLE_ZONES_ACTIVES, CACHE_TTL_ZONES_ACTIVES_SECONDES
from apps.core.geo import boite_englobante
from apps.core.pagination import PaginationListeGestion
from apps.core.permissions import EstAdministrateur, EstBoitier
from apps.core.regionalisation import FiltreRegional
from apps.zones.models import Zone

from .models import Boitier
from .serializers import BoitierCreationSerializer, BoitierSerializer, PositionSerializer


def _zones_validees_actives():
    """Liste des zones validées/actives, en cache court : elle ne change qu'à la
    validation d'une zone par un admin, pas à chaque position remontée par un boîtier
    — qui est le chemin le plus sollicité du système (un appel par boîtier et par
    intervalle de synchronisation)."""
    zones = cache.get(CACHE_CLE_ZONES_ACTIVES)
    if zones is None:
        zones = list(
            Zone.objects.filter(statut_validation=Zone.StatutValidation.VALIDEE, actif=True)
            .only('id', 'latitude_centre', 'longitude_centre', 'niveau_danger')
        )
        cache.set(CACHE_CLE_ZONES_ACTIVES, zones, CACHE_TTL_ZONES_ACTIVES_SECONDES)
    return zones


class BoitierViewSet(viewsets.ModelViewSet):
    queryset = Boitier.objects.all().order_by('-date_creation')
    permission_classes = [EstAdministrateur]
    pagination_class = PaginationListeGestion
    # Super admin : tous les boîtiers. Administrateur régional : uniquement ceux de
    # request.user.region (queryset vide si region=None). ANASER n'a de toute façon pas
    # accès à ce ViewSet (EstAdministrateur ne couvre pas ce rôle) — comportement inchangé.
    # S'applique automatiquement à list/retrieve/update/partial_update/destroy (et à
    # regenerer_cle, qui passe par get_object()) puisque tous appellent get_queryset() via
    # filter_queryset() — un boîtier d'une autre région n'existe simplement pas dans le
    # queryset filtré, donc 404 comme s'il n'existait pas, pas seulement absent de la liste.
    filter_backends = [FiltreRegional]
    region_lookup_field = 'region'

    def get_serializer_class(self):
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
        data = BoitierSerializer(boitier).data
        data['api_key'] = api_key_en_clair
        return Response(data, status=201)

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

    @action(detail=False, methods=['post'], permission_classes=[EstBoitier])
    def position(self, request):
        boitier = request.user
        serializer = PositionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        latitude = serializer.validated_data['latitude']
        longitude = serializer.validated_data['longitude']

        boitier.derniere_latitude = latitude
        boitier.derniere_longitude = longitude
        boitier.derniere_localisation_maj = timezone.now()
        boitier.save(update_fields=['derniere_latitude', 'derniere_longitude', 'derniere_localisation_maj'])

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
                    boitier=boitier, zone=zone_proche, distance_metres=distance_min,
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
