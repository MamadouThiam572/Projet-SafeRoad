from django.contrib.auth import get_user_model
from django.db.models import Exists, OuterRef, Q
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.permissions import EstAdminOuAnaser

from .models import NotificationAdmin
from .serializers import NotificationAdminSerializer


class NotificationAdminViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = NotificationAdminSerializer
    permission_classes = [EstAdminOuAnaser]

    def get_queryset(self):
        utilisateur = self.request.user
        # Un admin ne voit que ses notifications ciblées + les diffusions globales
        # (destinataire=None) — pas les notifications adressées à d'autres admins.
        # L'ANASER ne reçoit que les diffusions qui lui sont adressées (zones soumises à sa
        # reconnaissance) ; les administrateurs, celles du personnel.
        audience = (
            NotificationAdmin.Audience.ANASER if utilisateur.role == 'anaser' else NotificationAdmin.Audience.PERSONNEL
        )
        diffusions = Q(destinataire__isnull=True, audience=audience)
        if getattr(utilisateur, 'role', None) == 'admin':
            # Administrateur régional : seulement les diffusions de sa région (même règle que
            # FiltreRegional — sans région, aucune), plus celles qui ne visent aucun objet.
            sans_objet = Q(incident__isnull=True, zone__isnull=True, boitier__isnull=True, signalement__isnull=True)
            region = utilisateur.region
            de_sa_region = (
                Q(incident__boitier__region=region) | Q(zone__region=region) | Q(boitier__region=region)
                | Q(signalement__region=region)
                if region else Q(pk__in=[])
            )
            diffusions &= sans_objet | de_sa_region

        lue_par_moi = get_user_model().objects.filter(pk=utilisateur.pk, notifications_lues=OuterRef('pk'))
        return (
            NotificationAdmin.objects.filter(Q(destinataire=utilisateur) | diffusions)
            .annotate(lue_par_moi=Exists(lue_par_moi))
            .select_related('incident', 'zone', 'boitier', 'signalement')
        )

    @action(detail=True, methods=['patch'], url_path='lue')
    def marquer_lue(self, request, pk=None):
        notification = self.get_object()
        if notification.destinataire_id:
            notification.lue = True
            notification.save(update_fields=['lue'])
        else:
            notification.lue_par.add(request.user)
        return Response(NotificationAdminSerializer(self.get_object()).data)
