from types import SimpleNamespace

from django.test import SimpleTestCase, TestCase

from apps.boitiers.models import Boitier
from apps.comptes.models import Administrateur
from apps.core.geo import _contours_regions, _dans_polygone, boite_englobante, region_depuis_gps
from apps.core.permissions import (
    EstAdministrateur,
    EstAdministrateurRegional,
    EstAdminOuAnaser,
    EstAnaser,
    EstBoitier,
    EstSuperAdministrateur,
)
from apps.core.regionalisation import FiltreRegional, appliquer_filtre_regional


def _requete(user):
    return SimpleNamespace(user=user)


class PermissionsRoleTests(TestCase):
    """Chaque permission doit accepter exactement le(s) rôle(s) qu'elle prétend
    protéger, et refuser tout le reste — non authentifié, mauvais rôle, boîtier."""

    @classmethod
    def setUpTestData(cls):
        cls.admin = Administrateur(email='admin@test.sn', role=Administrateur.Role.ADMIN, region='dakar')
        cls.super_admin = Administrateur(email='super@test.sn', role=Administrateur.Role.SUPER_ADMIN)
        cls.anaser = Administrateur(email='anaser@test.sn', role=Administrateur.Role.ANASER)
        cls.boitier = Boitier()
        cls.anonyme = SimpleNamespace(is_authenticated=False)

    def test_est_super_administrateur_accepte_super_admin_seulement(self):
        self.assertTrue(EstSuperAdministrateur().has_permission(_requete(self.super_admin), None))
        self.assertFalse(EstSuperAdministrateur().has_permission(_requete(self.admin), None))
        self.assertFalse(EstSuperAdministrateur().has_permission(_requete(self.anaser), None))
        self.assertFalse(EstSuperAdministrateur().has_permission(_requete(self.anonyme), None))

    def test_est_administrateur_regional_accepte_admin_seulement(self):
        self.assertTrue(EstAdministrateurRegional().has_permission(_requete(self.admin), None))
        self.assertFalse(EstAdministrateurRegional().has_permission(_requete(self.super_admin), None))
        self.assertFalse(EstAdministrateurRegional().has_permission(_requete(self.anaser), None))

    def test_est_administrateur_accepte_admin_regional_et_super_admin(self):
        self.assertTrue(EstAdministrateur().has_permission(_requete(self.admin), None))
        self.assertTrue(EstAdministrateur().has_permission(_requete(self.super_admin), None))
        self.assertFalse(EstAdministrateur().has_permission(_requete(self.anaser), None))
        self.assertFalse(EstAdministrateur().has_permission(_requete(self.anonyme), None))
        self.assertFalse(EstAdministrateur().has_permission(_requete(None), None))

    def test_est_anaser_accepte_anaser_seulement(self):
        self.assertTrue(EstAnaser().has_permission(_requete(self.anaser), None))
        self.assertFalse(EstAnaser().has_permission(_requete(self.admin), None))
        self.assertFalse(EstAnaser().has_permission(_requete(self.anonyme), None))

    def test_est_admin_ou_anaser_accepte_les_trois_roles(self):
        self.assertTrue(EstAdminOuAnaser().has_permission(_requete(self.admin), None))
        self.assertTrue(EstAdminOuAnaser().has_permission(_requete(self.super_admin), None))
        self.assertTrue(EstAdminOuAnaser().has_permission(_requete(self.anaser), None))
        self.assertFalse(EstAdminOuAnaser().has_permission(_requete(self.anonyme), None))

    def test_est_boitier_accepte_uniquement_une_instance_boitier(self):
        self.assertTrue(EstBoitier().has_permission(_requete(self.boitier), None))
        self.assertFalse(EstBoitier().has_permission(_requete(self.admin), None))
        self.assertFalse(EstBoitier().has_permission(_requete(self.anonyme), None))


