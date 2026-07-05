from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from apps.boitiers.models import Boitier


class BoitierAPIKeyAuthentication(BaseAuthentication):
    """Authentifie un boîtier ESP32 via les headers X-Boitier-UUID / X-Boitier-API-Key.

    Retourne None (pas d'échec) si les headers sont absents, pour laisser la main
    à JWTAuthentication sur les endpoints partagés ; lève AuthenticationFailed
    uniquement si les headers sont présents mais invalides.
    """

    def authenticate(self, request):
        boitier_uuid = request.headers.get('X-Boitier-UUID')
        api_key = request.headers.get('X-Boitier-API-Key')

        if not boitier_uuid or not api_key:
            return None

        try:
            boitier = Boitier.objects.get(pk=boitier_uuid)
        except (Boitier.DoesNotExist, ValueError, TypeError):
            raise AuthenticationFailed('Boîtier inconnu.')

        if not boitier.verifier_api_key(api_key):
            raise AuthenticationFailed('Clé API invalide.')

        if boitier.statut != Boitier.Statut.ACTIF:
            raise AuthenticationFailed('Boîtier inactif ou en maintenance.')

        return (boitier, None)
