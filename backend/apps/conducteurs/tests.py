import re
from urllib.parse import parse_qs, urlparse

from django.core import mail
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from apps.comptes.models import Administrateur

from .models import Conducteur


class InscriptionConducteurTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_inscription_cree_le_compte(self):
        client = APIClient()
        reponse = client.post('/api/v1/auth/conducteur/inscription/', {
            'email': 'conducteur@test.sn', 'password': 'mot-de-passe-suffisant',
            'nom': 'Diatta', 'prenom': 'Fatou', 'telephone': '+221771234567',
        })
        self.assertEqual(reponse.status_code, 201)
        self.assertTrue(Conducteur.objects.filter(email='conducteur@test.sn').exists())
        self.assertNotIn('password', reponse.data)

    def test_inscription_refuse_un_email_deja_utilise(self):
        Conducteur.objects.create_user(email='existe@test.sn', password='x', nom='A', prenom='B')
        client = APIClient()
        reponse = client.post('/api/v1/auth/conducteur/inscription/', {
            'email': 'existe@test.sn', 'password': 'mot-de-passe-suffisant', 'nom': 'C', 'prenom': 'D',
        })
        self.assertEqual(reponse.status_code, 400)

    def test_inscription_refuse_un_mot_de_passe_trop_court(self):
        client = APIClient()
        reponse = client.post('/api/v1/auth/conducteur/inscription/', {
            'email': 'court@test.sn', 'password': 'x', 'nom': 'C', 'prenom': 'D',
        })
        self.assertEqual(reponse.status_code, 400)

    def test_inscription_refuse_un_mot_de_passe_trop_courant(self):
        client = APIClient()
        reponse = client.post('/api/v1/auth/conducteur/inscription/', {
            'email': 'courant@test.sn', 'password': 'password123', 'nom': 'C', 'prenom': 'D',
        })
        self.assertEqual(reponse.status_code, 400)
        self.assertIn('password', reponse.data)
        self.assertFalse(Conducteur.objects.filter(email='courant@test.sn').exists())


class ConnexionConducteurTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.conducteur = Conducteur.objects.create_user(
            email='conducteur2@test.sn', password='mot-de-passe-suffisant', nom='Ba', prenom='Awa',
        )

    def setUp(self):
        cache.clear()

    def test_connexion_reussie_renvoie_les_tokens(self):
        client = APIClient()
        reponse = client.post('/api/v1/auth/conducteur/login/', {
            'email': 'conducteur2@test.sn', 'password': 'mot-de-passe-suffisant',
        })
        self.assertEqual(reponse.status_code, 200)
        self.assertIn('access', reponse.data)
        self.assertIn('refresh', reponse.data)

    def test_connexion_refuse_mauvais_mot_de_passe(self):
        client = APIClient()
        reponse = client.post('/api/v1/auth/conducteur/login/', {
            'email': 'conducteur2@test.sn', 'password': 'faux',
        })
        self.assertEqual(reponse.status_code, 401)

    def test_connexion_refuse_un_compte_inactif(self):
        self.conducteur.is_active = False
        self.conducteur.save(update_fields=['is_active'])
        client = APIClient()
        reponse = client.post('/api/v1/auth/conducteur/login/', {
            'email': 'conducteur2@test.sn', 'password': 'mot-de-passe-suffisant',
        })
        self.assertEqual(reponse.status_code, 401)
        self.conducteur.is_active = True
        self.conducteur.save(update_fields=['is_active'])


