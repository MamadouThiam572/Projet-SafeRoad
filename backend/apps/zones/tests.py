from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.boitiers.models import Boitier
from apps.comptes.models import Administrateur
from apps.configuration.models import ConfigurationSysteme
from apps.incidents.models import Incident

from apps.signalements.models import Signalement

from .clustering import _niveau_danger, _region_majoritaire, generer_zones_depuis_incidents
from .models import Zone

# Un cluster serré autour de ce point (quelques dizaines de mètres d'écart, bien sous
# le rayon de clustering par défaut de 300 m).
LATITUDE_BASE, LONGITUDE_BASE = 14.6928, -17.4467


class NiveauDangerTests(TestCase):
    """Seuils de _niveau_danger — logique métier la plus directement visible par le
    public (couleur des zones sur la carte), verrouillée précisément sur ses bornes."""

    def test_sous_le_seuil_vigilance_est_normale(self):
        self.assertEqual(_niveau_danger(3), Zone.NiveauDanger.NORMALE)

    def test_juste_au_seuil_vigilance(self):
        self.assertEqual(_niveau_danger(4), Zone.NiveauDanger.VIGILANCE)

    def test_juste_sous_le_seuil_critique(self):
        self.assertEqual(_niveau_danger(14), Zone.NiveauDanger.VIGILANCE)

    def test_juste_au_seuil_critique(self):
        self.assertEqual(_niveau_danger(15), Zone.NiveauDanger.CRITIQUE)


class GenererZonesDepuisIncidentsTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.boitier = Boitier.objects.create()

    def _creer_incident(self, decalage, gravite=Incident.NiveauGravite.FAIBLE):
        return Incident.objects.create(
            boitier=self.boitier,
            latitude=LATITUDE_BASE + decalage,
            longitude=LONGITUDE_BASE + decalage,
            horodatage=timezone.now(),
            type_incident=Incident.TypeIncident.AUTRE,
            niveau_gravite=gravite,
        )

    def test_les_positions_gps_non_fiables_ne_comptent_pas_pour_une_zone(self):
        config = ConfigurationSysteme.instance()
        incidents = [self._creer_incident(decalage=0.0002 * i) for i in range(config.min_incidents_pour_zone)]
        Incident.objects.filter(pk=incidents[0].pk).update(position_fiable=False)

        resultat = generer_zones_depuis_incidents()

        self.assertEqual(resultat['zones_creees'], 0)
        self.assertEqual(Zone.objects.count(), 0)

    def _creer_signalement_valide(self, decalage):
        return Signalement.objects.create(
            type_danger='nid_de_poule', region='dakar', statut=Signalement.Statut.VALIDE,
            latitude=LATITUDE_BASE + decalage, longitude=LONGITUDE_BASE + decalage,
        )

    def test_les_signalements_seuls_ne_creent_jamais_de_zone(self):
        for i in range(10):
            self._creer_signalement_valide(decalage=0.0002 * (i % 3))
        self._creer_incident(decalage=0)  # un seul incident capteur : sous le minimum

        self.assertEqual(generer_zones_depuis_incidents()['zones_creees'], 0)

    def test_les_signalements_valides_renforcent_le_score_d_une_zone(self):
        for i in range(3):
            self._creer_incident(decalage=0.0002 * i)
        self._creer_signalement_valide(decalage=0.0001)
        self._creer_signalement_valide(decalage=0.0003)
        Signalement.objects.create(  # non validé : ne compte pas
            type_danger='obstacle', region='dakar', latitude=LATITUDE_BASE, longitude=LONGITUDE_BASE,
        )
        Signalement.objects.create(  # validé mais à ~2 km : hors du rayon
            type_danger='obstacle', region='dakar', statut=Signalement.Statut.VALIDE,
            latitude=LATITUDE_BASE + 0.018, longitude=LONGITUDE_BASE,
        )

        generer_zones_depuis_incidents()

        zone = Zone.objects.get()
        self.assertEqual((zone.nombre_incidents, zone.nombre_signalements), (3, 2))
        self.assertEqual(zone.score_danger, 3 + 0.5 * 2)  # poids par défaut 0,5
        self.assertEqual(zone.niveau_danger, Zone.NiveauDanger.VIGILANCE)

    def test_un_incident_rejete_comme_faux_positif_ne_compte_pas(self):
        config = ConfigurationSysteme.instance()
        incidents = [self._creer_incident(decalage=0.0002 * i) for i in range(config.min_incidents_pour_zone)]
        Incident.objects.filter(pk=incidents[0].pk).update(statut=Incident.Statut.REJETE)

        self.assertEqual(generer_zones_depuis_incidents()['zones_creees'], 0)

    def test_sous_le_minimum_ne_cree_aucune_zone(self):
        config = ConfigurationSysteme.instance()
        for i in range(config.min_incidents_pour_zone - 1):
            self._creer_incident(decalage=0.0002 * i)

        resultat = generer_zones_depuis_incidents()

        self.assertEqual(resultat['zones_creees'], 0)
        self.assertEqual(Zone.objects.count(), 0)

    def test_cluster_dense_cree_une_zone_normale(self):
        for i in range(3):
            self._creer_incident(decalage=0.0002 * i)

        resultat = generer_zones_depuis_incidents()

        self.assertEqual(resultat['zones_creees'], 1)
        zone = Zone.objects.get()
        self.assertEqual(zone.nombre_incidents, 3)
        self.assertEqual(zone.niveau_danger, Zone.NiveauDanger.NORMALE)
        self.assertEqual(zone.statut_validation, Zone.StatutValidation.PROPOSEE)

    def test_cluster_avec_incidents_critiques_devient_critique(self):
        # score = nombre_incidents + 2*nombre_critiques ; viser >= 15.
        for i in range(5):
            self._creer_incident(decalage=0.0002 * i, gravite=Incident.NiveauGravite.CRITIQUE)

        generer_zones_depuis_incidents()

        zone = Zone.objects.get()
        self.assertEqual(zone.score_danger, 5 + 2 * 5)
        self.assertEqual(zone.niveau_danger, Zone.NiveauDanger.CRITIQUE)

    def test_un_deuxieme_passage_met_a_jour_la_zone_existante_sans_la_dupliquer(self):
        for i in range(3):
            self._creer_incident(decalage=0.0002 * i)
        generer_zones_depuis_incidents()
        self.assertEqual(Zone.objects.count(), 1)

        # Un nouvel incident dans le même cluster : le reclustering doit mettre à jour
        # la zone existante (statut_validation préservé), pas en créer une seconde.
        self._creer_incident(decalage=0.0002)
        resultat = generer_zones_depuis_incidents()

        self.assertEqual(resultat['zones_creees'], 0)
        self.assertEqual(resultat['zones_mises_a_jour'], 1)
        self.assertEqual(Zone.objects.count(), 1)
        self.assertEqual(Zone.objects.get().nombre_incidents, 4)

    def test_validation_manuelle_survit_au_reclustering(self):
        for i in range(3):
            self._creer_incident(decalage=0.0002 * i)
        generer_zones_depuis_incidents()
        zone = Zone.objects.get()
        zone.statut_validation = Zone.StatutValidation.RECONNUE
        zone.save(update_fields=['statut_validation'])

        self._creer_incident(decalage=0.0002)
        generer_zones_depuis_incidents()

        zone.refresh_from_db()
        self.assertEqual(zone.statut_validation, Zone.StatutValidation.RECONNUE)


