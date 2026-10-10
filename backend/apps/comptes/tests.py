import re
from urllib.parse import parse_qs, urlparse

from django.core import mail
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Administrateur


class TokenClaimsTests(TestCase):
    """Ce point a déjà régressé silencieusement une fois (claim `email` manquante,
    cassait l'affichage après rafraîchissement de token) — verrouillé pour de bon."""

    @classmethod
    def setUpTestData(cls):
        cls.admin = Administrateur.objects.create_user(
            email='admin@test.sn', password='mot-de-passe-suffisant', nom='Diop', prenom='Awa',
            role=Administrateur.Role.ADMIN,
        )

    def setUp(self):
        # Le throttle de /auth/login/ est par IP (voir LoginRateThrottle) : toutes les
        # requêtes de test partagent 127.0.0.1, donc sans ce nettoyage, l'ordre d'exécution
        # des tests pourrait faire « déborder » ce compteur d'une classe de test à l'autre.
        cache.clear()

    def test_login_renvoie_les_claims_metier_dans_la_reponse(self):
        client = APIClient()
        reponse = client.post('/api/v1/auth/login/', {'email': 'admin@test.sn', 'password': 'mot-de-passe-suffisant'})
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data['email'], 'admin@test.sn')
        self.assertEqual(reponse.data['role'], 'admin')
        self.assertEqual(reponse.data['nom'], 'Diop')
        self.assertIn('access', reponse.data)
        self.assertIn('refresh', reponse.data)

    def test_login_renvoie_la_region_pour_un_administrateur_regional(self):
        Administrateur.objects.create_user(
            email='admin-region@test.sn', password='mot-de-passe-suffisant', nom='Sarr', prenom='Bineta',
            role=Administrateur.Role.ADMIN, region='thies',
        )
        client = APIClient()
        reponse = client.post('/api/v1/auth/login/', {'email': 'admin-region@test.sn', 'password': 'mot-de-passe-suffisant'})
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data['region'], 'thies')

    def test_login_renvoie_une_region_nulle_pour_un_compte_sans_region(self):
        # Le compte de fixture (setUpTestData) est un admin sans région assignée (créé hors
        # validation via create_user, comme un admin régional légitime en aurait toujours
        # une en pratique) — sert ici seulement à vérifier que le claim reste `None`, jamais
        # une chaîne vide ou absent, quand `Administrateur.region` est `None`.
        client = APIClient()
        reponse = client.post('/api/v1/auth/login/', {'email': 'admin@test.sn', 'password': 'mot-de-passe-suffisant'})
        self.assertEqual(reponse.status_code, 200)
        self.assertIsNone(reponse.data['region'])

    def test_login_refuse_mauvais_mot_de_passe(self):
        client = APIClient()
        reponse = client.post('/api/v1/auth/login/', {'email': 'admin@test.sn', 'password': 'faux'})
        self.assertEqual(reponse.status_code, 401)


class LoginThrottleTests(TestCase):
    """Sans limitation, /auth/login/ était ouvert au bruteforce : un script pouvait tester
    des mots de passe en boucle contre un compte connu (ex. admin@saferoad.sn)."""

    @classmethod
    def setUpTestData(cls):
        cls.admin = Administrateur.objects.create_user(
            email='admin-throttle@test.sn', password='mot-de-passe-suffisant', nom='Ka', prenom='Ibrahima',
            role=Administrateur.Role.ADMIN,
        )

    def setUp(self):
        cache.clear()

    def test_bloque_apres_le_nombre_de_tentatives_autorise(self):
        client = APIClient()
        donnees = {'email': 'admin-throttle@test.sn', 'password': 'mauvais-mot-de-passe'}

        for _ in range(5):  # DEFAULT_THROTTLE_RATES['login'] = '5/min'
            reponse = client.post('/api/v1/auth/login/', donnees)
            self.assertEqual(reponse.status_code, 401)

        reponse_bloquee = client.post('/api/v1/auth/login/', donnees)
        self.assertEqual(reponse_bloquee.status_code, 429)

    def test_le_throttle_bloque_meme_avec_le_bon_mot_de_passe(self):
        # Le throttle est par IP, pas par échec d'authentification : un attaquant ne peut
        # pas le contourner en changeant l'email essayé, et un utilisateur légitime qui a
        # dépassé le quota reste bloqué le temps que la fenêtre expire.
        client = APIClient()
        for _ in range(5):
            client.post('/api/v1/auth/login/', {'email': 'admin-throttle@test.sn', 'password': 'faux'})

        reponse = client.post(
            '/api/v1/auth/login/', {'email': 'admin-throttle@test.sn', 'password': 'mot-de-passe-suffisant'},
        )
        self.assertEqual(reponse.status_code, 429)


class LogoutBlacklistTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = Administrateur.objects.create_user(
            email='admin2@test.sn', password='mot-de-passe-suffisant', nom='Fall', prenom='Moussa',
            role=Administrateur.Role.ADMIN,
        )

    def test_logout_blackliste_le_refresh_token(self):
        client = APIClient()
        refresh = RefreshToken.for_user(self.admin)
        client.force_authenticate(user=self.admin)

        reponse = client.post('/api/v1/auth/logout/', {'refresh': str(refresh)})
        self.assertEqual(reponse.status_code, 205)

        # Le refresh token blacklisté ne doit plus permettre d'obtenir un nouvel access token.
        reponse_refresh = client.post('/api/v1/auth/refresh/', {'refresh': str(refresh)})
        self.assertEqual(reponse_refresh.status_code, 401)

    def test_logout_sans_refresh_token_est_rejete(self):
        client = APIClient()
        client.force_authenticate(user=self.admin)
        reponse = client.post('/api/v1/auth/logout/', {})
        self.assertEqual(reponse.status_code, 400)


class AdministrateurViewSetPermissionTests(TestCase):
    """Gestion des comptes réservée au super administrateur (voir étude d'architecture) —
    ni un administrateur régional ni un compte ANASER ne doivent y avoir accès, même en
    lecture seule : un admin régional ne doit jamais voir les comptes d'autres régions."""

    @classmethod
    def setUpTestData(cls):
        cls.admin = Administrateur.objects.create_user(
            email='admin3@test.sn', password='x', nom='Ba', prenom='Fatou',
            role=Administrateur.Role.ADMIN, region='dakar',
        )
        cls.super_admin = Administrateur.objects.create_user(
            email='super3@test.sn', password='x', nom='Diallo', prenom='Cheikh',
            role=Administrateur.Role.SUPER_ADMIN,
        )
        cls.anaser = Administrateur.objects.create_user(
            email='anaser3@test.sn', password='x', nom='Sy', prenom='Ousmane', role=Administrateur.Role.ANASER,
        )

    def test_anaser_ne_peut_pas_lister_les_administrateurs(self):
        client = APIClient()
        client.force_authenticate(user=self.anaser)
        reponse = client.get('/api/v1/administrateurs/')
        self.assertEqual(reponse.status_code, 403)

    def test_administrateur_regional_ne_peut_pas_lister_les_administrateurs(self):
        client = APIClient()
        client.force_authenticate(user=self.admin)
        reponse = client.get('/api/v1/administrateurs/')
        self.assertEqual(reponse.status_code, 403)

    def test_super_administrateur_peut_lister_les_administrateurs(self):
        client = APIClient()
        client.force_authenticate(user=self.super_admin)
        reponse = client.get('/api/v1/administrateurs/')
        self.assertEqual(reponse.status_code, 200)

    def test_anonyme_est_rejete(self):
        client = APIClient()
        reponse = client.get('/api/v1/administrateurs/')
        self.assertEqual(reponse.status_code, 401)