class RafraichissementEtDeconnexionConducteurTests(TestCase):
    """Ne peuvent pas réutiliser /auth/refresh/ et /auth/logout/ (voir
    apps/conducteurs/views.py) : ces tests couvrent le circuit dédié."""

    @classmethod
    def setUpTestData(cls):
        cls.conducteur = Conducteur.objects.create_user(
            email='conducteur4@test.sn', password='mot-de-passe-suffisant', nom='Diouf', prenom='Rama',
        )

    def setUp(self):
        cache.clear()

    def _connexion(self):
        return APIClient().post('/api/v1/auth/conducteur/login/', {
            'email': 'conducteur4@test.sn', 'password': 'mot-de-passe-suffisant',
        }).data

    def test_rafraichissement_renvoie_un_nouvel_access_token(self):
        tokens = self._connexion()
        client = APIClient()
        reponse = client.post('/api/v1/auth/conducteur/refresh/', {'refresh': tokens['refresh']})
        self.assertEqual(reponse.status_code, 200)
        self.assertIn('access', reponse.data)

    def test_deconnexion_puis_rafraichissement_est_refuse(self):
        tokens = self._connexion()
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        reponse_logout = client.post('/api/v1/auth/conducteur/logout/', {'refresh': tokens['refresh']})
        self.assertEqual(reponse_logout.status_code, 205)

        reponse_refresh = APIClient().post('/api/v1/auth/conducteur/refresh/', {'refresh': tokens['refresh']})
        self.assertEqual(reponse_refresh.status_code, 401)

    def test_rafraichissement_refuse_un_token_administrateur(self):
        admin = Administrateur.objects.create_user(
            email='admin-refresh@test.sn', password='x', nom='Ndao', prenom='Seydou',
        )
        client = APIClient()
        client.force_authenticate(user=admin)
        reponse_login = APIClient().post('/api/v1/auth/login/', {'email': 'admin-refresh@test.sn', 'password': 'x'})
        reponse = APIClient().post('/api/v1/auth/conducteur/refresh/', {'refresh': reponse_login.data['refresh']})
        self.assertEqual(reponse.status_code, 400)


class ProfilConducteurTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.conducteur = Conducteur.objects.create_user(
            email='conducteur3@test.sn', password='x', nom='Sow', prenom='Ibrahima', telephone='770000000',
        )

    def test_lecture_du_profil(self):
        client = APIClient()
        client.force_authenticate(user=self.conducteur)
        reponse = client.get('/api/v1/conducteur/moi/')
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data['email'], 'conducteur3@test.sn')
        self.assertEqual(reponse.data['nom'], 'Sow')
        self.assertIsNone(reponse.data['plaque_immatriculation'])

    def test_modification_du_profil_et_des_preferences(self):
        client = APIClient()
        client.force_authenticate(user=self.conducteur)
        reponse = client.patch('/api/v1/conducteur/moi/', {
            'telephone': '780000000', 'pref_annonce_vocale': True,
        }, format='json')
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data['telephone'], '780000000')
        self.assertTrue(reponse.data['pref_annonce_vocale'])

    def test_email_reste_en_lecture_seule(self):
        client = APIClient()
        client.force_authenticate(user=self.conducteur)
        reponse = client.patch('/api/v1/conducteur/moi/', {'email': 'autre@test.sn'}, format='json')
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data['email'], 'conducteur3@test.sn')

    def test_anonyme_est_rejete(self):
        client = APIClient()
        reponse = client.get('/api/v1/conducteur/moi/')
        self.assertEqual(reponse.status_code, 401)