class RegionMajoritaireTests(TestCase):
    """`_region_majoritaire` — étape 4D : la région d'une zone se déduit APRÈS le
    clustering (qui reste national), à partir des boîtiers des incidents contributeurs.
    Testée en isolation avec de faux incidents (juste un `.boitier.region`)."""

    class _FauxIncident:
        def __init__(self, region):
            self.boitier = type('FauxBoitier', (), {'region': region})()

    def test_une_region_unanime_est_retenue(self):
        incidents = [self._FauxIncident('dakar'), self._FauxIncident('dakar'), self._FauxIncident('dakar')]
        self.assertEqual(_region_majoritaire(incidents, 0, 0), 'dakar')

    def test_une_region_strictement_majoritaire_est_retenue(self):
        incidents = [self._FauxIncident('dakar'), self._FauxIncident('dakar'), self._FauxIncident('thies')]
        self.assertEqual(_region_majoritaire(incidents, 0, 0), 'dakar')

    def test_egalite_stricte_ne_choisit_aucune_region(self):
        # Comportement sûr explicite : pas de région devinée en cas d'égalité.
        incidents = [self._FauxIncident('dakar'), self._FauxIncident('thies')]
        self.assertIsNone(_region_majoritaire(incidents, 0, 0))

    def test_egalite_stricte_est_signalee_dans_les_logs(self):
        incidents = [self._FauxIncident('dakar'), self._FauxIncident('thies')]
        with self.assertLogs('apps.zones.clustering', level='WARNING') as journal:
            _region_majoritaire(incidents, 14.69, -17.44)
        self.assertTrue(any('majoritaire' in message for message in journal.output))

    def test_incidents_sans_boitier_regionalise_sont_ignores(self):
        incidents = [self._FauxIncident(None), self._FauxIncident(None), self._FauxIncident('dakar')]
        self.assertEqual(_region_majoritaire(incidents, 0, 0), 'dakar')

    def test_aucun_boitier_regionalise_ne_choisit_aucune_region(self):
        incidents = [self._FauxIncident(None), self._FauxIncident(None)]
        with self.assertLogs('apps.zones.clustering', level='WARNING'):
            resultat = _region_majoritaire(incidents, 0, 0)
        self.assertIsNone(resultat)


class GenererZonesDepuisIncidentsRegionTests(TestCase):
    """Intégration bout en bout : la région se retrouve bien sur la Zone créée/mise à jour
    par le clustering réel (toujours national — voir generer_zones_depuis_incidents)."""

    def _creer_incident(self, boitier, decalage):
        return Incident.objects.create(
            boitier=boitier, latitude=LATITUDE_BASE + decalage, longitude=LONGITUDE_BASE + decalage,
            horodatage=timezone.now(), type_incident=Incident.TypeIncident.AUTRE,
        )

    def test_zone_recoit_la_region_majoritaire_de_ses_boitiers_contributeurs(self):
        boitier_dakar = Boitier.objects.create(region='dakar')
        for i in range(3):
            self._creer_incident(boitier_dakar, decalage=0.0002 * i)

        generer_zones_depuis_incidents()

        self.assertEqual(Zone.objects.get().region, 'dakar')

    def test_zone_sans_region_majoritaire_claire_reste_a_null(self):
        # 2 incidents Dakar + 2 incidents Thiès dans le même cluster géographique : égalité
        # stricte, aucune région ne doit être devinée (voir RegionMajoritaireTests).
        boitier_dakar = Boitier.objects.create(region='dakar')
        boitier_thies = Boitier.objects.create(region='thies')
        self._creer_incident(boitier_dakar, decalage=0.0000)
        self._creer_incident(boitier_dakar, decalage=0.0001)
        self._creer_incident(boitier_thies, decalage=0.0002)
        self._creer_incident(boitier_thies, decalage=0.0003)

        generer_zones_depuis_incidents()

        self.assertIsNone(Zone.objects.get().region)

    def test_region_est_recalculee_a_chaque_reclustering(self):
        boitier_dakar = Boitier.objects.create(region='dakar')
        for i in range(3):
            self._creer_incident(boitier_dakar, decalage=0.0002 * i)
        generer_zones_depuis_incidents()
        self.assertEqual(Zone.objects.get().region, 'dakar')

        # De nouveaux incidents d'un boîtier de Thiès dans le même cluster géographique
        # font basculer la majorité (4 Thiès > 3 Dakar) — la région n'est jamais figée
        # après une première passe, recalculée à chaque reclustering.
        boitier_thies = Boitier.objects.create(region='thies')
        for i in range(4):
            self._creer_incident(boitier_thies, decalage=0.0002 + 0.00001 * i)
        generer_zones_depuis_incidents()

        self.assertEqual(Zone.objects.get().region, 'thies')


