"""Mot de passe : invitation, oubli, réinitialisation et changement — communs aux comptes du
personnel (comptes.Administrateur) et aux conducteurs (conducteurs.Conducteur), qui sont deux
modèles distincts. Chaque app branche ces vues avec son propre modèle (voir ses urls.py)."""

from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

MESSAGE_DEMANDE_RECUE = (
    "Si un compte actif correspond à cette adresse, un lien de réinitialisation vient de lui être envoyé."
)


def _type_compte(utilisateur):
    return 'conducteur' if utilisateur._meta.label_lower == 'conducteurs.conducteur' else 'personnel'


def lien_mot_de_passe(utilisateur):
    """Lien vers la page du frontend qui permet de choisir un mot de passe (valable
    PASSWORD_RESET_TIMEOUT, 3 jours par défaut ; invalide dès que le mot de passe change)."""
    parametres = urlencode({
        'type': _type_compte(utilisateur),
        'uid': urlsafe_base64_encode(force_bytes(utilisateur.pk)),
        'token': default_token_generator.make_token(utilisateur),
    })
    return f"{settings.FRONTEND_URL}/reinitialiser-mot-de-passe?{parametres}"


def envoyer_lien_mot_de_passe(utilisateur, invitation=False):
    lien = lien_mot_de_passe(utilisateur)
    if invitation:
        sujet = "SafeRoad — Activez votre compte"
        corps = (
            f"Bonjour {utilisateur.prenom},\n\nUn compte SafeRoad vient d'être créé pour vous. "
            f"Choisissez votre mot de passe en suivant ce lien (valable 3 jours) :\n\n{lien}\n"
        )
    else:
        sujet = "SafeRoad — Réinitialisation de votre mot de passe"
        corps = (
            f"Bonjour {utilisateur.prenom},\n\nPour choisir un nouveau mot de passe, suivez ce lien "
            f"(valable 3 jours) :\n\n{lien}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message."
        )
    send_mail(sujet, corps, settings.DEFAULT_FROM_EMAIL, [utilisateur.email])


def verifier_nouveau_mot_de_passe(mot_de_passe, utilisateur, champ='nouveau_mot_de_passe'):
    try:
        validate_password(mot_de_passe, user=utilisateur)
    except DjangoValidationError as erreur:
        raise ValidationError({champ: list(erreur.messages)})


class _DemandeSerializer(serializers.Serializer):
    email = serializers.EmailField()


class _ReinitialisationSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    nouveau_mot_de_passe = serializers.CharField(write_only=True)


class _ChangementSerializer(serializers.Serializer):
    ancien_mot_de_passe = serializers.CharField(write_only=True)
    nouveau_mot_de_passe = serializers.CharField(write_only=True)


class DemandeReinitialisationView(APIView):
    """POST {email} : envoie un lien si un compte actif existe. Réponse identique dans tous
    les cas, pour ne jamais révéler quelles adresses ont un compte."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'mot_de_passe'
    modele = None

    def post(self, request):
        donnees = _DemandeSerializer(data=request.data)
        donnees.is_valid(raise_exception=True)
        email = self.modele.objects.normalize_email(donnees.validated_data['email'])
        utilisateur = self.modele.objects.filter(email__iexact=email, is_active=True).first()
        if utilisateur is not None:
            envoyer_lien_mot_de_passe(utilisateur)
        return Response({'detail': MESSAGE_DEMANDE_RECUE})


class ReinitialisationView(APIView):
    """POST {uid, token, nouveau_mot_de_passe} : définit le mot de passe depuis le lien reçu
    par e-mail (invitation ou oubli), puis coupe les sessions existantes du compte."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'mot_de_passe'
    modele = None
    # Appelée après le changement, pour révoquer les sessions (selon le type de compte).
    apres_changement = None

    def post(self, request):
        donnees = _ReinitialisationSerializer(data=request.data)
        donnees.is_valid(raise_exception=True)
        try:
            pk = force_str(urlsafe_base64_decode(donnees.validated_data['uid']))
            utilisateur = self.modele.objects.get(pk=pk, is_active=True)
        except (ValueError, TypeError, OverflowError, DjangoValidationError, self.modele.DoesNotExist):
            utilisateur = None
        if utilisateur is None or not default_token_generator.check_token(utilisateur, donnees.validated_data['token']):
            raise ValidationError({'token': "Ce lien est invalide ou a expiré. Demandez-en un nouveau."})

        verifier_nouveau_mot_de_passe(donnees.validated_data['nouveau_mot_de_passe'], utilisateur)
        utilisateur.set_password(donnees.validated_data['nouveau_mot_de_passe'])
        utilisateur.save(update_fields=['password'])
        if self.apres_changement:
            self.apres_changement(utilisateur)
        return Response({'detail': "Mot de passe enregistré. Vous pouvez vous connecter."})


class ChangementMotDePasseView(APIView):
    """POST {ancien_mot_de_passe, nouveau_mot_de_passe} : l'utilisateur connecté change son
    propre mot de passe. `permission_classes` est fixé par chaque app (personnel ou conducteur)."""

    def post(self, request):
        donnees = _ChangementSerializer(data=request.data)
        donnees.is_valid(raise_exception=True)
        utilisateur = request.user
        if not utilisateur.check_password(donnees.validated_data['ancien_mot_de_passe']):
            raise ValidationError({'ancien_mot_de_passe': "Mot de passe actuel incorrect."})
        verifier_nouveau_mot_de_passe(donnees.validated_data['nouveau_mot_de_passe'], utilisateur)
        utilisateur.set_password(donnees.validated_data['nouveau_mot_de_passe'])
        utilisateur.save(update_fields=['password'])
        return Response({'detail': "Mot de passe modifié."})
