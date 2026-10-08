from django.test import TestCase
from rest_framework.test import APIClient

from apps.comptes.models import Administrateur
from apps.zones.models import Zone

from .models import NotificationAdmin


class NotificationAdminQuerysetTests(TestCase):
    """Régression directe de l'audit : un admin ne doit voir/pouvoir marquer comme lues
    que ses propres notifications ciblées, plus les diffusions globales."""

    @classmethod
    def setUpTestData(cls):
        cls.admin_a = Administrateur.objects.create_user(
            email='admin-a@test.sn', password='x', nom='A', prenom='A', role=Administrateur.Role.ADMIN,
        )
        cls.admin_b = Administrateur.objects.create_user(
            email='admin-b@test.sn', password='x', nom='B', prenom='B', role=Administrateur.Role.ADMIN,
        )
        cls.notif_a = NotificationAdmin.objects.create(
            destinataire=cls.admin_a, type_notification=NotificationAdmin.TypeNotification.ZONE_A_VALIDER,
            message="Pour A uniquement",
        )
        cls.notif_b = NotificationAdmin.objects.create(
            destinataire=cls.admin_b, type_notification=NotificationAdmin.TypeNotification.ZONE_A_VALIDER,
            message="Pour B uniquement",
        )
        cls.notif_diffusion = NotificationAdmin.objects.create(
            destinataire=None, type_notification=NotificationAdmin.TypeNotification.SYNC_ECHOUEE,
            message="Diffusion à tous",
        )

    def test_admin_ne_voit_pas_les_notifications_dun_autre_admin(self):
        client = APIClient()
        client.force_authenticate(user=self.admin_a)

        reponse = client.get('/api/v1/notifications/')

        ids_recus = {n['id'] for n in reponse.data}
        self.assertIn(self.notif_a.id, ids_recus)
        self.assertIn(self.notif_diffusion.id, ids_recus)
        self.assertNotIn(self.notif_b.id, ids_recus)

    def test_admin_ne_peut_pas_marquer_lue_une_notification_dun_autre(self):
        client = APIClient()
        client.force_authenticate(user=self.admin_a)

        reponse = client.patch(f'/api/v1/notifications/{self.notif_b.id}/lue/')

        self.assertEqual(reponse.status_code, 404)  # hors queryset -> introuvable, pas 403 (n'en révèle pas l'existence)
        self.notif_b.refresh_from_db()
        self.assertFalse(self.notif_b.lue)

    def test_admin_peut_marquer_lue_sa_propre_notification(self):
        client = APIClient()
        client.force_authenticate(user=self.admin_a)

        reponse = client.patch(f'/api/v1/notifications/{self.notif_a.id}/lue/')

        self.assertEqual(reponse.status_code, 200)
        self.notif_a.refresh_from_db()
        self.assertTrue(self.notif_a.lue)


class NotificationDiffusionTests(TestCase):
    """Une diffusion (destinataire=None) a un état « lu » propre à chaque administrateur,
    et un administrateur régional ne reçoit que les diffusions de sa région."""

    @classmethod
    def setUpTestData(cls):
        cls.super_admin = Administrateur.objects.create_user(
            email='super-notif@test.sn', password='x', nom='S', prenom='S', role=Administrateur.Role.SUPER_ADMIN,
        )
        cls.admin_dakar = Administrateur.objects.create_user(
            email='dakar-notif@test.sn', password='x', nom='D', prenom='D',
            role=Administrateur.Role.ADMIN, region='dakar',
        )
        cls.admin_thies = Administrateur.objects.create_user(
            email='thies-notif@test.sn', password='x', nom='T', prenom='T',
            role=Administrateur.Role.ADMIN, region='thies',
        )
        zone_kwargs = {'rayon_metres': 300, 'statut_validation': Zone.StatutValidation.RECONNUE}
        zone_dakar = Zone.objects.create(latitude_centre=14.69, longitude_centre=-17.44, region='dakar', **zone_kwargs)
        zone_thies = Zone.objects.create(latitude_centre=14.79, longitude_centre=-16.92, region='thies', **zone_kwargs)
        type_zone = NotificationAdmin.TypeNotification.NOUVELLE_ZONE
        cls.notif_dakar = NotificationAdmin.objects.create(type_notification=type_zone, zone=zone_dakar, message="Dakar")
        cls.notif_thies = NotificationAdmin.objects.create(type_notification=type_zone, zone=zone_thies, message="Thiès")

    def ids_visibles(self, utilisateur):
        client = APIClient()
        client.force_authenticate(user=utilisateur)
        return {n['id'] for n in client.get('/api/v1/notifications/').data}

    def test_admin_regional_ne_recoit_que_les_diffusions_de_sa_region(self):
        self.assertEqual(self.ids_visibles(self.admin_dakar), {self.notif_dakar.id})
        self.assertEqual(self.ids_visibles(self.admin_thies), {self.notif_thies.id})

    def test_super_admin_recoit_toutes_les_diffusions(self):
        self.assertEqual(self.ids_visibles(self.super_admin), {self.notif_dakar.id, self.notif_thies.id})

    def test_lire_une_diffusion_ne_la_marque_pas_lue_pour_les_autres(self):
        client_super = APIClient()
        client_super.force_authenticate(user=self.super_admin)
        reponse = client_super.patch(f'/api/v1/notifications/{self.notif_dakar.id}/lue/')
        self.assertEqual(reponse.status_code, 200)
        self.assertTrue(reponse.data['lue'])

        client_dakar = APIClient()
        client_dakar.force_authenticate(user=self.admin_dakar)
        reponse = client_dakar.get(f'/api/v1/notifications/{self.notif_dakar.id}/')
        self.assertFalse(reponse.data['lue'])
