from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.comptes.models import Administrateur
from apps.core.regions import Region
from apps.zones.models import Zone

from .models import Boitier

LATITUDE_BASE, LONGITUDE_BASE = 14.6928, -17.4467


class BoitierPositionTests(TestCase):
    """Chemin le plus sollicité du système (un appel par boîtier et par intervalle de
    synchronisation) : proximité de zone, cooldown des alertes, et le pré-filtre
    bounding box qui ne doit jamais exclure à tort une zone réellement proche."""

    def setUp(self):
        cache.clear()  # le cache des zones actives (TTL 60s) ne suit pas les rollbacks de TestCase
        self.boitier = Boitier()
        self.boitier.set_api_key('cle-de-test')
        self.boitier.save()
        self.headers = {'HTTP_X_BOITIER_UUID': str(self.boitier.id), 'HTTP_X_BOITIER_API_KEY': 'cle-de-test'}

    def _creer_zone_validee(self, decalage=0.0, niveau_danger=Zone.NiveauDanger.CRITIQUE):
        return Zone.objects.create(
            latitude_centre=LATITUDE_BASE + decalage,
            longitude_centre=LONGITUDE_BASE + decalage,
            rayon_metres=100,
            nombre_incidents=5,
            niveau_danger=niveau_danger,
            statut_validation=Zone.StatutValidation.VALIDEE,
        )

    def test_position_pres_d_une_zone_declenche_une_alerte(self):
        zone = self._creer_zone_validee()
        client = APIClient()

        reponse = client.post(
            '/api/v1/boitiers/position/',
            {'latitude': LATITUDE_BASE, 'longitude': LONGITUDE_BASE},
            **self.headers,
        )

        self.assertEqual(reponse.status_code, 200)
        self.assertTrue(reponse.data['alerte_proximite'])
        self.assertEqual(reponse.data['zone'], str(zone.id))
        self.assertEqual(reponse.data['niveau_danger'], Zone.NiveauDanger.CRITIQUE)
        self.assertEqual(reponse.data['canal_led'], 'rouge')

    def test_position_loin_de_toute_zone_ne_declenche_rien(self):
        self._creer_zone_validee()
        client = APIClient()

        reponse = client.post(
            '/api/v1/boitiers/position/',
            {'latitude': LATITUDE_BASE + 5, 'longitude': LONGITUDE_BASE + 5},  # ~500km plus loin
            **self.headers,
        )

        self.assertEqual(reponse.status_code, 200)
        self.assertFalse(reponse.data['alerte_proximite'])
        self.assertIsNone(reponse.data['zone'])

    def test_zone_non_validee_est_ignoree(self):
        Zone.objects.create(
            latitude_centre=LATITUDE_BASE, longitude_centre=LONGITUDE_BASE, rayon_metres=100,
            statut_validation=Zone.StatutValidation.EN_ATTENTE,
        )
        client = APIClient()

        reponse = client.post(
            '/api/v1/boitiers/position/',
            {'latitude': LATITUDE_BASE, 'longitude': LONGITUDE_BASE},
            **self.headers,
        )

        self.assertFalse(reponse.data['alerte_proximite'])

    def test_cooldown_empeche_une_deuxieme_alerte_immediate(self):
        self._creer_zone_validee()
        client = APIClient()
        donnees = {'latitude': LATITUDE_BASE, 'longitude': LONGITUDE_BASE}

        premiere = client.post('/api/v1/boitiers/position/', donnees, **self.headers)
        deuxieme = client.post('/api/v1/boitiers/position/', donnees, **self.headers)

        self.assertTrue(premiere.data['alerte_proximite'])
        self.assertFalse(deuxieme.data['alerte_proximite'])  # même zone, dans la fenêtre de cooldown

    def test_authentification_refusee_avec_mauvaise_cle(self):
        client = APIClient()
        reponse = client.post(
            '/api/v1/boitiers/position/',
            {'latitude': LATITUDE_BASE, 'longitude': LONGITUDE_BASE},
            HTTP_X_BOITIER_UUID=str(self.boitier.id),
            HTTP_X_BOITIER_API_KEY='mauvaise-cle',
        )
        self.assertEqual(reponse.status_code, 401)


