from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.boitiers.models import Boitier
from apps.conducteurs.models import Conducteur


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


class _JWTParTypeCompte(JWTAuthentication):
    """Base commune : deux modèles de compte distincts (Administrateur, Conducteur)
    partagent le même mécanisme JWT, chacun avec sa propre table. La claim `type_compte`
    (ajoutée par SafeRoadTokenObtainPairSerializer et _tokens_pour_conducteur) dit à quelle
    table résoudre le token — vérifiée AVANT toute requête base de données, pour qu'un token
    qui n'est pas du bon type reste ignoré (retourne None) plutôt que provoquer un échec ou,
    pire, être résolu par erreur contre l'autre table si jamais les pk coïncidaient.

    Sans ce filtrage, la classe JWTAuthentication standard de simplejwt aurait simplement
    fait `self.user_model.objects.get(pk=<user_id>)` sans jamais vérifier pour qui le token
    a été émis."""

    type_compte = None

    def authenticate(self, request):
        header = self.get_header(request)
        if header is None:
            return None
        raw_token = self.get_raw_token(header)
        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        if validated_token.get('type_compte') != self.type_compte:
            return None

        return self.get_user(validated_token), validated_token

    def get_user(self, validated_token):
        try:
            return super().get_user(validated_token)
        except (ValueError, TypeError):
            # pk d'un format inattendu pour ce modèle (ne devrait plus arriver grâce au
            # filtre par type_compte ci-dessus, mais sans ça get_user() de simplejwt ne
            # catch que DoesNotExist — un ValueError/TypeError remonterait en 500 brut).
            raise AuthenticationFailed('Utilisateur introuvable.')


class AdministrateurJWTAuthentication(_JWTParTypeCompte):
    """Remplace JWTAuthentication (simplejwt) dans DEFAULT_AUTHENTICATION_CLASSES. Un token
    sans claim `type_compte` est traité comme administrateur : tous les tokens émis avant
    cet ajout (durée de vie max 1 jour, le temps du refresh) restent valides sans rupture."""

    def authenticate(self, request):
        header = self.get_header(request)
        if header is None:
            return None
        raw_token = self.get_raw_token(header)
        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        type_compte = validated_token.get('type_compte')
        if type_compte is not None and type_compte != 'administrateur':
            return None

        return self.get_user(validated_token), validated_token


class ConducteurJWTAuthentication(_JWTParTypeCompte):
    type_compte = 'conducteur'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.user_model = Conducteur