class CoherenceRoleRegionTests(TestCase):
    """Un administrateur régional doit obligatoirement avoir une région, un super
    administrateur ou un compte ANASER ne doit jamais en avoir — vérifié à la création et
    à la modification via l'API (seul point d'entrée contrôlé pour ces comptes)."""

    @classmethod
    def setUpTestData(cls):
        cls.super_admin = Administrateur.objects.create_user(
            email='super4@test.sn', password='x', nom='Niang', prenom='Aissatou',
            role=Administrateur.Role.SUPER_ADMIN,
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.super_admin)

    def test_creation_admin_regional_sans_region_est_rejetee(self):
        reponse = self.client.post('/api/v1/administrateurs/', {
            'email': 'nouveau-admin@test.sn', 'nom': 'Faye', 'prenom': 'Idrissa',
            'role': 'admin', 'password': 'motdepasse123',
        }, format='json')
        self.assertEqual(reponse.status_code, 400)
        self.assertIn('region', reponse.data)

    def test_creation_admin_regional_avec_region_est_acceptee(self):
        reponse = self.client.post('/api/v1/administrateurs/', {
            'email': 'nouveau-admin2@test.sn', 'nom': 'Faye', 'prenom': 'Idrissa',
            'role': 'admin', 'region': 'thies', 'password': 'motdepasse123',
        }, format='json')
        self.assertEqual(reponse.status_code, 201)
        self.assertEqual(reponse.data['region'], 'thies')

    def test_creation_super_admin_avec_region_est_rejetee(self):
        reponse = self.client.post('/api/v1/administrateurs/', {
            'email': 'nouveau-super@test.sn', 'nom': 'Faye', 'prenom': 'Idrissa',
            'role': 'super_admin', 'region': 'dakar', 'password': 'motdepasse123',
        }, format='json')
        self.assertEqual(reponse.status_code, 400)
        self.assertIn('region', reponse.data)

    def test_creation_anaser_avec_region_est_rejetee(self):
        reponse = self.client.post('/api/v1/administrateurs/', {
            'email': 'nouveau-anaser@test.sn', 'nom': 'Faye', 'prenom': 'Idrissa',
            'role': 'anaser', 'region': 'dakar', 'password': 'motdepasse123',
        }, format='json')
        self.assertEqual(reponse.status_code, 400)
        self.assertIn('region', reponse.data)

    def test_creation_super_admin_sans_region_est_acceptee(self):
        reponse = self.client.post('/api/v1/administrateurs/', {
            'email': 'nouveau-super2@test.sn', 'nom': 'Faye', 'prenom': 'Idrissa',
            'role': 'super_admin', 'password': 'motdepasse123',
        }, format='json')
        self.assertEqual(reponse.status_code, 201)
        self.assertIsNone(reponse.data['region'])

    def test_creation_anaser_sans_region_est_acceptee(self):
        reponse = self.client.post('/api/v1/administrateurs/', {
            'email': 'nouveau-anaser2@test.sn', 'nom': 'Faye', 'prenom': 'Idrissa',
            'role': 'anaser', 'password': 'motdepasse123',
        }, format='json')
        self.assertEqual(reponse.status_code, 201)
        self.assertIsNone(reponse.data['region'])

    def test_retirer_la_region_d_un_admin_regional_existant_est_rejete(self):
        admin = Administrateur.objects.create_user(
            email='admin-existant@test.sn', password='x', nom='Cisse', prenom='Modou',
            role=Administrateur.Role.ADMIN, region='kaolack',
        )
        reponse = self.client.patch(f'/api/v1/administrateurs/{admin.id}/', {'region': None}, format='json')
        self.assertEqual(reponse.status_code, 400)

    def test_changer_la_region_d_un_admin_regional_existant_est_accepte(self):
        admin = Administrateur.objects.create_user(
            email='admin-existant2@test.sn', password='x', nom='Cisse', prenom='Modou',
            role=Administrateur.Role.ADMIN, region='kaolack',
        )
        reponse = self.client.patch(f'/api/v1/administrateurs/{admin.id}/', {'region': 'ziguinchor'}, format='json')
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data['region'], 'ziguinchor')


