import secrets

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.boitiers.models import Boitier, HistoriqueBoitier
from apps.comptes.models import Administrateur
from apps.conducteurs.models import Conducteur
from apps.core.mots_de_passe import envoyer_lien_mot_de_passe
from apps.core.pagination import PaginationListeGestion
from apps.core.permissions import EstAdministrateur, EstSuperAdministrateur
from apps.core.regionalisation import FiltreRegional
from apps.notifications.models import NotificationAdmin

from .models import DemandeInstallation, HistoriqueDemande, MessageContact
from .serializers import (
    DemandeInstallationCreationSerializer,
    DemandeInstallationSerializer,
    HistoriqueDemandeSerializer,
    InstallationSerializer,
    MessageContactCreationSerializer,
    MessageContactSerializer,
    RendezVousSerializer,
)

S = DemandeInstallation.Statut
# Changements de statut « simples » (le rendez-vous et l'installation ont leur propre action).
TRANSITIONS = {
    (S.NOUVELLE, S.CONTACTEE),
    (S.NOUVELLE, S.ANNULEE), (S.CONTACTEE, S.ANNULEE), (S.RDV_PLANIFIE, S.ANNULEE),
}


def _notifier(destinataires, message):
    """Notification ciblée à chaque destinataire (chacun garde son propre état « lu »)."""
    NotificationAdmin.objects.bulk_create([
        NotificationAdmin(
            destinataire=compte, type_notification=NotificationAdmin.TypeNotification.NOUVELLE_DEMANDE,
            message=message[:255],
        )
        for compte in destinataires
    ])


def _super_admins():
    return Administrateur.objects.filter(role=Administrateur.Role.SUPER_ADMIN, is_active=True)


def _envoyer_au_demandeur(demande, sujet, corps):
    if demande.email:
        send_mail(sujet, f"Bonjour {demande.prenom},\n\n{corps}\n\nL'équipe SafeRoad", settings.DEFAULT_FROM_EMAIL,
                  [demande.email])


class DemandeInstallationViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin,
                                 viewsets.GenericViewSet):
    """Demandes d'installation de boîtier. Dépôt public (sans compte, limité par IP) ; suivi
    par l'administrateur de la région demandée (FiltreRegional) et le super administrateur.
    ANASER n'y a pas accès : il s'agit de la relation client."""

    queryset = DemandeInstallation.objects.all()
    pagination_class = PaginationListeGestion
    filter_backends = [FiltreRegional]
    region_lookup_field = 'region'
    throttle_scope = 'demande'

    def get_permissions(self):
        return [AllowAny()] if self.action == 'create' else [EstAdministrateur()]

    def get_throttles(self):
        return [ScopedRateThrottle()] if self.action == 'create' else []

    def get_serializer_class(self):
        return DemandeInstallationCreationSerializer if self.action == 'create' else DemandeInstallationSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        demande = serializer.save()
        admins_region = Administrateur.objects.filter(
            role=Administrateur.Role.ADMIN, region=demande.region, is_active=True,
        )
        _notifier(
            list(admins_region) + list(_super_admins()),
            f"Nouvelle demande d'installation : {demande.prenom} {demande.nom}, {demande.commune} "
            f"({demande.get_region_display()}), {demande.get_type_vehicule_display().lower()}.",
        )
        _envoyer_au_demandeur(
            demande, "SafeRoad — Demande d'installation reçue",
            "Nous avons bien reçu votre demande d'installation d'un boîtier SafeRoad. "
            "Un conseiller de votre région vous contactera prochainement pour fixer un rendez-vous.",
        )
        # Le demandeur anonyme ne récupère que la confirmation, jamais la fiche complète.
        return Response({'id': demande.id, 'statut': demande.statut}, status=201)

    def _tracer(self, demande, ancien, commentaire=''):
        HistoriqueDemande.objects.create(
            demande=demande, statut_precedent=ancien, statut_nouveau=demande.statut,
            acteur=self.request.user, role_acteur=self.request.user.role, commentaire=commentaire,
        )

    @action(detail=True, methods=['patch'], url_path='statut')
    def changer_statut(self, request, pk=None):
        demande = self.get_object()
        ancien, nouveau = demande.statut, request.data.get('statut')
        commentaire = (request.data.get('commentaire') or '').strip()
        if not isinstance(nouveau, str) or (ancien, nouveau) not in TRANSITIONS:
            raise ValidationError({'statut': f"Transition impossible : « {ancien} » → « {nouveau} »."})
        if nouveau == S.ANNULEE and not commentaire:
            raise ValidationError({'commentaire': "Une annulation doit être motivée."})
        with transaction.atomic():
            demande.statut = nouveau
            demande.save(update_fields=['statut', 'date_maj'])
            self._tracer(demande, ancien, commentaire)
        return Response(DemandeInstallationSerializer(demande).data)

    @action(detail=True, methods=['post'], url_path='rendez-vous')
    def rendez_vous(self, request, pk=None):
        """Fixe (ou déplace) le rendez-vous d'installation et prévient le demandeur par e-mail."""
        demande = self.get_object()
        if demande.statut not in DemandeInstallation.STATUTS_OUVERTS:
            raise ValidationError("Cette demande est close.")
        donnees = RendezVousSerializer(data=request.data)
        donnees.is_valid(raise_exception=True)
        ancien = demande.statut
        with transaction.atomic():
            demande.statut = S.RDV_PLANIFIE
            demande.rdv_date = donnees.validated_data['rdv_date']
            demande.rdv_lieu = donnees.validated_data['rdv_lieu']
            demande.save(update_fields=['statut', 'rdv_date', 'rdv_lieu', 'date_maj'])
            self._tracer(demande, ancien, donnees.validated_data.get('commentaire', ''))
        quand = timezone.localtime(demande.rdv_date).strftime('%d/%m/%Y à %H:%M')
        _envoyer_au_demandeur(
            demande, "SafeRoad — Rendez-vous d'installation",
            f"Votre rendez-vous d'installation est fixé le {quand}, lieu : {demande.rdv_lieu}.\n"
            "Merci de vous munir de votre pièce d'identité et de la carte grise du véhicule.",
        )
        return Response(DemandeInstallationSerializer(demande).data)

    @action(detail=True, methods=['post'])
    def installer(self, request, pk=None):
        """Boîtier posé et pièce d'identité vérifiée sur place : crée le compte conducteur
        (invitation par e-mail), enregistre le boîtier, l'affecte et clôt la demande. La clé
        API du boîtier n'est renvoyée qu'ici, une seule fois, pour configurer le dispositif."""
        demande = self.get_object()
        if demande.statut != S.RDV_PLANIFIE:
            raise ValidationError("L'installation se saisit après la planification du rendez-vous.")
        donnees = InstallationSerializer(data=request.data)
        donnees.is_valid(raise_exception=True)
        email = donnees.validated_data.get('email') or demande.email
        if not email:
            raise ValidationError({'email': "Un e-mail est nécessaire pour créer le compte du conducteur."})
        if Conducteur.objects.filter(email__iexact=email).exists():
            raise ValidationError({'email': "Un compte conducteur existe déjà avec cet e-mail."})
        immatriculation = donnees.validated_data.get('immatriculation', demande.immatriculation)

        with transaction.atomic():
            conducteur = Conducteur.objects.create_user(
                email=email, password=None, nom=demande.nom, prenom=demande.prenom, telephone=demande.telephone,
                adresse=', '.join(filter(None, [demande.adresse, demande.commune])),
            )
            boitier = Boitier(
                region=demande.region, numero_immatriculation=immatriculation,
                proprietaire_nom=f"{demande.prenom} {demande.nom}", proprietaire_telephone=demande.telephone,
            )
            api_key = secrets.token_urlsafe(32)
            boitier.set_api_key(api_key)
            boitier.save()
            conducteur.boitier = boitier
            conducteur.save(update_fields=['boitier'])
            for evenement in (HistoriqueBoitier.Evenement.ENREGISTRE, HistoriqueBoitier.Evenement.AFFECTE):
                HistoriqueBoitier.objects.create(
                    boitier=boitier, evenement=evenement, conducteur=conducteur, acteur=request.user,
                    role_acteur=request.user.role, commentaire=f"Installation (demande #{demande.id})",
                )
            ancien = demande.statut
            demande.statut = S.INSTALLEE
            demande.numero_cni = donnees.validated_data['numero_cni']
            demande.email = email
            demande.conducteur, demande.boitier = conducteur, boitier
            demande.save()
            self._tracer(demande, ancien, donnees.validated_data.get('commentaire', ''))
        envoyer_lien_mot_de_passe(conducteur, invitation=True)

        reponse = DemandeInstallationSerializer(demande).data
        reponse['boitier_api_key'] = api_key
        return Response(reponse)

    @action(detail=True, methods=['get'])
    def historique(self, request, pk=None):
        demande = self.get_object()
        return Response(HistoriqueDemandeSerializer(demande.historique.select_related('acteur'), many=True).data)


class MessageContactViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin,
                            viewsets.GenericViewSet):
    """Messages de la page Contact : envoi public (limité par IP), lecture et traitement par
    le super administrateur."""

    queryset = MessageContact.objects.all()
    pagination_class = PaginationListeGestion
    throttle_scope = 'demande'

    def get_permissions(self):
        return [AllowAny()] if self.action == 'create' else [EstSuperAdministrateur()]

    def get_throttles(self):
        return [ScopedRateThrottle()] if self.action == 'create' else []

    def get_serializer_class(self):
        return MessageContactCreationSerializer if self.action == 'create' else MessageContactSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = serializer.save()
        _notifier(_super_admins(), f"Nouveau message ({message.get_sujet_display()}) de {message.nom}.")
        return Response({'id': message.id}, status=201)

    @action(detail=True, methods=['post'])
    def traiter(self, request, pk=None):
        message = self.get_object()
        message.traite, message.traite_par, message.traite_le = True, request.user, timezone.now()
        message.save(update_fields=['traite', 'traite_par', 'traite_le'])
        return Response(MessageContactSerializer(message).data)
