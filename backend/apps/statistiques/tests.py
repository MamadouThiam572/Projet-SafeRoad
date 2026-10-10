from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.boitiers.models import Boitier
from apps.comptes.models import Administrateur
from apps.conducteurs.models import Conducteur
from apps.incidents.models import Incident
from apps.signalements.models import Signalement
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


class TableauDeBordTests(TestCase):
    """Indicateurs calculés en direct : périmètre régional pour l'admin, national (avec détail
    par région) pour le super admin et l'ANASER, résumé personnel pour le conducteur."""

    @classmethod
    def setUpTestData(cls):
        cls.super_admin = Administrateur.objects.create_user(
            email='super-tdb@test.sn', password='x', nom='Fall', prenom='Aida', role=Administrateur.Role.SUPER_ADMIN,
        )
        cls.admin_dakar = Administrateur.objects.create_user(
            email='dakar-tdb@test.sn', password='x', nom='Diop', prenom='Cheikh',
            role=Administrateur.Role.ADMIN, region='dakar',
        )
        cls.anaser = Administrateur.objects.create_user(
            email='anaser-tdb@test.sn', password='x', nom='Diallo', prenom='Assane', role=Administrateur.Role.ANASER,
        )
        maintenant = timezone.now()
        cls.boitier_dakar = Boitier.objects.create(region='dakar', derniere_localisation_maj=maintenant)
        cls.boitier_thies = Boitier.objects.create(
            region='thies', derniere_localisation_maj=maintenant - timedelta(hours=2),
        )
        cls.conducteur = Conducteur.objects.create_user(
            email='awa-tdb@test.sn', password='x', nom='Ba', prenom='Awa', boitier=cls.boitier_dakar,
        )
        for gravite in ('critique', 'faible'):
            Incident.objects.create(
                boitier=cls.boitier_dakar, latitude=14.69, longitude=-17.44, horodatage=maintenant,
                type_incident='choc_violent', niveau_gravite=gravite,
            )
        Incident.objects.create(
            boitier=cls.boitier_thies, latitude=14.79, longitude=-16.93, horodatage=maintenant - timedelta(days=1),
            type_incident='freinage_brusque', niveau_gravite='moyen',
        )
        Signalement.objects.create(
            conducteur=cls.conducteur, type_danger='obstacle', latitude=14.69, longitude=-17.44, region='dakar',
        )
        cls.zone_soumise = Zone.objects.create(
            latitude_centre=14.79, longitude_centre=-16.93, rayon_metres=300, region='thies',
            statut_validation=Zone.StatutValidation.SOUMISE_ANASER,
        )
        cls.zone_proposee = Zone.objects.create(
            latitude_centre=14.69, longitude_centre=-17.44, rayon_metres=300, region='dakar',
        )

    def donnees(self, utilisateur, url='/api/v1/tableau-de-bord/'):
        client = APIClient()
        client.force_authenticate(user=utilisateur)
        reponse = client.get(url)
        self.assertEqual(reponse.status_code, 200, reponse.data)
        return reponse.data

    def test_admin_regional_ne_voit_que_sa_region(self):
        d = self.donnees(self.admin_dakar)
        self.assertEqual(d['perimetre']['region'], 'dakar')
        self.assertEqual(d['indicateurs']['incidents']['aujourd_hui'], 2)
        self.assertEqual(d['indicateurs']['incidents']['critiques'], 1)
        self.assertEqual(d['indicateurs']['boitiers'], {'total': 1, 'actifs': 1, 'en_ligne': 1, 'affectes': 1})
        self.assertEqual(d['indicateurs']['signalements']['en_attente'], 1)
        self.assertEqual([z['id'] for z in d['zones_a_valider']], [self.zone_proposee.id])
        self.assertNotIn('par_region', d)

    def test_admin_regional_ne_peut_pas_choisir_une_autre_region(self):
        d = self.donnees(self.admin_dakar, '/api/v1/tableau-de-bord/?region=thies')
        self.assertEqual(d['perimetre']['region'], 'dakar')

    def test_super_admin_national_avec_detail_par_region(self):
        d = self.donnees(self.super_admin)
        self.assertTrue(d['perimetre']['national'])
        self.assertEqual(d['indicateurs']['incidents']['periode'], 3)
        self.assertEqual(d['indicateurs']['boitiers']['en_ligne'], 1)  # Thiès silencieux depuis 2 h
        regions = {r['region']: r for r in d['par_region']}
        self.assertEqual(len(regions), 14)
        self.assertEqual((regions['dakar']['incidents'], regions['thies']['incidents']), (2, 1))
        self.assertEqual(regions['thies']['boitiers_hors_ligne'], 1)
        self.assertTrue(regions['dakar']['admin_actif'])
        self.assertFalse(regions['thies']['admin_actif'])

    def test_super_admin_peut_filtrer_une_region(self):
        d = self.donnees(self.super_admin, '/api/v1/tableau-de-bord/?region=thies')
        self.assertEqual(d['indicateurs']['incidents']['periode'], 1)

    def test_anaser_voit_les_zones_qui_lui_sont_soumises(self):
        d = self.donnees(self.anaser)
        self.assertEqual([z['id'] for z in d['zones_a_valider']], [self.zone_soumise.id])

    def test_series_et_repartition(self):
        d = self.donnees(self.super_admin, '/api/v1/tableau-de-bord/?jours=7')
        self.assertEqual(len(d['series']), 7)
        self.assertEqual(d['series'][-1]['incidents'], 2)
        self.assertEqual(sum(j['incidents'] for j in d['series']), 3)
        repartition = {r['type']: r for r in d['repartition_incidents']}
        self.assertEqual(repartition['choc_violent']['nombre'], 2)
        self.assertAlmostEqual(repartition['choc_violent']['pourcentage'], 66.7)

    def test_activite_recente_triee(self):
        dates = [e['date'] for e in self.donnees(self.super_admin)['activite_recente']]
        self.assertEqual(dates, sorted(dates, reverse=True))

    def test_parametres_invalides(self):
        client = APIClient()
        client.force_authenticate(user=self.super_admin)
        self.assertEqual(client.get('/api/v1/tableau-de-bord/?jours=abc').status_code, 400)
        self.assertEqual(client.get('/api/v1/tableau-de-bord/?region=paris').status_code, 400)

    def test_tableau_de_bord_du_conducteur(self):
        d = self.donnees(self.conducteur, '/api/v1/conducteur/tableau-de-bord/')
        self.assertEqual(d['boitier']['id'], str(self.boitier_dakar.id))
        self.assertEqual(d['signalements'], {'total': 1, 'en_attente': 1, 'valides': 0})
        client = APIClient()
        client.force_authenticate(user=self.conducteur)
        self.assertEqual(client.get('/api/v1/tableau-de-bord/').status_code, 403)
