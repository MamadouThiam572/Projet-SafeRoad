import re
from urllib.parse import parse_qs, urlparse

from django.core import mail
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.boitiers.models import Boitier
from apps.comptes.models import Administrateur
from apps.conducteurs.models import Conducteur
from apps.notifications.models import NotificationAdmin

from .models import DemandeInstallation, MessageContact

FORMULAIRE = {
    'nom': 'Ndiaye', 'prenom': 'Ibrahima', 'telephone': '+221 77 123 45 67', 'email': 'ibrahima@test.sn',
    'region': 'dakar', 'commune': 'Parcelles Assainies', 'type_vehicule': 'taxi', 'immatriculation': 'DK-2020-AA',
    'disponibilites': 'En semaine après 17 h', 'consentement_donnees': True,
}


class DemandeInstallationTests(TestCase):
    """Parcours complet : demande publique -> contact -> rendez-vous -> installation (compte
    conducteur + boîtier affecté), avec notifications, e-mails et droits par région."""

    @classmethod
    def setUpTestData(cls):
        cls.super_admin = Administrateur.objects.create_user(
            email='super-dem@test.sn', password='x', nom='Fall', prenom='Aida', role=Administrateur.Role.SUPER_ADMIN,
        )
        cls.admin_dakar = Administrateur.objects.create_user(
            email='dakar-dem@test.sn', password='x', nom='Diop', prenom='Cheikh',
            role=Administrateur.Role.ADMIN, region='dakar',
        )
        cls.admin_thies = Administrateur.objects.create_user(
            email='thies-dem@test.sn', password='x', nom='Sy', prenom='Astou',
            role=Administrateur.Role.ADMIN, region='thies',
        )
        cls.anaser = Administrateur.objects.create_user(
            email='anaser-dem@test.sn', password='x', nom='Diallo', prenom='Assane', role=Administrateur.Role.ANASER,
        )

    def setUp(self):
        cache.clear()

    def client_pour(self, utilisateur):
        client = APIClient()
        client.force_authenticate(user=utilisateur)
        return client

    def deposer(self, **modifs):
        return APIClient().post('/api/v1/demandes-installation/', {**FORMULAIRE, **modifs}, format='json')

    def test_depot_public_avec_confirmation_et_notifications(self):
        reponse = self.deposer()
        self.assertEqual(reponse.status_code, 201, reponse.data)
        self.assertEqual(set(reponse.data), {'id', 'statut'})  # pas de fiche complète renvoyée
        self.assertEqual(mail.outbox[0].to, ['ibrahima@test.sn'])
        destinataires = set(NotificationAdmin.objects.values_list('destinataire__email', flat=True))
        self.assertEqual(destinataires, {'dakar-dem@test.sn', 'super-dem@test.sn'})

    def test_consentement_et_telephone_obligatoires(self):
        self.assertEqual(self.deposer(consentement_donnees=False).status_code, 400)
        self.assertEqual(self.deposer(telephone='123').status_code, 400)
        self.assertFalse(DemandeInstallation.objects.exists())

    def test_droits_de_consultation(self):
        demande_id = self.deposer().data['id']
        url = f'/api/v1/demandes-installation/{demande_id}/'
        self.assertEqual(self.client_pour(self.admin_dakar).get(url).status_code, 200)
        self.assertEqual(self.client_pour(self.super_admin).get(url).status_code, 200)
        self.assertEqual(self.client_pour(self.admin_thies).get(url).status_code, 404)
        self.assertEqual(self.client_pour(self.anaser).get(url).status_code, 403)
        self.assertIn(APIClient().get('/api/v1/demandes-installation/').status_code, (401, 403))

    def test_parcours_jusqu_a_l_installation(self):
        demande_id = self.deposer().data['id']
        admin = self.client_pour(self.admin_dakar)
        base = f'/api/v1/demandes-installation/{demande_id}'

        self.assertEqual(admin.patch(f'{base}/statut/', {'statut': 'contactee'}, format='json').status_code, 200)
        rdv = timezone.now() + timezone.timedelta(days=2)
        reponse = admin.post(f'{base}/rendez-vous/', {'rdv_date': rdv.isoformat(), 'rdv_lieu': 'Garage Liberté 6'},
                             format='json')
        self.assertEqual(reponse.status_code, 200, reponse.data)
        self.assertIn('Garage Liberté 6', mail.outbox[-1].body)

        reponse = admin.post(f'{base}/installer/', {'numero_cni': '1 751 1990 01234'}, format='json')
        self.assertEqual(reponse.status_code, 200, reponse.data)
        self.assertEqual(reponse.data['statut'], 'installee')
        self.assertTrue(reponse.data['boitier_api_key'])

        conducteur = Conducteur.objects.get(email='ibrahima@test.sn')
        boitier = Boitier.objects.get(pk=reponse.data['boitier'])
        self.assertEqual(conducteur.boitier, boitier)
        self.assertFalse(conducteur.has_usable_password())  # il choisira le sien via l'invitation
        self.assertEqual((boitier.region, boitier.numero_immatriculation), ('dakar', 'DK-2020-AA'))
        self.assertTrue(boitier.verifier_api_key(reponse.data['boitier_api_key']))
        self.assertEqual(
            list(boitier.historique.order_by('id').values_list('evenement', flat=True)), ['enregistre', 'affecte'],
        )
        invitation = mail.outbox[-1]
        self.assertIn('Activez votre compte', invitation.subject)
        lien = re.search(r'https?://\S+', invitation.body).group(0)
        self.assertEqual(parse_qs(urlparse(lien).query)['type'], ['conducteur'])

        historique = admin.get(f'{base}/historique/').data
        self.assertEqual([h['statut_nouveau'] for h in historique], ['contactee', 'rdv_planifie', 'installee'])

    def test_l_installation_exige_un_rendez_vous_et_un_email(self):
        demande_id = self.deposer(email='').data['id']
        admin = self.client_pour(self.admin_dakar)
        base = f'/api/v1/demandes-installation/{demande_id}'
        self.assertEqual(admin.post(f'{base}/installer/', {'numero_cni': '123'}, format='json').status_code, 400)
        rdv = (timezone.now() + timezone.timedelta(days=1)).isoformat()
        admin.post(f'{base}/rendez-vous/', {'rdv_date': rdv, 'rdv_lieu': 'Domicile'}, format='json')
        self.assertEqual(admin.post(f'{base}/installer/', {'numero_cni': '123'}, format='json').status_code, 400)
        reponse = admin.post(f'{base}/installer/', {'numero_cni': '123', 'email': 'nouveau@test.sn'}, format='json')
        self.assertEqual(reponse.status_code, 200, reponse.data)

    def test_rendez_vous_dans_le_passe_refuse(self):
        demande_id = self.deposer().data['id']
        hier = (timezone.now() - timezone.timedelta(days=1)).isoformat()
        reponse = self.client_pour(self.admin_dakar).post(
            f'/api/v1/demandes-installation/{demande_id}/rendez-vous/', {'rdv_date': hier, 'rdv_lieu': 'X'},
            format='json',
        )
        self.assertEqual(reponse.status_code, 400)

    def test_annulation_motivee_et_demande_close(self):
        demande_id = self.deposer().data['id']
        admin = self.client_pour(self.admin_dakar)
        url = f'/api/v1/demandes-installation/{demande_id}/statut/'
        self.assertEqual(admin.patch(url, {'statut': 'annulee'}, format='json').status_code, 400)
        self.assertEqual(admin.patch(url, {'statut': 'annulee', 'commentaire': 'Injoignable'}, format='json').status_code, 200)
        self.assertEqual(admin.patch(url, {'statut': 'contactee'}, format='json').status_code, 400)


class MessageContactTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.super_admin = Administrateur.objects.create_user(
            email='super-contact@test.sn', password='x', nom='Fall', prenom='Aida', role=Administrateur.Role.SUPER_ADMIN,
        )
        cls.admin_dakar = Administrateur.objects.create_user(
            email='dakar-contact@test.sn', password='x', nom='Diop', prenom='Cheikh',
            role=Administrateur.Role.ADMIN, region='dakar',
        )

    def setUp(self):
        cache.clear()

    def test_envoi_public_puis_traitement_par_le_super_admin(self):
        reponse = APIClient().post('/api/v1/messages-contact/', {
            'nom': 'Mariama Sarr', 'email': 'mariama@test.sn', 'sujet': 'partenariat', 'message': 'Bonjour…',
        }, format='json')
        self.assertEqual(reponse.status_code, 201, reponse.data)
        self.assertTrue(NotificationAdmin.objects.filter(destinataire=self.super_admin).exists())

        client = APIClient()
        client.force_authenticate(user=self.super_admin)
        message_id = reponse.data['id']
        self.assertEqual(client.post(f'/api/v1/messages-contact/{message_id}/traiter/').status_code, 200)
        self.assertTrue(MessageContact.objects.get(pk=message_id).traite)

    def test_seul_le_super_admin_lit_les_messages(self):
        client = APIClient()
        client.force_authenticate(user=self.admin_dakar)
        self.assertEqual(client.get('/api/v1/messages-contact/').status_code, 403)

    def test_limite_d_envoi(self):
        client = APIClient()
        corps = {'nom': 'X', 'email': 'x@test.sn', 'sujet': 'autre', 'message': 'm'}
        codes = [client.post('/api/v1/messages-contact/', corps, format='json').status_code for _ in range(6)]
        self.assertEqual(codes, [201] * 5 + [429])
