from django.core.cache import cache
from django.db.models import Q
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.pagination import PaginationListeGestion
from apps.core.permissions import EstAdministrateur, EstConducteur
from apps.core.throttling import LoginRateThrottle

from .models import Conducteur
from .serializers import ConducteurGestionSerializer, ConducteurInscriptionSerializer, ProfilConducteurSerializer

# Clé de cache utilisée pour révoquer un refresh token conducteur (voir ConducteurLogoutView).
_CLE_JTI_REVOQUE = 'conducteur:jti-revoque:{jti}'


def _construire_refresh(conducteur):
    """Émission manuelle du token — volontairement PAS `RefreshToken.for_user()` : cette
    méthode insère une ligne dans `OutstandingToken` (app `token_blacklist`, installée),
    dont le champ `user` est une ForeignKey figée sur `settings.AUTH_USER_MODEL`
    (`comptes.Administrateur`). Lui passer un `Conducteur` lève
    `ValueError: ... must be a "Administrateur" instance` — constaté en test. On construit
    donc le token à la main (mêmes étapes que `for_user()`, sans la partie `OutstandingToken`),
    et on ajoute les claims métier comme le fait `SafeRoadTokenObtainPairSerializer` pour
    Administrateur. `type_compte` est la claim dont dépend `ConducteurJWTAuthentication`
    pour savoir résoudre ce token contre `Conducteur` et non contre `Administrateur`
    (voir apps/core/authentication.py)."""
    refresh = RefreshToken()
    refresh[api_settings.USER_ID_CLAIM] = str(conducteur.pk)
    refresh['type_compte'] = 'conducteur'
    refresh['role'] = 'conducteur'
    refresh['email'] = conducteur.email
    refresh['nom'] = conducteur.nom
    refresh['prenom'] = conducteur.prenom
    return refresh


def _tokens_pour_conducteur(conducteur):
    refresh = _construire_refresh(conducteur)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


def _refresh_conducteur_valide(raw_refresh):
    """Décode un refresh token et vérifie qu'il appartient bien à un conducteur et n'a pas
    été révoqué. Ne touche jamais `OutstandingToken`/`BlacklistedToken` (voir
    `_construire_refresh`) — la révocation est gérée via le cache, voir
    `ConducteurLogoutView`."""
    try:
        refresh = RefreshToken(raw_refresh)
    except TokenError as erreur:
        raise ValidationError({'refresh': str(erreur)})

    if refresh.get('type_compte') != 'conducteur':
        raise ValidationError({'refresh': "Ce refresh token n'est pas un token conducteur."})

    if cache.get(_CLE_JTI_REVOQUE.format(jti=refresh[api_settings.JTI_CLAIM])):
        raise AuthenticationFailed("Ce token a été révoqué (déconnexion).")

    return refresh


class InscriptionConducteurView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'inscription'

    def post(self, request):
        serializer = ConducteurInscriptionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ConnexionConducteurView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]
    throttle_scope = 'login'

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        if not email or not password:
            raise ValidationError({'detail': "Email et mot de passe requis."})

        try:
            conducteur = Conducteur.objects.get(email=Conducteur.objects.normalize_email(email))
        except Conducteur.DoesNotExist:
            return Response({'detail': "Email ou mot de passe incorrect."}, status=status.HTTP_401_UNAUTHORIZED)

        if not conducteur.check_password(password) or not conducteur.is_active:
            return Response({'detail': "Email ou mot de passe incorrect."}, status=status.HTTP_401_UNAUTHORIZED)

        return Response(_tokens_pour_conducteur(conducteur))


class RafraichirConducteurView(APIView):
    """Équivalent conducteur de /auth/refresh/ — ne peut pas réutiliser TokenRefreshView
    (SIMPLE_JWT.ROTATE_REFRESH_TOKENS=True) : la rotation appelle `.blacklist()` sur
    l'ancien refresh, qui déréférence `OutstandingToken.user` en `Administrateur` (même
    incompatibilité que dans `_construire_refresh`). Pas de rotation ici : un même refresh
    conducteur reste valable jusqu'à son expiration naturelle ou une déconnexion explicite."""

    permission_classes = [AllowAny]

    def post(self, request):
        raw_refresh = request.data.get('refresh')
        if not raw_refresh:
            raise ValidationError({'refresh': "Ce champ est requis."})
        refresh = _refresh_conducteur_valide(raw_refresh)
        return Response({'access': str(refresh.access_token)})


class DeconnexionConducteurView(APIView):
    """Révoque le refresh token soumis. Ne peut pas réutiliser LogoutView (même
    incompatibilité `OutstandingToken.user`) : la révocation est stockée dans le cache
    plutôt que dans `token_blacklist`, avec un TTL aligné sur l'expiration du token."""

    permission_classes = [EstConducteur]

    def post(self, request):
        raw_refresh = request.data.get('refresh')
        if not raw_refresh:
            raise ValidationError({'refresh': "Ce champ est requis."})
        refresh = _refresh_conducteur_valide(raw_refresh)

        ttl_secondes = max(int(refresh['exp'] - refresh.current_time.timestamp()), 0)
        cache.set(_CLE_JTI_REVOQUE.format(jti=refresh[api_settings.JTI_CLAIM]), True, timeout=ttl_secondes)
        return Response(status=status.HTTP_205_RESET_CONTENT)


class MoiConducteurView(APIView):
    permission_classes = [EstConducteur]

    def get(self, request):
        return Response(ProfilConducteurSerializer(request.user).data)

    def patch(self, request):
        serializer = ProfilConducteurSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ConducteurGestionViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Comptes conducteurs vus par un administrateur (lecture seule).

    Super admin : tous. Administrateur régional : les conducteurs équipés d'un boîtier de sa
    région, plus ceux qui n'ont encore aucun boîtier (sans quoi il ne pourrait jamais en
    équiper un nouveau). Filtres : ?q= (nom, prénom, email, téléphone), ?disponible=1 (sans boîtier).
    """

    serializer_class = ConducteurGestionSerializer
    permission_classes = [EstAdministrateur]
    pagination_class = PaginationListeGestion

    def get_queryset(self):
        queryset = Conducteur.objects.select_related('boitier').order_by('nom', 'prenom')
        utilisateur = self.request.user
        if utilisateur.role == 'admin':
            de_sa_region = Q(boitier__region=utilisateur.region) if utilisateur.region else Q(pk__in=[])
            queryset = queryset.filter(de_sa_region | Q(boitier__isnull=True))

        recherche = self.request.query_params.get('q', '').strip()
        if recherche:
            queryset = queryset.filter(
                Q(nom__icontains=recherche) | Q(prenom__icontains=recherche)
                | Q(email__icontains=recherche) | Q(telephone__icontains=recherche)
            )
        if self.request.query_params.get('disponible') in ('1', 'true'):
            queryset = queryset.filter(boitier__isnull=True)
        return queryset
