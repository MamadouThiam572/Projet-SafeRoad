from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.comptes.models import Administrateur
from apps.conducteurs.models import Conducteur
from apps.core.regions import Region
from apps.zones.models import Zone

from .models import Boitier
from .serializers import BoitierSerializer

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
            statut_validation=Zone.StatutValidation.RECONNUE,
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
            statut_validation=Zone.StatutValidation.PROPOSEE,
        )
        client = APIClient()

        reponse = client.post(
            '/api/v1/boitiers/position/',
            {'latitude': LATITUDE_BASE, 'longitude': LONGITUDE_BASE},
            **self.headers,
        )

        self.assertFalse(reponse.data['alerte_proximite'])

    def test_seule_une_zone_reconnue_par_l_anaser_declenche_l_alerte_de_zone(self):
        # Règle métier : la validation technique dit « potentiellement à risque » ; seule la
        # reconnaissance ANASER active l'alerte « vous entrez dans une zone à risque ».
        # (Les alertes dynamiques des capteurs sont déclenchées par le boîtier lui-même.)
        zone = Zone.objects.create(latitude_centre=LATITUDE_BASE, longitude_centre=LONGITUDE_BASE, rayon_metres=100)
        client = APIClient()
        donnees = {'latitude': LATITUDE_BASE, 'longitude': LONGITUDE_BASE}

        for statut in Zone.StatutValidation:
            if statut == Zone.StatutValidation.RECONNUE:
                continue
            with self.subTest(statut=statut):
                Zone.objects.filter(pk=zone.pk).update(statut_validation=statut)
                cache.clear()
                reponse = client.post('/api/v1/boitiers/position/', donnees, **self.headers)
                self.assertFalse(reponse.data['alerte_proximite'])
                self.assertIsNone(reponse.data['zone'])

        Zone.objects.filter(pk=zone.pk).update(statut_validation=Zone.StatutValidation.RECONNUE)
        cache.clear()
        reponse = client.post('/api/v1/boitiers/position/', donnees, **self.headers)
        self.assertTrue(reponse.data['alerte_proximite'])
        self.assertEqual(reponse.data['zone'], str(zone.id))

    def test_la_position_enregistre_les_donnees_gps_du_boitier(self):
        client = APIClient()
        reponse = client.post('/api/v1/boitiers/position/', {
            'latitude': LATITUDE_BASE, 'longitude': LONGITUDE_BASE,
            'vitesse_gps': 48.2, 'hdop': 1.1, 'nombre_satellites': 8,
        }, **self.headers)
        self.assertEqual(reponse.status_code, 200)
        self.boitier.refresh_from_db()
        self.assertEqual(
            (self.boitier.derniere_vitesse_gps, self.boitier.dernier_hdop, self.boitier.dernier_nombre_satellites),
            (48.2, 1.1, 8),
        )

    def test_la_date_gps_de_la_position_donne_la_latence(self):
        client = APIClient()
        mesure = timezone.now() - timezone.timedelta(seconds=2)
        client.post('/api/v1/boitiers/position/', {
            'latitude': LATITUDE_BASE, 'longitude': LONGITUDE_BASE, 'horodatage': mesure.isoformat(),
        }, **self.headers)
        self.boitier.refresh_from_db()
        self.assertEqual(self.boitier.derniere_position_horodatage, mesure)
        latence = BoitierSerializer(self.boitier).data['latence_ms']
        self.assertGreaterEqual(latence, 2000)
        self.assertLess(latence, 60_000)

    def test_une_date_gps_dans_le_futur_est_ignoree(self):
        client = APIClient()
        futur = timezone.now() + timezone.timedelta(days=365 * 50)
        reponse = client.post('/api/v1/boitiers/position/', {
            'latitude': LATITUDE_BASE, 'longitude': LONGITUDE_BASE, 'horodatage': futur.isoformat(),
        }, **self.headers)
        self.assertEqual(reponse.status_code, 200)
        self.boitier.refresh_from_db()
        self.assertIsNone(self.boitier.derniere_position_horodatage)
        self.assertEqual(self.boitier.derniere_latitude, LATITUDE_BASE)  # la position reste acceptée

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
        # super_admin, pas admin régional : ce test porte sur la régénération de clé, pas
        # sur le filtrage régional (voir BoitierFiltrageRegionalTests pour celui-ci) — un
        # admin régional sans région assignée n'aurait accès à aucun boîtier.
        self.admin = Administrateur.objects.create_user(
            email='admin-boitier@test.sn', password='x', nom='Ndiaye', prenom='Aissatou',
            role=Administrateur.Role.SUPER_ADMIN,
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
        # super_admin : ce test porte sur la mécanique de pagination, pas sur le filtrage
        # régional — les 16 boîtiers créés ci-dessous n'ont volontairement pas de région.
        cls.admin = Administrateur.objects.create_user(
            email='admin-pagination@test.sn', password='x', nom='Sarr', prenom='Cheikh',
            role=Administrateur.Role.SUPER_ADMIN,
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
        cls.super_admin = Administrateur.objects.create_user(
            email='super-admin-region-boitier@test.sn', password='x', nom='Diallo', prenom='Aminata',
            role=Administrateur.Role.SUPER_ADMIN,
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
        # super_admin : ce test porte sur la sérialisation, pas sur le filtrage régional —
        # le boîtier est volontairement dans une région différente de celle de self.admin.
        boitier = Boitier.objects.create(
            region=Region.KOLDA, statut=Boitier.Statut.MAINTENANCE,
            derniere_latitude=LATITUDE_BASE, derniere_longitude=LONGITUDE_BASE,
        )
        self.client.force_authenticate(user=self.super_admin)
        reponse = self.client.get(f'/api/v1/boitiers/{boitier.id}/')
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data['region'], 'kolda')
        self.assertEqual(reponse.data['region_libelle'], 'Kolda')
        self.assertEqual(reponse.data['statut'], 'maintenance')
        self.assertEqual(reponse.data['statut_libelle'], 'Maintenance')
        self.assertEqual(reponse.data['derniere_latitude'], LATITUDE_BASE)
        self.assertEqual(reponse.data['derniere_longitude'], LONGITUDE_BASE)

    def test_le_serializer_expose_une_region_nulle_sans_erreur(self):
        # super_admin : un boîtier region=None serait invisible pour un admin régional
        # (queryset filtré sur sa propre région) — ce test porte sur la sérialisation.
        boitier = Boitier.objects.create()
        self.client.force_authenticate(user=self.super_admin)
        reponse = self.client.get(f'/api/v1/boitiers/{boitier.id}/')
        self.assertEqual(reponse.status_code, 200)
        self.assertIsNone(reponse.data['region'])
        self.assertIsNone(reponse.data['region_libelle'])

    def test_creation_via_api_ignore_la_region_envoyee_par_le_client(self):
        # Depuis l'étape 4A (filtrage régional des boîtiers) : un administrateur régional ne
        # peut plus imposer une région arbitraire à la création — voir BoitierFiltrageRegionalTests
        # pour le test de contournement dédié. self.admin est rattaché à 'dakar'.
        reponse = self.client.post('/api/v1/boitiers/', {
            'proprietaire_nom': 'Transports Bâ', 'numero_immatriculation': 'DK-1234-AA', 'region': 'saint_louis',
        }, format='json')
        self.assertEqual(reponse.status_code, 201)
        self.assertEqual(reponse.data['region'], 'dakar')  # jamais 'saint_louis' envoyé par le client
        self.assertIn('api_key', reponse.data)

    def test_creation_via_api_sans_region_fournie_utilise_celle_de_l_administrateur(self):
        reponse = self.client.post('/api/v1/boitiers/', {
            'proprietaire_nom': 'Transports Bâ', 'numero_immatriculation': 'DK-5678-BB',
        }, format='json')
        self.assertEqual(reponse.status_code, 201)
        self.assertEqual(reponse.data['region'], 'dakar')

    def test_region_invalide_est_rejetee_pour_un_super_admin(self):
        # Pour un administrateur régional, la région du client est de toute façon ignorée
        # (voir ci-dessus) — une valeur invalide n'a donc plus l'occasion d'être validée
        # pour lui. Seul un super administrateur transmet encore sa propre valeur de région.
        self.client.force_authenticate(user=self.super_admin)
        reponse = self.client.post('/api/v1/boitiers/', {
            'proprietaire_nom': 'Transports Bâ', 'region': 'paris',
        }, format='json')
        self.assertEqual(reponse.status_code, 400)
        self.assertIn('region', reponse.data)

    def test_region_absente_est_rejetee_pour_un_super_admin(self):
        # Une nouvelle création sans région serait invisible pour tout administrateur
        # régional (FiltreRegional) sans que personne ne s'en aperçoive — désormais
        # explicitement refusée avec une erreur claire plutôt que silencieusement acceptée
        # à NULL. Pour un administrateur régional, la région est de toute façon substituée
        # avant validation (voir test_creation_via_api_sans_region_fournie_...) : cette
        # contrainte ne mord donc que sur le super administrateur.
        self.client.force_authenticate(user=self.super_admin)
        reponse = self.client.post('/api/v1/boitiers/', {
            'proprietaire_nom': 'Transports Bâ',
        }, format='json')
        self.assertEqual(reponse.status_code, 400)
        self.assertIn('region', reponse.data)

    def test_region_vide_est_rejetee_pour_un_super_admin(self):
        self.client.force_authenticate(user=self.super_admin)
        reponse = self.client.post('/api/v1/boitiers/', {
            'proprietaire_nom': 'Transports Bâ', 'region': '',
        }, format='json')
        self.assertEqual(reponse.status_code, 400)
        self.assertIn('region', reponse.data)

    def test_boitier_existant_sans_region_reste_lisible_et_modifiable(self):
        # La contrainte "région obligatoire" ne s'applique qu'à la création (serializer) —
        # jamais au modèle : un boîtier historique region=None doit rester consultable et
        # modifiable sur ses autres champs sans qu'on soit forcé de lui inventer une région.
        boitier = Boitier.objects.create()
        self.client.force_authenticate(user=self.super_admin)
        reponse = self.client.patch(f'/api/v1/boitiers/{boitier.id}/', {
            'statut': Boitier.Statut.MAINTENANCE,
        }, format='json')
        self.assertEqual(reponse.status_code, 200)
        self.assertIsNone(reponse.data['region'])
        self.assertEqual(reponse.data['statut'], 'maintenance')


class BoitierFiltrageRegionalTests(TestCase):
    """Étape 4A : le ViewSet des boîtiers applique désormais FiltreRegional (voir
    apps/core/regionalisation.py). Couvre la lecture (liste + détail), l'écriture
    (PATCH/DELETE) sur un objet d'une autre région, la création, et la tentative de
    contournement par un paramètre client."""

    @classmethod
    def setUpTestData(cls):
        cls.super_admin = Administrateur.objects.create_user(
            email='super-admin-boitiers@test.sn', password='x', nom='Sarr', prenom='Modou',
            role=Administrateur.Role.SUPER_ADMIN,
        )
        cls.admin_dakar = Administrateur.objects.create_user(
            email='admin-dakar-boitiers@test.sn', password='x', nom='Ndiaye', prenom='Coumba',
            role=Administrateur.Role.ADMIN, region='dakar',
        )
        cls.admin_sans_region = Administrateur.objects.create_user(
            email='admin-sr-boitiers@test.sn', password='x', nom='Sow', prenom='Alioune',
            role=Administrateur.Role.ADMIN, region=None,
        )
        cls.anaser = Administrateur.objects.create_user(
            email='anaser-boitiers@test.sn', password='x', nom='Faye', prenom='Bineta',
            role=Administrateur.Role.ANASER,
        )

        cls.boitier_dakar = Boitier.objects.create(region='dakar', numero_immatriculation='DK-0001')
        cls.boitier_thies = Boitier.objects.create(region='thies', numero_immatriculation='TH-0001')
        cls.boitier_ziguinchor = Boitier.objects.create(region='ziguinchor', numero_immatriculation='ZG-0001')

    def setUp(self):
        self.client = APIClient()

    # --- A. Super Admin ---

    def test_super_admin_voit_les_boitiers_de_toutes_les_regions(self):
        self.client.force_authenticate(user=self.super_admin)
        reponse = self.client.get('/api/v1/boitiers/')
        self.assertEqual(reponse.status_code, 200)
        ids = {b['id'] for b in reponse.data}
        self.assertEqual(ids, {str(self.boitier_dakar.id), str(self.boitier_thies.id), str(self.boitier_ziguinchor.id)})

    # --- B. Admin régional : liste ---

    def test_admin_regional_ne_voit_que_les_boitiers_de_sa_region(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.get('/api/v1/boitiers/')
        self.assertEqual(reponse.status_code, 200)
        ids = {b['id'] for b in reponse.data}
        self.assertEqual(ids, {str(self.boitier_dakar.id)})

    # --- C. Admin régional : détail d'un boîtier d'une autre région ---

    def test_admin_regional_ne_peut_pas_recuperer_un_boitier_d_une_autre_region(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.get(f'/api/v1/boitiers/{self.boitier_thies.id}/')
        self.assertEqual(reponse.status_code, 404)

    def test_admin_regional_peut_recuperer_un_boitier_de_sa_propre_region(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.get(f'/api/v1/boitiers/{self.boitier_dakar.id}/')
        self.assertEqual(reponse.status_code, 200)

    # --- D. PATCH sur un boîtier d'une autre région ---

    def test_admin_regional_ne_peut_pas_modifier_un_boitier_d_une_autre_region(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.patch(
            f'/api/v1/boitiers/{self.boitier_thies.id}/', {'statut': 'maintenance'}, format='json',
        )
        self.assertEqual(reponse.status_code, 404)
        self.boitier_thies.refresh_from_db()
        self.assertEqual(self.boitier_thies.statut, 'actif')  # inchangé

    # --- E. DELETE sur un boîtier d'une autre région ---

    def test_admin_regional_ne_peut_pas_supprimer_un_boitier_d_une_autre_region(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.delete(f'/api/v1/boitiers/{self.boitier_ziguinchor.id}/')
        self.assertEqual(reponse.status_code, 404)
        self.assertTrue(Boitier.objects.filter(id=self.boitier_ziguinchor.id).exists())

    # --- F. Admin régional sans région ---

    def test_admin_regional_sans_region_ne_voit_aucun_boitier(self):
        self.client.force_authenticate(user=self.admin_sans_region)
        reponse = self.client.get('/api/v1/boitiers/')
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data, [])

    # --- G. Sécurité : paramètre client ignoré ---

    def test_un_parametre_region_dans_l_url_est_ignore(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.get('/api/v1/boitiers/?region=thies')
        self.assertEqual(reponse.status_code, 200)
        ids = {b['id'] for b in reponse.data}
        self.assertEqual(ids, {str(self.boitier_dakar.id)})  # jamais les boîtiers de Thiès

    # --- H. Création : contournement par la région ---

    def test_admin_regional_ne_peut_pas_creer_un_boitier_dans_une_autre_region(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.post('/api/v1/boitiers/', {
            'proprietaire_nom': 'Transports Diop', 'region': 'ziguinchor',
        }, format='json')
        self.assertEqual(reponse.status_code, 201)
        self.assertEqual(reponse.data['region'], 'dakar')  # jamais 'ziguinchor'

    def test_super_admin_peut_choisir_la_region_a_la_creation(self):
        self.client.force_authenticate(user=self.super_admin)
        reponse = self.client.post('/api/v1/boitiers/', {
            'proprietaire_nom': 'Transports Fall', 'region': 'kolda',
        }, format='json')
        self.assertEqual(reponse.status_code, 201)
        self.assertEqual(reponse.data['region'], 'kolda')

    # --- I. ANASER : lecture seule nationale, sans données personnelles ---

    def test_anaser_consulte_tous_les_boitiers_sans_donnees_personnelles(self):
        self.client.force_authenticate(user=self.anaser)
        reponse = self.client.get('/api/v1/boitiers/')
        self.assertEqual(reponse.status_code, 200)
        boitiers = reponse.data['results'] if isinstance(reponse.data, dict) else reponse.data
        self.assertEqual(len(boitiers), Boitier.objects.count())
        champs_interdits = {
            'proprietaire_nom', 'proprietaire_telephone', 'numero_immatriculation',
            'derniere_latitude', 'derniere_longitude',
        }
        for boitier in boitiers:
            self.assertFalse(champs_interdits & boitier.keys())
            self.assertIn('nombre_incidents', boitier)

    def test_anaser_ne_peut_ni_creer_ni_modifier_ni_supprimer_un_boitier(self):
        self.client.force_authenticate(user=self.anaser)
        boitier = Boitier.objects.first()
        self.assertEqual(self.client.post('/api/v1/boitiers/', {'region': 'dakar'}, format='json').status_code, 403)
        self.assertEqual(
            self.client.patch(f'/api/v1/boitiers/{boitier.id}/', {'statut': 'inactif'}, format='json').status_code,
            403,
        )
        self.assertEqual(self.client.delete(f'/api/v1/boitiers/{boitier.id}/').status_code, 403)
        self.assertEqual(self.client.post(f'/api/v1/boitiers/{boitier.id}/regenerer-cle/').status_code, 403)


class AffectationConducteurTests(TestCase):
    """Affectation boîtier <-> conducteur : un conducteur porte au plus un boîtier, une
    réaffectation libère l'ancien conducteur, chaque événement est historisé, et un
    administrateur régional n'agit que sur les boîtiers de sa région."""

    @classmethod
    def setUpTestData(cls):
        cls.super_admin = Administrateur.objects.create_user(
            email='super-aff@test.sn', password='x', nom='Fall', prenom='Aida', role=Administrateur.Role.SUPER_ADMIN,
        )
        cls.admin_dakar = Administrateur.objects.create_user(
            email='dakar-aff@test.sn', password='x', nom='Diop', prenom='Cheikh',
            role=Administrateur.Role.ADMIN, region='dakar',
        )
        cls.anaser = Administrateur.objects.create_user(
            email='anaser-aff@test.sn', password='x', nom='Diallo', prenom='Assane', role=Administrateur.Role.ANASER,
        )

    def setUp(self):
        self.boitier_dakar = Boitier.objects.create(region='dakar')
        self.boitier_thies = Boitier.objects.create(region='thies')
        self.awa = Conducteur.objects.create_user(email='awa-aff@test.sn', password='x', nom='Ba', prenom='Awa')
        self.moussa = Conducteur.objects.create_user(email='moussa-aff@test.sn', password='x', nom='Sy', prenom='Moussa')

    def client_pour(self, utilisateur):
        client = APIClient()
        client.force_authenticate(user=utilisateur)
        return client

    def affecter(self, utilisateur, boitier, conducteur, **extra):
        return self.client_pour(utilisateur).post(
            f'/api/v1/boitiers/{boitier.id}/affecter/', {'conducteur': str(conducteur.id), **extra}, format='json',
        )

    def test_affecter_un_boitier(self):
        reponse = self.affecter(self.admin_dakar, self.boitier_dakar, self.awa, numero_immatriculation='DK-1234-AB')
        self.assertEqual(reponse.status_code, 200, reponse.data)
        self.assertEqual(reponse.data['conducteur']['nom'], 'Awa Ba')
        self.assertIsNotNone(reponse.data['date_affectation'])
        self.assertEqual(reponse.data['numero_immatriculation'], 'DK-1234-AB')
        self.awa.refresh_from_db()
        self.assertEqual(self.awa.boitier_id, self.boitier_dakar.id)

    def test_reaffecter_libere_l_ancien_conducteur_et_trace_tout(self):
        self.affecter(self.admin_dakar, self.boitier_dakar, self.awa)
        self.affecter(self.admin_dakar, self.boitier_dakar, self.moussa)

        self.awa.refresh_from_db()
        self.moussa.refresh_from_db()
        self.assertIsNone(self.awa.boitier_id)
        self.assertEqual(self.moussa.boitier_id, self.boitier_dakar.id)
        historique = self.client_pour(self.super_admin).get(f'/api/v1/boitiers/{self.boitier_dakar.id}/historique/').data
        self.assertEqual(
            [(h['evenement'], h['conducteur_nom']) for h in historique],
            [('affecte', 'Moussa Sy'), ('desaffecte', 'Awa Ba'), ('affecte', 'Awa Ba')],
        )
        self.assertEqual(historique[0]['acteur'], self.admin_dakar.id)

    def test_un_conducteur_deja_equipe_doit_etre_libere_avant(self):
        self.affecter(self.super_admin, self.boitier_thies, self.awa)
        reponse = self.affecter(self.super_admin, self.boitier_dakar, self.awa)
        self.assertEqual(reponse.status_code, 400)
        self.awa.refresh_from_db()
        self.assertEqual(self.awa.boitier_id, self.boitier_thies.id)

    def test_desaffecter(self):
        self.affecter(self.admin_dakar, self.boitier_dakar, self.awa)
        reponse = self.client_pour(self.admin_dakar).post(
            f'/api/v1/boitiers/{self.boitier_dakar.id}/desaffecter/', {'commentaire': 'Véhicule vendu'}, format='json',
        )
        self.assertEqual(reponse.status_code, 200)
        self.assertIsNone(reponse.data['conducteur'])
        self.awa.refresh_from_db()
        self.assertIsNone(self.awa.boitier_id)
        self.assertEqual(
            self.client_pour(self.admin_dakar).post(f'/api/v1/boitiers/{self.boitier_dakar.id}/desaffecter/').status_code,
            400,  # plus rien à désaffecter
        )

    def test_l_admin_regional_n_agit_que_dans_sa_region(self):
        self.assertEqual(self.affecter(self.admin_dakar, self.boitier_thies, self.awa).status_code, 404)

    def test_anaser_ne_peut_pas_affecter(self):
        self.assertEqual(self.affecter(self.anaser, self.boitier_dakar, self.awa).status_code, 403)

    def test_conducteur_desactive_ou_inconnu_refuse(self):
        self.awa.is_active = False
        self.awa.save(update_fields=['is_active'])
        self.assertEqual(self.affecter(self.super_admin, self.boitier_dakar, self.awa).status_code, 400)
        reponse = self.client_pour(self.super_admin).post(
            f'/api/v1/boitiers/{self.boitier_dakar.id}/affecter/',
            {'conducteur': '00000000-0000-0000-0000-000000000000'}, format='json',
        )
        self.assertEqual(reponse.status_code, 400)

    def test_l_enregistrement_d_un_boitier_est_historise(self):
        reponse = self.client_pour(self.super_admin).post('/api/v1/boitiers/', {'region': 'kolda'}, format='json')
        historique = self.client_pour(self.super_admin).get(f"/api/v1/boitiers/{reponse.data['id']}/historique/").data
        self.assertEqual([h['evenement'] for h in historique], ['enregistre'])

    def test_liste_des_conducteurs_pour_l_admin_regional(self):
        self.affecter(self.super_admin, self.boitier_thies, self.moussa)
        fatou = Conducteur.objects.create_user(email='fatou-aff@test.sn', password='x', nom='Ndiaye', prenom='Fatou')
        self.affecter(self.super_admin, self.boitier_dakar, fatou)

        ids = {c['id'] for c in self.client_pour(self.admin_dakar).get('/api/v1/conducteurs/').data}
        # Équipée à Dakar + disponible ; pas Moussa (équipé à Thiès).
        self.assertEqual(ids, {str(fatou.id), str(self.awa.id)})

        tous = {c['id'] for c in self.client_pour(self.super_admin).get('/api/v1/conducteurs/').data}
        self.assertEqual(tous, {str(fatou.id), str(self.awa.id), str(self.moussa.id)})

        disponibles = self.client_pour(self.super_admin).get('/api/v1/conducteurs/?disponible=1').data
        self.assertEqual([c['id'] for c in disponibles], [str(self.awa.id)])
        recherche = self.client_pour(self.super_admin).get('/api/v1/conducteurs/?q=ndiaye').data
        self.assertEqual([c['region'] for c in recherche], ['dakar'])

    def test_la_liste_des_conducteurs_est_reservee_aux_administrateurs(self):
        self.assertEqual(self.client_pour(self.anaser).get('/api/v1/conducteurs/').status_code, 403)
        self.assertEqual(self.client_pour(self.awa).get('/api/v1/conducteurs/').status_code, 403)