class FiltreRegionalTests(TestCase):
    """Mécanisme réutilisable de restriction par région (voir
    apps/core/regionalisation.py). Testé directement contre Boitier (déjà doté d'un champ
    `region`, étape 2) SANS toucher à BoitierViewSet — ce mécanisme n'est pas encore
    branché sur un ViewSet à cette étape, seulement préparé."""

    @classmethod
    def setUpTestData(cls):
        cls.boitier_dakar = Boitier.objects.create(region='dakar')
        cls.boitier_thies = Boitier.objects.create(region='thies')
        cls.boitier_sans_region = Boitier.objects.create(region=None)

        cls.super_admin = Administrateur(email='super@test.sn', role=Administrateur.Role.SUPER_ADMIN, region=None)
        cls.admin_dakar = Administrateur(email='admin-dakar@test.sn', role=Administrateur.Role.ADMIN, region='dakar')
        cls.admin_sans_region = Administrateur(email='admin-nr@test.sn', role=Administrateur.Role.ADMIN, region=None)
        cls.anaser = Administrateur(email='anaser@test.sn', role=Administrateur.Role.ANASER, region=None)

    # --- Super Admin ---

    def test_super_admin_obtient_le_queryset_complet(self):
        resultat = appliquer_filtre_regional(Boitier.objects.all(), self.super_admin)
        self.assertEqual(
            set(resultat.values_list('id', flat=True)),
            {self.boitier_dakar.id, self.boitier_thies.id, self.boitier_sans_region.id},
        )

    def test_super_admin_avec_region_nulle_reste_national(self):
        self.assertIsNone(self.super_admin.region)
        resultat = appliquer_filtre_regional(Boitier.objects.all(), self.super_admin)
        self.assertEqual(resultat.count(), 3)

    # --- Administrateur régional ---

    def test_administrateur_regional_ne_voit_que_sa_region(self):
        resultat = appliquer_filtre_regional(Boitier.objects.all(), self.admin_dakar)
        self.assertEqual(list(resultat), [self.boitier_dakar])

    def test_administrateur_regional_n_est_jamais_traite_comme_national(self):
        resultat = appliquer_filtre_regional(Boitier.objects.all(), self.admin_dakar)
        self.assertNotIn(self.boitier_thies, resultat)
        self.assertNotIn(self.boitier_sans_region, resultat)
        self.assertNotEqual(resultat.count(), Boitier.objects.count())

    def test_le_champ_de_filtrage_est_configurable(self):
        # Un futur modèle sans champ `region` direct pourra passer un autre lookup
        # (ex. 'boitier__region') — vérifié ici avec le champ direct de Boitier.
        resultat = appliquer_filtre_regional(Boitier.objects.all(), self.admin_dakar, region_lookup_field='region')
        self.assertEqual(list(resultat), [self.boitier_dakar])

    # --- Cas incohérents ---

    def test_administrateur_regional_sans_region_obtient_un_queryset_vide(self):
        resultat = appliquer_filtre_regional(Boitier.objects.all(), self.admin_sans_region)
        self.assertEqual(resultat.count(), 0)
        # Jamais un accès national par défaut : explicitement pas égal au queryset complet.
        self.assertNotEqual(resultat.count(), Boitier.objects.count())

    # --- ANASER (comportement actuel conservé) ---

    def test_anaser_ne_subit_aucun_filtrage_regional(self):
        resultat = appliquer_filtre_regional(Boitier.objects.all(), self.anaser)
        self.assertEqual(resultat.count(), 3)


class FiltreRegionalBackendTests(TestCase):
    """Le backend DRF (FiltreRegional) délègue à appliquer_filtre_regional en lisant
    request.user — jamais une valeur fournie par le client (paramètre de requête, etc.),
    pour qu'un administrateur régional ne puisse pas élargir son accès en la falsifiant."""

    @classmethod
    def setUpTestData(cls):
        cls.boitier_dakar = Boitier.objects.create(region='dakar')
        cls.boitier_thies = Boitier.objects.create(region='thies')
        cls.admin_dakar = Administrateur(email='admin-dakar-b@test.sn', role=Administrateur.Role.ADMIN, region='dakar')

    def test_le_backend_utilise_request_user_region(self):
        vue = SimpleNamespace()
        requete = SimpleNamespace(user=self.admin_dakar, query_params={})
        resultat = FiltreRegional().filter_queryset(requete, Boitier.objects.all(), vue)
        self.assertEqual(list(resultat), [self.boitier_dakar])

    def test_une_region_fournie_par_le_client_est_ignoree(self):
        # ?region=thies ne doit jamais permettre à un admin de Dakar de voir les boîtiers
        # de Thiès — seul request.user.region compte, jamais une valeur du client.
        vue = SimpleNamespace()
        requete = SimpleNamespace(user=self.admin_dakar, query_params={'region': 'thies'})
        resultat = FiltreRegional().filter_queryset(requete, Boitier.objects.all(), vue)
        self.assertEqual(list(resultat), [self.boitier_dakar])
        self.assertNotIn(self.boitier_thies, resultat)

    def test_region_lookup_field_est_configurable_par_la_vue(self):
        vue = SimpleNamespace(region_lookup_field='region')
        requete = SimpleNamespace(user=self.admin_dakar, query_params={})
        resultat = FiltreRegional().filter_queryset(requete, Boitier.objects.all(), vue)
        self.assertEqual(list(resultat), [self.boitier_dakar])


