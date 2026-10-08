from django.core.cache import cache
from django.db import transaction
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.core.cache_keys import CACHE_CLE_ZONES_ACTIVES
from apps.core.permissions import EstAdminOuAnaser, EstSuperAdministrateur
from apps.core.regionalisation import FiltreRegional

from .clustering import generer_zones_depuis_incidents
from .models import HistoriqueStatutZone, Zone
from .serializers import HistoriqueStatutZoneSerializer, ZoneSerializer


class ZoneViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ZoneSerializer
    # Super admin : toutes les zones. Administrateur régional : uniquement celles de sa
    # région (queryset vide si region=None). ANASER et public : comportement inchangé
    # (FiltreRegional ne restreint que role='admin' — voir get_queryset ci-dessous pour le
    # filtre public existant, appliqué AVANT celui-ci, les deux se composent). S'applique
    # aussi à `statut` et `historique` via get_object() -> filter_queryset(get_queryset()).
    filter_backends = [FiltreRegional]
    region_lookup_field = 'region'

    def get_permissions(self):
        if self.action in ('changer_statut', 'historique'):
            # Le rôle exact autorisé dépend de la transition demandée : voir Zone.TRANSITIONS.
            return [EstAdminOuAnaser()]
        if self.action == 'generer':
            # Le clustering est national (voir clustering.py) : un administrateur régional
            # ne doit pas pouvoir recalculer les zones de tout le pays.
            return [EstSuperAdministrateur()]
        return [AllowAny()]

    def get_queryset(self):
        queryset = Zone.objects.all().order_by('-score_danger')
        utilisateur = self.request.user
        # Tous les statuts sont visibles des comptes de gestion ; le public ne voit que les
        # zones officiellement reconnues par l'ANASER (fin du workflow de validation).
        est_gestion = utilisateur.is_authenticated and getattr(utilisateur, 'role', None) in (
            'admin', 'super_admin', 'anaser',
        )
        if not est_gestion:
            queryset = queryset.filter(statut_validation=Zone.StatutValidation.RECONNUE, actif=True)
        return queryset

    @action(detail=True, methods=['patch'], url_path='statut')
    def changer_statut(self, request, pk=None):
        zone = self.get_object()
        ancien = zone.statut_validation
        nouveau = request.data.get('statut_validation')
        commentaire = (request.data.get('commentaire') or '').strip()
        role = getattr(request.user, 'role', None)

        roles_autorises = Zone.TRANSITIONS.get((ancien, nouveau)) if isinstance(nouveau, str) else None
        if roles_autorises is None:
            raise ValidationError({'statut_validation': f"Transition impossible : « {ancien} » → « {nouveau} »."})
        if role not in roles_autorises:
            raise PermissionDenied("Votre rôle ne permet pas cette décision sur la zone.")
        if (ancien, nouveau) in Zone.TRANSITIONS_A_MOTIVER and not commentaire:
            raise ValidationError({'commentaire': "Cette décision doit être motivée."})

        with transaction.atomic():
            zone.statut_validation = nouveau
            zone.save(update_fields=['statut_validation', 'date_maj'])
            HistoriqueStatutZone.objects.create(
                zone=zone, statut_precedent=ancien, statut_nouveau=nouveau,
                acteur=request.user, role_acteur=role, commentaire=commentaire,
            )
        cache.delete(CACHE_CLE_ZONES_ACTIVES)
        return Response(ZoneSerializer(zone).data)

    @action(detail=True, methods=['get'])
    def historique(self, request, pk=None):
        zone = self.get_object()
        entrees = zone.historique_statuts.select_related('acteur')
        return Response(HistoriqueStatutZoneSerializer(entrees, many=True).data)

    @action(detail=False, methods=['post'])
    def generer(self, request):
        resultat = generer_zones_depuis_incidents()
        return Response(resultat)
