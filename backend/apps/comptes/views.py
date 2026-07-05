from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.core.permissions import EstAdministrateur

from .models import Administrateur
from .serializers import (
    AdministrateurCreationSerializer,
    AdministrateurSerializer,
    SafeRoadTokenObtainPairSerializer,
)


class LoginView(TokenObtainPairView):
    serializer_class = SafeRoadTokenObtainPairSerializer


class RefreshView(TokenRefreshView):
    pass


class MoiView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(AdministrateurSerializer(request.user).data)


class AdministrateurViewSet(viewsets.ModelViewSet):
    queryset = Administrateur.objects.all().order_by('email')
    permission_classes = [EstAdministrateur]

    def get_serializer_class(self):
        if self.action == 'create':
            return AdministrateurCreationSerializer
        return AdministrateurSerializer
