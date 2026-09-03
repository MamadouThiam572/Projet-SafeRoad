from django.test import TestCase
from rest_framework.test import APIClient

from apps.comptes.models import Administrateur

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