class RegenerationCleTests(TestCase):
    """La régénération de clé ne doit jamais couper un boîtier sur le terrain sans
    délai : l'ancienne clé doit rester valide pendant la fenêtre de grâce configurée."""

    def setUp(self):
        self.admin = Administrateur.objects.create_user(
            email='admin-boitier@test.sn', password='x', nom='Ndiaye', prenom='Aissatou',
            role=Administrateur.Role.ADMIN,
        )
        self.boitier = Boitier()
        self.boitier.set_api_key('cle-initiale')
        self.boitier.save()

    def test_ancienne_cle_reste_valide_pendant_la_fenetre_de_grace(self):
        admin_client = APIClient()
        admin_client.force_authenticate(user=self.admin)
        reponse = admin_client.post(f'/api/v1/boitiers/{self.boitier.id}/regenerer-cle/')
        self.assertEqual(reponse.status_code, 200)
        nouvelle_cle = reponse.data['api_key']

        self.boitier.refresh_from_db()
        self.assertTrue(self.boitier.verifier_api_key('cle-initiale'))  # toujours valide (fenêtre de grâce)
        self.assertTrue(self.boitier.verifier_api_key(nouvelle_cle))
        self.assertFalse(self.boitier.verifier_api_key('cle-au-hasard'))

    def test_ancienne_cle_est_rejetee_apres_expiration_de_la_grace(self):
        admin_client = APIClient()
        admin_client.force_authenticate(user=self.admin)
        admin_client.post(f'/api/v1/boitiers/{self.boitier.id}/regenerer-cle/')

        self.boitier.refresh_from_db()
        self.boitier.api_key_hash_ancien_expire_le = timezone.now() - timezone.timedelta(seconds=1)
        self.boitier.save(update_fields=['api_key_hash_ancien_expire_le'])

        self.assertFalse(self.boitier.verifier_api_key('cle-initiale'))


class BoitierPaginationOptionnelleTests(TestCase):
    """La pagination ne doit s'activer qu'avec `?page=` explicite : les compteurs de la
    sidebar et les KPI du dashboard comptent sur la liste complète, non paginée, pour
    rester exacts au-delà de 15 éléments — voir apps/core/pagination.py."""

    @classmethod
    def setUpTestData(cls):
        cls.admin = Administrateur.objects.create_user(
            email='admin-pagination@test.sn', password='x', nom='Sarr', prenom='Cheikh',
            role=Administrateur.Role.ADMIN,
        )
        for _ in range(16):
            Boitier.objects.create()

    def test_sans_parametre_page_renvoie_la_liste_complete(self):
        client = APIClient()
        client.force_authenticate(user=self.admin)
        reponse = client.get('/api/v1/boitiers/')
        self.assertEqual(reponse.status_code, 200)
        self.assertIsInstance(reponse.data, list)
        self.assertEqual(len(reponse.data), 16)

    def test_avec_parametre_page_renvoie_une_page_paginee(self):
        client = APIClient()
        client.force_authenticate(user=self.admin)
        reponse = client.get('/api/v1/boitiers/?page=1')
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data['count'], 16)
        self.assertEqual(len(reponse.data['results']), 15)
        self.assertIsNotNone(reponse.data['next'])