class BoiteEnglobanteTests(TestCase):
    """Le pré-filtre géospatial doit englober largement le cercle réel (jamais le
    sous-évaluer, sous peine d'exclure à tort une zone candidate)."""

    def test_dakar_1km_couvre_un_point_a_500m(self):
        latitude, longitude = 14.6928, -17.4467
        delta_lat, delta_lon = boite_englobante(latitude, longitude, rayon_metres=1000)
        # ~500 m au nord : doit rester dans la boîte englobante d'un rayon de 1 km.
        self.assertLess(abs((latitude + 0.0045) - latitude), delta_lat)

    def test_delta_longitude_croit_pres_des_poles(self):
        # À latitude élevée, un même rayon en mètres correspond à un delta de longitude
        # plus grand (les méridiens se rapprochent) : la boîte doit s'élargir en longitude.
        _, delta_lon_equateur = boite_englobante(0, 0, rayon_metres=1000)
        _, delta_lon_haute_latitude = boite_englobante(60, 0, rayon_metres=1000)
        self.assertGreater(delta_lon_haute_latitude, delta_lon_equateur)


class RegionDepuisGpsTests(SimpleTestCase):
    """Région administrative déduite d'un point GPS à partir des contours officiels
    (apps/core/data/regions_senegal.geojson)."""

    def test_villes_dans_leur_region(self):
        villes = {
            (14.6928, -17.4467): 'dakar',        # Dakar Plateau
            (14.7167, -17.2667): 'dakar',        # Rufisque
            (14.7910, -16.9359): 'thies',
            (14.4167, -16.9667): 'thies',        # Mbour
            (14.8500, -15.8833): 'diourbel',     # Touba
            (16.0179, -16.4896): 'saint_louis',
            (14.1520, -16.0726): 'kaolack',
            (12.5833, -16.2719): 'ziguinchor',
            (12.5579, -12.1743): 'kedougou',
            (15.6559, -13.2554): 'matam',
            (13.7707, -13.6673): 'tambacounda',
        }
        for (latitude, longitude), region in villes.items():
            with self.subTest(region=region, latitude=latitude):
                self.assertEqual(region_depuis_gps(latitude, longitude), region)

    def test_hors_du_senegal_aucune_region(self):
        for latitude, longitude in [(13.4549, -16.5790), (14.5, -18.5), (18.0735, -15.9582)]:  # Banjul, océan, Nouakchott
            with self.subTest(latitude=latitude):
                self.assertIsNone(region_depuis_gps(latitude, longitude))

    def test_point_juste_hors_contour_rattache_a_la_region_la_plus_proche(self):
        # Dans la baie de Hann, juste hors du contour officiel de Dakar (imprécision GPS / tracé).
        latitude, longitude = 14.6720, -17.4028
        polygones_dakar = next(p for slug, _, p in _contours_regions() if slug == 'dakar')
        self.assertFalse(any(_dans_polygone(longitude, latitude, p) for p in polygones_dakar))
        self.assertEqual(region_depuis_gps(latitude, longitude), 'dakar')
        self.assertIsNone(region_depuis_gps(14.60, -17.60))  # ~15 km au large : hors tolérance

    def test_coordonnees_absentes(self):
        self.assertIsNone(region_depuis_gps(None, -17.44))