class IsolationDesTypesDeCompteTests(TestCase):
    """Le test de régression le plus important de cette app : un token émis pour un type
    de compte ne doit JAMAIS authentifier l'autre, même si un jour leurs pk se
    ressemblaient. Voir apps.core.authentication._JWTParTypeCompte."""

    @classmethod
    def setUpTestData(cls):
        cls.admin = Administrateur.objects.create_user(
            email='admin-iso@test.sn', password='mot-de-passe-suffisant', nom='Ka', prenom='Omar',
            role=Administrateur.Role.SUPER_ADMIN,
        )

    def setUp(self):
        cache.clear()
        self.conducteur = Conducteur.objects.create_user(
            email='conducteur-iso@test.sn', password='mot-de-passe-suffisant', nom='Fall', prenom='Aida',
        )

    def _token_conducteur(self):
        client = APIClient()
        reponse = client.post('/api/v1/auth/conducteur/login/', {
            'email': 'conducteur-iso@test.sn', 'password': 'mot-de-passe-suffisant',
        })
        return reponse.data['access']

    def _token_admin(self):
        client = APIClient()
        reponse = client.post('/api/v1/auth/login/', {
            'email': 'admin-iso@test.sn', 'password': 'mot-de-passe-suffisant',
        })
        return reponse.data['access']

    def test_un_token_conducteur_ne_donne_pas_acces_a_un_endpoint_admin(self):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {self._token_conducteur()}')
        reponse = client.get('/api/v1/administrateurs/')
        self.assertIn(reponse.status_code, (401, 403))

    def test_un_token_admin_ne_donne_pas_acces_au_profil_conducteur(self):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {self._token_admin()}')
        reponse = client.get('/api/v1/conducteur/moi/')
        self.assertEqual(reponse.status_code, 403)

    def test_le_conducteur_accede_bien_a_son_propre_profil(self):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {self._token_conducteur()}')
        reponse = client.get('/api/v1/conducteur/moi/')
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data['email'], 'conducteur-iso@test.sn')


class MotDePasseConducteurTests(TestCase):
    def setUp(self):
        cache.clear()
        self.conducteur = Conducteur.objects.create_user(
            email='awa-mdp@test.sn', password='Mot-de-passe-solide-1', nom='Ba', prenom='Awa',
        )

    def test_mot_de_passe_oublie_puis_reinitialise(self):
        client = APIClient()
        client.post('/api/v1/auth/conducteur/mot-de-passe/oubli/', {'email': 'awa-mdp@test.sn'}, format='json')
        self.assertEqual(len(mail.outbox), 1)
        lien = re.search(r'https?://\S+', mail.outbox[0].body).group(0)
        parametres = {k: v[0] for k, v in parse_qs(urlparse(lien).query).items()}
        self.assertEqual(parametres['type'], 'conducteur')
        reponse = client.post('/api/v1/auth/conducteur/mot-de-passe/reinitialiser/', {
            'uid': parametres['uid'], 'token': parametres['token'], 'nouveau_mot_de_passe': 'Route-sure-2026!',
        }, format='json')
        self.assertEqual(reponse.status_code, 200, reponse.data)
        reponse = client.post('/api/v1/auth/conducteur/login/', {'email': 'awa-mdp@test.sn', 'password': 'Route-sure-2026!'})
        self.assertEqual(reponse.status_code, 200)

    def test_le_lien_conducteur_ne_marche_pas_sur_un_compte_du_personnel(self):
        # Deux modèles distincts : un uid de conducteur n'ouvre rien côté personnel.
        client = APIClient()
        client.post('/api/v1/auth/conducteur/mot-de-passe/oubli/', {'email': 'awa-mdp@test.sn'}, format='json')
        lien = re.search(r'https?://\S+', mail.outbox[0].body).group(0)
        parametres = {k: v[0] for k, v in parse_qs(urlparse(lien).query).items()}
        reponse = client.post('/api/v1/auth/mot-de-passe/reinitialiser/', {
            'uid': parametres['uid'], 'token': parametres['token'], 'nouveau_mot_de_passe': 'Route-sure-2026!',
        }, format='json')
        self.assertEqual(reponse.status_code, 400)

    def test_le_conducteur_change_son_mot_de_passe(self):
        client = APIClient()
        client.force_authenticate(user=self.conducteur)
        reponse = client.post('/api/v1/conducteur/moi/mot-de-passe/', {
            'ancien_mot_de_passe': 'Mot-de-passe-solide-1', 'nouveau_mot_de_passe': 'Nouveau-solide-2026!',
        })
        self.assertEqual(reponse.status_code, 200)
        self.conducteur.refresh_from_db()
        self.assertTrue(self.conducteur.check_password('Nouveau-solide-2026!'))
