from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.core.mots_de_passe import envoyer_lien_mot_de_passe
from apps.core.permissions import EstSuperAdministrateur
from apps.core.throttling import LoginRateThrottle

from .models import Administrateur
from .serializers import (
    AdministrateurCreationSerializer,
    AdministrateurSerializer,
    ProfilSerializer,
    SafeRoadTokenObtainPairSerializer,
)


class LoginView(TokenObtainPairView):
    serializer_class = SafeRoadTokenObtainPairSerializer
    throttle_classes = [LoginRateThrottle]
    # ScopedRateThrottle lit `throttle_scope` sur la vue (pas sur la classe de throttle) pour
    # savoir quelle entrée de DEFAULT_THROTTLE_RATES appliquer — sans cet attribut, le
    # throttle se désactive silencieusement (`allow_request` renvoie True sans rien vérifier).
    throttle_scope = 'login'


class RefreshView(TokenRefreshView):
    pass


class LogoutView(APIView):
    """Blackliste le refresh token soumis : révoque la session côté serveur."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh = request.data.get('refresh')
        if not refresh:
            raise ValidationError({'refresh': "Ce champ est requis."})
        try:
            RefreshToken(refresh).blacklist()
        except TokenError as erreur:
            raise ValidationError({'refresh': str(erreur)})
        return Response(status=205)


class MoiView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(ProfilSerializer(request.user).data)

    def patch(self, request):
        serializer = ProfilSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


def revoquer_sessions_personnel(utilisateur):
    """Blackliste tous les refresh tokens émis pour ce compte : après une réinitialisation de
    mot de passe ou une désactivation, plus aucune session ne peut être prolongée (l'access
    token en cours expire de lui-même, 1 h au plus)."""
    for jeton in OutstandingToken.objects.filter(user=utilisateur):
        BlacklistedToken.objects.get_or_create(token=jeton)


class AdministrateurViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin,
                            mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """Gestion des comptes — réservée au super administrateur (voir étude d'architecture :
    un administrateur régional ne doit jamais pouvoir créer/modifier un compte, y compris
    le sien). Pas de suppression : un compte se désactive (is_active), ce qui conserve la
    trace de ses décisions (zones, signalements, incidents...)."""

    queryset = Administrateur.objects.all().order_by('email')
    permission_classes = [EstSuperAdministrateur]

    def get_serializer_class(self):
        if self.action == 'create':
            return AdministrateurCreationSerializer
        return AdministrateurSerializer

    def perform_create(self, serializer):
        compte = serializer.save()
        if not compte.has_usable_password():
            envoyer_lien_mot_de_passe(compte, invitation=True)

    def perform_update(self, serializer):
        compte = serializer.instance
        if compte.pk == self.request.user.pk:
            # Le super administrateur ne peut pas se retirer à lui-même l'accès à la plateforme.
            if serializer.validated_data.get('is_active') is False:
                raise ValidationError({'is_active': "Vous ne pouvez pas désactiver votre propre compte."})
            if serializer.validated_data.get('role', compte.role) != compte.role:
                raise ValidationError({'role': "Vous ne pouvez pas changer votre propre rôle."})
        compte = serializer.save()
        if not compte.is_active:
            revoquer_sessions_personnel(compte)

    @action(detail=True, methods=['post'], url_path='reinitialiser-mot-de-passe')
    def reinitialiser_mot_de_passe(self, request, pk=None):
        """Envoie au titulaire du compte un lien pour choisir un nouveau mot de passe."""
        compte = self.get_object()
        if not compte.is_active:
            raise ValidationError("Ce compte est désactivé : réactivez-le avant d'envoyer un lien.")
        envoyer_lien_mot_de_passe(compte)
        return Response({'detail': f"Un lien de réinitialisation a été envoyé à {compte.email}."})
