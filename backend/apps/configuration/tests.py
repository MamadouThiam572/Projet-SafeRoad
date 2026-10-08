from django.test import TestCase
from rest_framework.test import APIClient

from apps.comptes.models import Administrateur

from .models import ConfigurationSysteme


class ConfigurationPermissionsTests(TestCase):
    """Les seuils de détection sont nationaux : un administrateur régional peut les lire,
    seul le super administrateur peut les modifier."""

    @classmethod
    def setUpTestData(cls):
        cls.super_admin = Administrateur.objects.create_user(
            email='super-admin-config@test.sn', password='x', nom='Fall', prenom='Aida',
            role=Administrateur.Role.SUPER_ADMIN,
        )
        cls.admin_dakar = Administrateur.objects.create_user(
            email='admin-dakar-config@test.sn', password='x', nom='Diop', prenom='Cheikh',
            role=Administrateur.Role.ADMIN, region='dakar',
        )

    def setUp(self):
        self.client = APIClient()

    def test_admin_regional_peut_lire_la_configuration(self):
        self.client.force_authenticate(user=self.admin_dakar)
        self.assertEqual(self.client.get('/api/v1/configuration/').status_code, 200)

    def test_admin_regional_ne_peut_pas_modifier_la_configuration(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.put('/api/v1/configuration/', {'seuil_vitesse_choc': 10}, format='json')
        self.assertEqual(reponse.status_code, 403)
        self.assertEqual(ConfigurationSysteme.instance().seuil_vitesse_choc, 60.0)

    def test_super_admin_peut_modifier_la_configuration(self):
        self.client.force_authenticate(user=self.super_admin)
        reponse = self.client.put('/api/v1/configuration/', {'seuil_vitesse_choc': 70}, format='json')
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(ConfigurationSysteme.instance().seuil_vitesse_choc, 70.0)
