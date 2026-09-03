from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

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


class AdministrateurViewSet(viewsets.ModelViewSet):
    """Gestion des comptes — réservée au super administrateur (voir étude d'architecture :
    un administrateur régional ne doit jamais pouvoir créer/modifier un compte, y compris
    le sien)."""

    queryset = Administrateur.objects.all().order_by('email')
    permission_classes = [EstSuperAdministrateur]

    def get_serializer_class(self):
        if self.action == 'create':
            return AdministrateurCreationSerializer
        return AdministrateurSerializer