class ZoneFiltrageRegionalTests(TestCase):
    """Étape 4D : ZoneViewSet applique FiltreRegional en plus du filtre public existant
    (validé+actif pour un visiteur non privilégié) — les deux se composent."""

    @classmethod
    def setUpTestData(cls):
        cls.super_admin = Administrateur.objects.create_user(
            email='super-admin-zones@test.sn', password='x', nom='Fall', prenom='Aida',
            role=Administrateur.Role.SUPER_ADMIN,
        )
        cls.admin_dakar = Administrateur.objects.create_user(
            email='admin-dakar-zones@test.sn', password='x', nom='Diop', prenom='Cheikh',
            role=Administrateur.Role.ADMIN, region='dakar',
        )
        cls.admin_sans_region = Administrateur.objects.create_user(
            email='admin-sr-zones@test.sn', password='x', nom='Wade', prenom='Fatoumata',
            role=Administrateur.Role.ADMIN, region=None,
        )
        cls.anaser = Administrateur.objects.create_user(
            email='anaser-zones@test.sn', password='x', nom='Diallo', prenom='Assane',
            role=Administrateur.Role.ANASER,
        )

        cls.zone_dakar = Zone.objects.create(
            latitude_centre=LATITUDE_BASE, longitude_centre=LONGITUDE_BASE, rayon_metres=300,
            region='dakar', statut_validation=Zone.StatutValidation.RECONNUE, actif=True,
        )
        cls.zone_thies = Zone.objects.create(
            latitude_centre=LATITUDE_BASE + 1, longitude_centre=LONGITUDE_BASE + 1, rayon_metres=300,
            region='thies', statut_validation=Zone.StatutValidation.RECONNUE, actif=True,
        )

    def setUp(self):
        self.client = APIClient()

    def test_super_admin_voit_toutes_les_zones(self):
        self.client.force_authenticate(user=self.super_admin)
        reponse = self.client.get('/api/v1/zones/')
        self.assertEqual(reponse.status_code, 200)
        ids = {z['id'] for z in reponse.data}
        self.assertEqual(ids, {self.zone_dakar.id, self.zone_thies.id})

    def test_admin_regional_ne_voit_que_les_zones_de_sa_region(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.get('/api/v1/zones/')
        self.assertEqual(reponse.status_code, 200)
        ids = {z['id'] for z in reponse.data}
        self.assertEqual(ids, {self.zone_dakar.id})

    def test_admin_regional_ne_peut_pas_recuperer_une_zone_d_une_autre_region(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.get(f'/api/v1/zones/{self.zone_thies.id}/')
        self.assertEqual(reponse.status_code, 404)

    def test_admin_regional_ne_peut_pas_valider_une_zone_d_une_autre_region(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.patch(
            f'/api/v1/zones/{self.zone_thies.id}/statut/', {'statut_validation': 'validee_technique'}, format='json',
        )
        self.assertEqual(reponse.status_code, 404)

    def test_admin_regional_sans_region_ne_voit_aucune_zone(self):
        self.client.force_authenticate(user=self.admin_sans_region)
        reponse = self.client.get('/api/v1/zones/')
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data, [])

    def test_un_parametre_region_dans_l_url_est_ignore(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.get('/api/v1/zones/?region=thies')
        self.assertEqual(reponse.status_code, 200)
        ids = {z['id'] for z in reponse.data}
        self.assertEqual(ids, {self.zone_dakar.id})

    def test_anaser_conserve_un_acces_national_sans_filtrage_regional(self):
        self.client.force_authenticate(user=self.anaser)
        reponse = self.client.get('/api/v1/zones/')
        self.assertEqual(reponse.status_code, 200)
        ids = {z['id'] for z in reponse.data}
        self.assertEqual(ids, {self.zone_dakar.id, self.zone_thies.id})

    def test_public_voit_toutes_les_regions_sans_filtrage_regional(self):
        # Comportement inchangé pour le visiteur non authentifié : filtré par
        # validation/actif (déjà existant), jamais par région.
        reponse = self.client.get('/api/v1/zones/')
        self.assertEqual(reponse.status_code, 200)
        ids = {z['id'] for z in reponse.data}
        self.assertEqual(ids, {self.zone_dakar.id, self.zone_thies.id})


class ZoneGestionSuperAdminTests(TestCase):
    """Le super administrateur doit voir et pouvoir valider une zone en attente (il ne la
    voyait pas : seuls admin/anaser étaient exemptés du filtre public). Le recalcul national
    des zones lui est réservé."""

    @classmethod
    def setUpTestData(cls):
        cls.super_admin = Administrateur.objects.create_user(
            email='super-admin-attente@test.sn', password='x', nom='Fall', prenom='Aida',
            role=Administrateur.Role.SUPER_ADMIN,
        )
        cls.admin_dakar = Administrateur.objects.create_user(
            email='admin-dakar-attente@test.sn', password='x', nom='Diop', prenom='Cheikh',
            role=Administrateur.Role.ADMIN, region='dakar',
        )
        cls.zone_en_attente = Zone.objects.create(
            latitude_centre=LATITUDE_BASE, longitude_centre=LONGITUDE_BASE, rayon_metres=300, region='dakar',
        )

    def setUp(self):
        self.client = APIClient()

    def test_super_admin_voit_une_zone_en_attente(self):
        self.client.force_authenticate(user=self.super_admin)
        reponse = self.client.get('/api/v1/zones/')
        self.assertEqual(reponse.status_code, 200)
        self.assertIn(self.zone_en_attente.id, {z['id'] for z in reponse.data})

    def test_super_admin_peut_valider_techniquement_une_zone_en_attente(self):
        self.client.force_authenticate(user=self.super_admin)
        reponse = self.client.patch(
            f'/api/v1/zones/{self.zone_en_attente.id}/statut/', {'statut_validation': 'validee_technique'},
            format='json',
        )
        self.assertEqual(reponse.status_code, 200)
        self.zone_en_attente.refresh_from_db()
        self.assertEqual(self.zone_en_attente.statut_validation, Zone.StatutValidation.VALIDEE_TECHNIQUEMENT)

    def test_admin_regional_ne_peut_pas_lancer_le_recalcul_national(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.post('/api/v1/zones/generer/')
        self.assertEqual(reponse.status_code, 403)

    def test_super_admin_peut_lancer_le_recalcul_national(self):
        self.client.force_authenticate(user=self.super_admin)
        reponse = self.client.post('/api/v1/zones/generer/')
        self.assertEqual(reponse.status_code, 200)


class WorkflowValidationZoneTests(TestCase):
    """Validation en deux étapes : technique (admin régional / super admin), puis
    institutionnelle (ANASER). Chaque décision est tracée dans HistoriqueStatutZone."""

    @classmethod
    def setUpTestData(cls):
        cls.super_admin = Administrateur.objects.create_user(
            email='super-workflow@test.sn', password='x', nom='Fall', prenom='Aida',
            role=Administrateur.Role.SUPER_ADMIN,
        )
        cls.admin_dakar = Administrateur.objects.create_user(
            email='dakar-workflow@test.sn', password='x', nom='Diop', prenom='Cheikh',
            role=Administrateur.Role.ADMIN, region='dakar',
        )
        cls.anaser = Administrateur.objects.create_user(
            email='anaser-workflow@test.sn', password='x', nom='Diallo', prenom='Assane',
            role=Administrateur.Role.ANASER,
        )

    def setUp(self):
        self.zone = Zone.objects.create(
            latitude_centre=LATITUDE_BASE, longitude_centre=LONGITUDE_BASE, rayon_metres=300, region='dakar',
        )

    def changer(self, utilisateur, statut, commentaire=''):
        client = APIClient()
        client.force_authenticate(user=utilisateur)
        return client.patch(
            f'/api/v1/zones/{self.zone.id}/statut/',
            {'statut_validation': statut, 'commentaire': commentaire}, format='json',
        )

    def amener_jusqu_a_anaser(self):
        for statut in ('en_verification', 'validee_technique', 'soumise_anaser'):
            self.assertEqual(self.changer(self.admin_dakar, statut).status_code, 200)

    def test_parcours_complet_jusqu_a_la_publication(self):
        public = APIClient()
        self.amener_jusqu_a_anaser()
        self.assertNotIn(self.zone.id, {z['id'] for z in public.get('/api/v1/zones/').data})

        self.assertEqual(self.changer(self.anaser, 'reconnue').status_code, 200)
        self.assertIn(self.zone.id, {z['id'] for z in public.get('/api/v1/zones/').data})

    def test_l_historique_trace_chaque_decision(self):
        self.amener_jusqu_a_anaser()
        self.changer(self.anaser, 'reconnue')
        client = APIClient()
        client.force_authenticate(user=self.super_admin)
        historique = client.get(f'/api/v1/zones/{self.zone.id}/historique/').data
        self.assertEqual(
            [(h['statut_nouveau'], h['role_acteur']) for h in historique],
            [('en_verification', 'admin'), ('validee_technique', 'admin'),
             ('soumise_anaser', 'admin'), ('reconnue', 'anaser')],
        )
        self.assertEqual(historique[-1]['acteur'], self.anaser.id)

    def test_anaser_ne_peut_pas_faire_la_validation_technique(self):
        self.assertEqual(self.changer(self.anaser, 'validee_technique').status_code, 403)

    def test_seul_l_anaser_peut_reconnaitre_une_zone(self):
        self.amener_jusqu_a_anaser()
        self.assertEqual(self.changer(self.admin_dakar, 'reconnue').status_code, 403)
        self.assertEqual(self.changer(self.super_admin, 'reconnue').status_code, 403)

    def test_on_ne_peut_pas_sauter_l_etape_technique(self):
        reponse = self.changer(self.anaser, 'reconnue')
        self.assertEqual(reponse.status_code, 400)
        self.zone.refresh_from_db()
        self.assertEqual(self.zone.statut_validation, Zone.StatutValidation.PROPOSEE)

    def test_un_rejet_doit_etre_motive(self):
        self.assertEqual(self.changer(self.admin_dakar, 'rejetee').status_code, 400)
        self.assertEqual(self.changer(self.admin_dakar, 'rejetee', 'Doublon de la zone voisine').status_code, 200)

    def test_anaser_peut_demander_un_complement_motive(self):
        self.amener_jusqu_a_anaser()
        self.assertEqual(self.changer(self.anaser, 'en_verification').status_code, 400)
        reponse = self.changer(self.anaser, 'en_verification', 'Préciser les observations terrain')
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data['statut_validation'], 'en_verification')

    def test_seul_le_super_admin_archive(self):
        self.changer(self.admin_dakar, 'rejetee', 'Données incohérentes')
        self.assertEqual(self.changer(self.admin_dakar, 'archivee').status_code, 403)
        self.assertEqual(self.changer(self.super_admin, 'archivee').status_code, 200)

    def test_statut_inconnu_refuse(self):
        self.assertEqual(self.changer(self.admin_dakar, 'validee').status_code, 400)
