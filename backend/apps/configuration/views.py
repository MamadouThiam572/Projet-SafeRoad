from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import EstAdministrateur, EstSuperAdministrateur

from .models import ConfigurationSysteme
from .serializers import ConfigurationSystemeSerializer


class ConfigurationSystemeView(APIView):
    # Lecture pour tout administrateur ; modification réservée au super administrateur :
    # ces seuils s'appliquent à tout le pays, pas à la seule région d'un administrateur régional.
    def get_permissions(self):
        if self.request.method == 'GET':
            return [EstAdministrateur()]
        return [EstSuperAdministrateur()]

    def get(self, request):
        return Response(ConfigurationSystemeSerializer(ConfigurationSysteme.instance()).data)

    def put(self, request):
        config = ConfigurationSysteme.instance()
        serializer = ConfigurationSystemeSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(modifie_par=request.user)
        return Response(serializer.data)
