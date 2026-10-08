from django.test import TestCase
from rest_framework.test import APIClient

from apps.comptes.models import Administrateur
from apps.zones.models import Zone

from .models import StatistiquesQuotidiennes

URL_DASHBOARD = '/api/v1/statistiques/dashboard/'


class StatistiquesDashboardFiltrageRegionalTests(TestCase):
    """StatistiquesDashboardView doit appliquer le même filtrage régional que le reste de
    l'API (via appliquer_filtre_regional, region_lookup_field='zone__region') : un
    administrateur régional ne doit voir ni les agrégats nationaux (zone=None), ni les
    statistiques d'une autre région — jamais indirectement via cet endpoint."""

    @classmethod
    def setUpTestData(cls):
        cls.zone_dakar = Zone.objects.create(
            region='dakar', latitude_centre=14.6928, longitude_centre=-17.4467, rayon_metres=200,
        )
        cls.zone_thies = Zone.objects.create(
            region='thies', latitude_centre=14.7910, longitude_centre=-16.9256, rayon_metres=200,
        )

        cls.stat_globale = StatistiquesQuotidiennes.objects.create(
            date='2026-01-01', zone=None, type_incident=None, nombre_incidents=10,
        )
        cls.stat_dakar = StatistiquesQuotidiennes.objects.create(
            date='2026-01-01', zone=cls.zone_dakar, type_incident=None, nombre_incidents=6,
        )
        cls.stat_thies = StatistiquesQuotidiennes.objects.create(
            date='2026-01-01', zone=cls.zone_thies, type_incident=None, nombre_incidents=4,
        )

        cls.super_admin = Administrateur.objects.create_user(
            email='super-admin-stats@test.sn', password='x', nom='Ndao', prenom='Fatou',
            role=Administrateur.Role.SUPER_ADMIN,
        )
        cls.anaser = Administrateur.objects.create_user(
            email='anaser-stats@test.sn', password='x', nom='Sy', prenom='Ousmane',
            role=Administrateur.Role.ANASER,
        )
        cls.admin_dakar = Administrateur.objects.create_user(
            email='admin-dakar-stats@test.sn', password='x', nom='Fall', prenom='Awa',
            role=Administrateur.Role.ADMIN, region='dakar',
        )
        cls.admin_thies = Administrateur.objects.create_user(
            email='admin-thies-stats@test.sn', password='x', nom='Gaye', prenom='Ibra',
            role=Administrateur.Role.ADMIN, region='thies',
        )
        cls.admin_sans_region = Administrateur.objects.create_user(
            email='admin-nr-stats@test.sn', password='x', nom='Sow', prenom='Khady',
            role=Administrateur.Role.ADMIN,
        )

    def setUp(self):
        self.client = APIClient()

    def _ids(self, reponse):
        return {row['id'] for row in reponse.data}

    def test_super_admin_voit_toutes_les_statistiques(self):
        self.client.force_authenticate(user=self.super_admin)
        reponse = self.client.get(URL_DASHBOARD)
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(
            self._ids(reponse), {self.stat_globale.id, self.stat_dakar.id, self.stat_thies.id},
        )

    def test_anaser_conserve_l_acces_global(self):
        self.client.force_authenticate(user=self.anaser)
        reponse = self.client.get(URL_DASHBOARD)
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(
            self._ids(reponse), {self.stat_globale.id, self.stat_dakar.id, self.stat_thies.id},
        )

    def test_admin_dakar_ne_voit_que_les_statistiques_de_dakar(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.get(URL_DASHBOARD)
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(self._ids(reponse), {self.stat_dakar.id})

    def test_admin_dakar_n_obtient_jamais_l_agregat_national(self):
        # zone=None = agrégat toutes régions confondues : une fuite de portée nationale si
        # un administrateur régional pouvait le voir.
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.get(URL_DASHBOARD)
        self.assertNotIn(self.stat_globale.id, self._ids(reponse))

    def test_admin_thies_ne_voit_pas_les_statistiques_de_dakar(self):
        self.client.force_authenticate(user=self.admin_thies)
        reponse = self.client.get(URL_DASHBOARD)
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(self._ids(reponse), {self.stat_thies.id})
        self.assertNotIn(self.stat_dakar.id, self._ids(reponse))

    def test_admin_sans_region_obtient_une_liste_vide(self):
        # Comportement sûr et cohérent avec appliquer_filtre_regional ailleurs dans l'API :
        # jamais un accès national par défaut.
        self.client.force_authenticate(user=self.admin_sans_region)
        reponse = self.client.get(URL_DASHBOARD)
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data, [])

    def test_le_parametre_zone_ne_permet_pas_de_contourner_le_filtrage(self):
        # Un administrateur de Thiès ne doit pas pouvoir lire les stats de la zone de Dakar
        # en la ciblant explicitement par ?zone=.
        self.client.force_authenticate(user=self.admin_thies)
        reponse = self.client.get(URL_DASHBOARD, {'zone': self.zone_dakar.id})
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data, [])
