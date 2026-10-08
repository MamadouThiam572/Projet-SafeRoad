from django.test import TestCase
from rest_framework.test import APIClient

from apps.comptes.models import Administrateur
from apps.zones.models import Zone

from .models import AlerteAnaser


class AlerteAnaserPermissionsTests(TestCase):
    """L'ANASER crée et fait avancer ses propres retours ; le super administrateur peut en
    supprimer (modération) ; les administrateurs régionaux et les autres comptes ANASER
    ne peuvent que les consulter."""

    @classmethod
    def setUpTestData(cls):
        cls.anaser = Administrateur.objects.create_user(
            email='anaser-auteur@test.sn', password='x', nom='A', prenom='A', role=Administrateur.Role.ANASER,
        )
        cls.autre_anaser = Administrateur.objects.create_user(
            email='anaser-autre@test.sn', password='x', nom='B', prenom='B', role=Administrateur.Role.ANASER,
        )
        cls.super_admin = Administrateur.objects.create_user(
            email='super-anaser@test.sn', password='x', nom='S', prenom='S', role=Administrateur.Role.SUPER_ADMIN,
        )
        cls.admin_dakar = Administrateur.objects.create_user(
            email='dakar-anaser@test.sn', password='x', nom='D', prenom='D',
            role=Administrateur.Role.ADMIN, region='dakar',
        )
        cls.zone = Zone.objects.create(
            latitude_centre=14.69, longitude_centre=-17.44, rayon_metres=300, region='dakar',
            statut_validation=Zone.StatutValidation.RECONNUE,
        )

    def setUp(self):
        self.retour = AlerteAnaser.objects.create(
            zone=self.zone, auteur=self.anaser, commentaire="Virage dangereux",
            action_prevue=AlerteAnaser.ActionPrevue.SIGNALISATION,
        )

    def client_pour(self, utilisateur):
        client = APIClient()
        client.force_authenticate(user=utilisateur)
        return client

    def url(self):
        return f'/api/v1/alertes-anaser/{self.retour.id}/'

    def test_l_auteur_peut_faire_avancer_le_statut(self):
        reponse = self.client_pour(self.anaser).patch(self.url(), {'statut': 'realisee'}, format='json')
        self.assertEqual(reponse.status_code, 200)
        self.retour.refresh_from_db()
        self.assertEqual(self.retour.statut, AlerteAnaser.Statut.REALISEE)

    def test_un_autre_compte_anaser_ne_peut_pas_modifier(self):
        reponse = self.client_pour(self.autre_anaser).patch(self.url(), {'statut': 'realisee'}, format='json')
        self.assertEqual(reponse.status_code, 403)

    def test_un_admin_regional_ne_peut_que_consulter(self):
        client = self.client_pour(self.admin_dakar)
        self.assertEqual(client.get(self.url()).status_code, 200)
        self.assertEqual(client.patch(self.url(), {'statut': 'realisee'}, format='json').status_code, 403)
        self.assertEqual(client.delete(self.url()).status_code, 403)

    def test_le_super_admin_peut_supprimer_mais_pas_modifier(self):
        client = self.client_pour(self.super_admin)
        self.assertEqual(client.patch(self.url(), {'statut': 'realisee'}, format='json').status_code, 403)
        self.assertEqual(client.delete(self.url()).status_code, 204)
        self.assertFalse(AlerteAnaser.objects.filter(pk=self.retour.pk).exists())

    def test_l_auteur_peut_supprimer_son_retour(self):
        self.assertEqual(self.client_pour(self.anaser).delete(self.url()).status_code, 204)
