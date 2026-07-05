import secrets

from django.utils import timezone
from geopy.distance import geodesic
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.alertes.models import AlerteProximite
from apps.configuration.models import ConfigurationSysteme
from apps.core.permissions import EstAdministrateur, EstBoitier
from apps.zones.models import Zone

from .models import Boitier
from .serializers import BoitierCreationSerializer, BoitierSerializer, PositionSerializer


class BoitierViewSet(viewsets.ModelViewSet):
    queryset = Boitier.objects.all().order_by('-date_creation')
    permission_classes = [EstAdministrateur]

    def get_serializer_class(self):
        if self.action == 'create':
            return BoitierCreationSerializer
        return BoitierSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
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
        api_key_en_clair = secrets.token_urlsafe(32)
        boitier.set_api_key(api_key_en_clair)
        boitier.save(update_fields=['api_key_hash'])
        return Response({'id': str(boitier.id), 'api_key': api_key_en_clair})

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

        for zone in Zone.objects.filter(statut_validation=Zone.StatutValidation.VALIDEE, actif=True):
            distance_metres = geodesic(position_boitier, (zone.latitude_centre, zone.longitude_centre)).meters
            if distance_metres <= config.rayon_alerte_proximite_metres:
                if zone_proche is None or distance_metres < distance_min:
                    zone_proche = zone
                    distance_min = distance_metres

        alerte_proximite = False
        if zone_proche is not None:
            cooldown_debut = timezone.now() - timezone.timedelta(minutes=config.cooldown_alerte_proximite_minutes)
            deja_notifiee_recemment = AlerteProximite.objects.filter(
                boitier=boitier, zone=zone_proche, date_creation__gte=cooldown_debut,
            ).exists()
            if not deja_notifiee_recemment:
                AlerteProximite.objects.create(
                    boitier=boitier, zone=zone_proche, distance_metres=distance_min,
                    latitude=latitude, longitude=longitude, notifiee=True,
                )
                alerte_proximite = True

        return Response({
            'alerte_proximite': alerte_proximite,
            'zone': str(zone_proche.id) if zone_proche else None,
            'distance_metres': distance_min,
        })