def parametres_du_lien(message):
    """uid et token du lien envoyé par e-mail (…/reinitialiser-mot-de-passe?type=…&uid=…&token=…)."""
    lien = re.search(r'https?://\S+', message.body).group(0)
    return {k: v[0] for k, v in parse_qs(urlparse(lien).query).items()}


class ComptesPersonnelTests(TestCase):
    """Invitation à la création, lien de réinitialisation envoyé par le super admin, mot de
    passe oublié, changement de mot de passe, protections du compte super admin."""

    @classmethod
    def setUpTestData(cls):
        cls.super_admin = Administrateur.objects.create_user(
            email='super-mdp@test.sn', password='Mot-de-passe-solide-1', nom='Fall', prenom='Aida',
            role=Administrateur.Role.SUPER_ADMIN,
        )

    def setUp(self):
        cache.clear()  # compteurs de limitation d'envoi
        self.client = APIClient()
        self.client.force_authenticate(user=self.super_admin)

    def creer_sans_mot_de_passe(self):
        reponse = self.client.post('/api/v1/administrateurs/', {
            'email': 'cheikh@test.sn', 'nom': 'Diop', 'prenom': 'Cheikh', 'telephone': '+221 77 000 00 00',
            'role': 'admin', 'region': 'dakar',
        }, format='json')
        self.assertEqual(reponse.status_code, 201, reponse.data)
        return Administrateur.objects.get(email='cheikh@test.sn')

    def test_creation_sans_mot_de_passe_envoie_une_invitation(self):
        compte = self.creer_sans_mot_de_passe()
        self.assertFalse(compte.has_usable_password())
        self.assertEqual(compte.telephone, '+221 77 000 00 00')
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['cheikh@test.sn'])
        self.assertIn('Activez votre compte', mail.outbox[0].subject)

        parametres = parametres_du_lien(mail.outbox[0])
        self.assertEqual(parametres['type'], 'personnel')
        anonyme = APIClient()
        reponse = anonyme.post('/api/v1/auth/mot-de-passe/reinitialiser/', {
            'uid': parametres['uid'], 'token': parametres['token'], 'nouveau_mot_de_passe': 'Route-sure-2026!',
        }, format='json')
        self.assertEqual(reponse.status_code, 200, reponse.data)
        reponse = anonyme.post('/api/v1/auth/login/', {'email': 'cheikh@test.sn', 'password': 'Route-sure-2026!'})
        self.assertEqual(reponse.status_code, 200)

        # Le lien ne sert qu'une fois : le mot de passe a changé, le jeton n'est plus valable.
        reponse = anonyme.post('/api/v1/auth/mot-de-passe/reinitialiser/', {
            'uid': parametres['uid'], 'token': parametres['token'], 'nouveau_mot_de_passe': 'Autre-chose-2026!',
        }, format='json')
        self.assertEqual(reponse.status_code, 400)

    def test_un_mot_de_passe_trop_faible_est_refuse(self):
        self.creer_sans_mot_de_passe()
        parametres = parametres_du_lien(mail.outbox[0])
        reponse = APIClient().post('/api/v1/auth/mot-de-passe/reinitialiser/', {
            'uid': parametres['uid'], 'token': parametres['token'], 'nouveau_mot_de_passe': '12345678',
        }, format='json')
        self.assertEqual(reponse.status_code, 400)
        self.assertIn('nouveau_mot_de_passe', reponse.data)

    def test_lien_falsifie_refuse(self):
        compte = self.creer_sans_mot_de_passe()
        reponse = APIClient().post('/api/v1/auth/mot-de-passe/reinitialiser/', {
            'uid': 'MTIz', 'token': 'faux-jeton', 'nouveau_mot_de_passe': 'Route-sure-2026!',
        }, format='json')
        self.assertEqual(reponse.status_code, 400)
        compte.refresh_from_db()
        self.assertFalse(compte.has_usable_password())

    def test_le_super_admin_envoie_un_lien_de_reinitialisation(self):
        compte = Administrateur.objects.create_user(
            email='astou@test.sn', password='Ancien-mot-de-passe-1', nom='Sy', prenom='Astou',
            role=Administrateur.Role.ANASER,
        )
        reponse = self.client.post(f'/api/v1/administrateurs/{compte.id}/reinitialiser-mot-de-passe/')
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(mail.outbox[0].to, ['astou@test.sn'])
        self.assertIn('Réinitialisation', mail.outbox[0].subject)

    def test_mot_de_passe_oublie_ne_revele_pas_les_comptes(self):
        anonyme = APIClient()
        existant = anonyme.post('/api/v1/auth/mot-de-passe/oubli/', {'email': 'super-mdp@test.sn'}, format='json')
        inconnu = anonyme.post('/api/v1/auth/mot-de-passe/oubli/', {'email': 'personne@test.sn'}, format='json')
        self.assertEqual((existant.status_code, inconnu.status_code), (200, 200))
        self.assertEqual(existant.data, inconnu.data)
        self.assertEqual([m.to for m in mail.outbox], [['super-mdp@test.sn']])

    def test_reinitialiser_coupe_les_sessions_ouvertes(self):
        anonyme = APIClient()
        session = anonyme.post('/api/v1/auth/login/', {'email': 'super-mdp@test.sn', 'password': 'Mot-de-passe-solide-1'})
        anonyme.post('/api/v1/auth/mot-de-passe/oubli/', {'email': 'super-mdp@test.sn'}, format='json')
        parametres = parametres_du_lien(mail.outbox[0])
        anonyme.post('/api/v1/auth/mot-de-passe/reinitialiser/', {
            'uid': parametres['uid'], 'token': parametres['token'], 'nouveau_mot_de_passe': 'Nouveau-solide-2026!',
        }, format='json')
        reponse = anonyme.post('/api/v1/auth/refresh/', {'refresh': session.data['refresh']}, format='json')
        self.assertEqual(reponse.status_code, 401)

    def test_changer_son_mot_de_passe(self):
        url = '/api/v1/auth/mot-de-passe/changer/'
        mauvais = self.client.post(url, {'ancien_mot_de_passe': 'faux', 'nouveau_mot_de_passe': 'Nouveau-solide-2026!'})
        self.assertEqual(mauvais.status_code, 400)
        bon = self.client.post(url, {'ancien_mot_de_passe': 'Mot-de-passe-solide-1',
                                     'nouveau_mot_de_passe': 'Nouveau-solide-2026!'})
        self.assertEqual(bon.status_code, 200)
        self.super_admin.refresh_from_db()
        self.assertTrue(self.super_admin.check_password('Nouveau-solide-2026!'))

    def test_le_super_admin_ne_peut_ni_se_desactiver_ni_changer_son_role(self):
        url = f'/api/v1/administrateurs/{self.super_admin.id}/'
        self.assertEqual(self.client.patch(url, {'is_active': False}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(url, {'role': 'anaser'}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(url, {'telephone': '+221 70 111 11 11'}, format='json').status_code, 200)

    def test_desactiver_un_compte_coupe_ses_sessions(self):
        compte = Administrateur.objects.create_user(
            email='lamine@test.sn', password='Mot-de-passe-solide-2', nom='Camara', prenom='Lamine',
            role=Administrateur.Role.ADMIN, region='thies',
        )
        session = APIClient().post('/api/v1/auth/login/', {'email': 'lamine@test.sn', 'password': 'Mot-de-passe-solide-2'})
        self.client.patch(f'/api/v1/administrateurs/{compte.id}/', {'is_active': False}, format='json')
        reponse = APIClient().post('/api/v1/auth/refresh/', {'refresh': session.data['refresh']}, format='json')
        self.assertEqual(reponse.status_code, 401)

    def test_aucune_suppression_de_compte(self):
        compte = Administrateur.objects.create_user(
            email='rokhaya@test.sn', password='x', nom='Mbaye', prenom='Rokhaya', role=Administrateur.Role.ANASER,
        )
        self.assertEqual(self.client.delete(f'/api/v1/administrateurs/{compte.id}/').status_code, 405)
