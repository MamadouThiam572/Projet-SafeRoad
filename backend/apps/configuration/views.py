from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import EstAdministrateur

from .models import ConfigurationSysteme
from .serializers import ConfigurationSystemeSerializer


class ConfigurationSystemeView(APIView):
    permission_classes = [EstAdministrateur]

    def get(self, request):
        return Response(ConfigurationSystemeSerializer(ConfigurationSysteme.instance()).data)

    def put(self, request):
        config = ConfigurationSysteme.instance()
        serializer = ConfigurationSystemeSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(modifie_par=request.user)
        return Response(serializer.data)