class BoitierRegionEtStatutTests(TestCase):
    """Région d'affectation (distincte du GPS, jamais déduite automatiquement) et statut
    existant — voir apps/core/regions.py et Boitier.Statut. `region` doit rester utilisable
    à NULL (données existantes) sans casser la création, la lecture ou les champs déjà en
    place (statut, position GPS)."""

    @classmethod
    def setUpTestData(cls):
        cls.admin = Administrateur.objects.create_user(
            email='admin-region-boitier@test.sn', password='x', nom='Kane', prenom='Seynabou',
            role=Administrateur.Role.ADMIN, region='dakar',
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_un_boitier_peut_avoir_une_region_du_referentiel_partage(self):
        boitier = Boitier.objects.create(region=Region.THIES)
        boitier.refresh_from_db()
        self.assertEqual(boitier.region, 'thies')

    def test_region_reste_nulle_pour_les_boitiers_existants(self):
        # Reproduit un boîtier créé avant l'introduction du champ : aucune valeur ne doit
        # être devinée/imposée.
        boitier = Boitier.objects.create()
        self.assertIsNone(boitier.region)

    def test_statut_existant_continue_de_fonctionner(self):
        boitier = Boitier.objects.create(statut=Boitier.Statut.INACTIF)
        boitier.refresh_from_db()
        self.assertEqual(boitier.statut, 'inactif')  # valeur stockée inchangée
        self.assertEqual(boitier.get_statut_display(), 'Arrêt volontaire')  # libellé clarifié

    def test_position_gps_existante_continue_de_fonctionner(self):
        boitier = Boitier.objects.create(
            derniere_latitude=LATITUDE_BASE, derniere_longitude=LONGITUDE_BASE, region='dakar',
        )
        boitier.refresh_from_db()
        self.assertEqual(boitier.derniere_latitude, LATITUDE_BASE)
        self.assertEqual(boitier.derniere_longitude, LONGITUDE_BASE)
        # La position GPS ne doit jamais influencer/écraser la région d'affectation.
        self.assertEqual(boitier.region, 'dakar')

    def test_le_serializer_expose_region_statut_et_gps(self):
        boitier = Boitier.objects.create(
            region=Region.KOLDA, statut=Boitier.Statut.MAINTENANCE,
            derniere_latitude=LATITUDE_BASE, derniere_longitude=LONGITUDE_BASE,
        )
        reponse = self.client.get(f'/api/v1/boitiers/{boitier.id}/')
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data['region'], 'kolda')
        self.assertEqual(reponse.data['region_libelle'], 'Kolda')
        self.assertEqual(reponse.data['statut'], 'maintenance')
        self.assertEqual(reponse.data['statut_libelle'], 'Maintenance')
        self.assertEqual(reponse.data['derniere_latitude'], LATITUDE_BASE)
        self.assertEqual(reponse.data['derniere_longitude'], LONGITUDE_BASE)

    def test_le_serializer_expose_une_region_nulle_sans_erreur(self):
        boitier = Boitier.objects.create()
        reponse = self.client.get(f'/api/v1/boitiers/{boitier.id}/')
        self.assertEqual(reponse.status_code, 200)
        self.assertIsNone(reponse.data['region'])
        self.assertIsNone(reponse.data['region_libelle'])

    def test_creation_via_api_avec_region_fonctionne(self):
        reponse = self.client.post('/api/v1/boitiers/', {
            'proprietaire_nom': 'Transports Bâ', 'numero_immatriculation': 'DK-1234-AA', 'region': 'saint_louis',
        }, format='json')
        self.assertEqual(reponse.status_code, 201)
        self.assertEqual(reponse.data['region'], 'saint_louis')
        self.assertIn('api_key', reponse.data)

    def test_creation_via_api_sans_region_fonctionne_toujours(self):
        # Ne doit PAS devenir obligatoire à cette étape (pas de stratégie d'initialisation
        # définie) — contrairement à Administrateur, où la région est requise pour role=admin.
        reponse = self.client.post('/api/v1/boitiers/', {
            'proprietaire_nom': 'Transports Bâ', 'numero_immatriculation': 'DK-5678-BB',
        }, format='json')
        self.assertEqual(reponse.status_code, 201)
        self.assertIsNone(reponse.data['region'])

    def test_region_invalide_est_rejetee(self):
        reponse = self.client.post('/api/v1/boitiers/', {
            'proprietaire_nom': 'Transports Bâ', 'region': 'paris',
        }, format='json')
        self.assertEqual(reponse.status_code, 400)
        self.assertIn('region', reponse.data)
