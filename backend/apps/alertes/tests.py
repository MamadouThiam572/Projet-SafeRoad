from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.boitiers.models import Boitier
from apps.comptes.models import Administrateur
from apps.incidents.models import Incident
from apps.zones.models import Zone

from .models import Alerte, AlerteProximite

LATITUDE_BASE, LONGITUDE_BASE = 14.6928, -17.4467


def creer_incident_critique(boitier, **kwargs):
    donnees = {
        'boitier': boitier,
        'latitude': LATITUDE_BASE,
        'longitude': LONGITUDE_BASE,
        'horodatage': timezone.now(),
        'type_incident': Incident.TypeIncident.COLLISION,
        'niveau_gravite': Incident.NiveauGravite.CRITIQUE,
    }
    donnees.update(kwargs)
    # Le signal post_save (apps/alertes/signals.py) crée l'Alerte automatiquement.
    return Incident.objects.create(**donnees)


class AlerteFiltrageRegionalTests(TestCase):
    """Étape 4C : AlerteViewSet applique FiltreRegional via `incident__boitier__region` —
    la région d'une alerte se déduit de son incident, lui-même déduit de son boîtier
    (étape 4B). Aucun champ `region` propre ajouté à Alerte."""

    @classmethod
    def setUpTestData(cls):
        cls.super_admin = Administrateur.objects.create_user(
            email='super-admin-alertes@test.sn', password='x', nom='Diouf', prenom='Modou',
            role=Administrateur.Role.SUPER_ADMIN,
        )
        cls.admin_dakar = Administrateur.objects.create_user(
            email='admin-dakar-alertes@test.sn', password='x', nom='Sy', prenom='Astou',
            role=Administrateur.Role.ADMIN, region='dakar',
        )
        cls.admin_sans_region = Administrateur.objects.create_user(
            email='admin-sr-alertes@test.sn', password='x', nom='Camara', prenom='Lamine',
            role=Administrateur.Role.ADMIN, region=None,
        )
        cls.anaser = Administrateur.objects.create_user(
            email='anaser-alertes@test.sn', password='x', nom='Mbaye', prenom='Rokhaya',
            role=Administrateur.Role.ANASER,
        )

        cls.boitier_dakar = Boitier.objects.create(region='dakar', numero_immatriculation='DK-0001')
        cls.boitier_thies = Boitier.objects.create(region='thies', numero_immatriculation='TH-0001')

        cls.incident_dakar = creer_incident_critique(cls.boitier_dakar)
        cls.incident_thies = creer_incident_critique(cls.boitier_thies)
        cls.alerte_dakar = cls.incident_dakar.alerte
        cls.alerte_thies = cls.incident_thies.alerte

    def setUp(self):
        self.client = APIClient()

    # --- A. Alerte classique ---

    def test_super_admin_voit_toutes_les_alertes(self):
        self.client.force_authenticate(user=self.super_admin)
        reponse = self.client.get('/api/v1/alertes/')
        self.assertEqual(reponse.status_code, 200)
        ids = {a['id'] for a in reponse.data}
        self.assertEqual(ids, {self.alerte_dakar.id, self.alerte_thies.id})

    def test_admin_regional_ne_voit_que_les_alertes_de_sa_region(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.get('/api/v1/alertes/')
        self.assertEqual(reponse.status_code, 200)
        ids = {a['id'] for a in reponse.data}
        self.assertEqual(ids, {self.alerte_dakar.id})

    def test_admin_regional_ne_peut_pas_recuperer_une_alerte_d_une_autre_region(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.get(f'/api/v1/alertes/{self.alerte_thies.id}/')
        self.assertEqual(reponse.status_code, 404)

    def test_admin_regional_peut_recuperer_une_alerte_de_sa_propre_region(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.get(f'/api/v1/alertes/{self.alerte_dakar.id}/')
        self.assertEqual(reponse.status_code, 200)

    def test_admin_regional_sans_region_ne_voit_aucune_alerte(self):
        self.client.force_authenticate(user=self.admin_sans_region)
        reponse = self.client.get('/api/v1/alertes/')
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data, [])

    def test_un_parametre_region_dans_l_url_est_ignore(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.get('/api/v1/alertes/?region=thies')
        self.assertEqual(reponse.status_code, 200)
        ids = {a['id'] for a in reponse.data}
        self.assertEqual(ids, {self.alerte_dakar.id})

    def test_anaser_n_a_toujours_pas_acces_aux_alertes(self):
        # Comportement actuel inchangé : AlerteViewSet utilise EstAdministrateur, pas
        # EstAdminOuAnaser — ANASER n'y a jamais eu accès, avant comme après cette étape.
        self.client.force_authenticate(user=self.anaser)
        reponse = self.client.get('/api/v1/alertes/')
        self.assertEqual(reponse.status_code, 403)

    # --- B. Action de traitement ---

    def test_admin_regional_peut_traiter_une_alerte_de_sa_region(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.patch(f'/api/v1/alertes/{self.alerte_dakar.id}/traiter/', {'statut': 'traitee'}, format='json')
        self.assertEqual(reponse.status_code, 200)
        self.alerte_dakar.refresh_from_db()
        self.assertEqual(self.alerte_dakar.statut, 'traitee')
        self.assertEqual(self.alerte_dakar.traitee_par_id, self.admin_dakar.id)
        self.assertIsNotNone(self.alerte_dakar.traitee_le)

    def test_admin_regional_ne_peut_pas_traiter_une_alerte_d_une_autre_region(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.patch(f'/api/v1/alertes/{self.alerte_thies.id}/traiter/', {'statut': 'traitee'}, format='json')
        self.assertEqual(reponse.status_code, 404)
        self.alerte_thies.refresh_from_db()
        self.assertEqual(self.alerte_thies.statut, 'nouvelle')  # inchangée
        self.assertIsNone(self.alerte_thies.traitee_par)

    def test_traiter_refuse_un_statut_inconnu(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.patch(f'/api/v1/alertes/{self.alerte_dakar.id}/traiter/', {'statut': 'xyz'}, format='json')
        self.assertEqual(reponse.status_code, 400)
        self.alerte_dakar.refresh_from_db()
        self.assertEqual(self.alerte_dakar.statut, 'nouvelle')

    # --- D. Création : aucune voie humaine/API n'existe ---

    def test_aucune_action_de_creation_n_existe_pour_les_alertes(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.post('/api/v1/alertes/', {'incident': self.incident_thies.id}, format='json')
        self.assertEqual(reponse.status_code, 405)

    def test_une_alerte_est_creee_automatiquement_par_le_signal_sur_incident_critique(self):
        # apps/alertes/signals.py : la seule voie de création réelle, déclenchée par
        # Incident.save() (lui-même remonté par un boîtier, jamais par un humain — étape 4B).
        boitier = Boitier.objects.create(region='kolda')
        incident = creer_incident_critique(boitier)
        self.assertTrue(Alerte.objects.filter(incident=incident).exists())

    def test_aucune_alerte_creee_pour_un_incident_non_critique(self):
        boitier = Boitier.objects.create(region='kolda')
        incident = creer_incident_critique(boitier, niveau_gravite=Incident.NiveauGravite.FAIBLE)
        self.assertFalse(Alerte.objects.filter(incident=incident).exists())


class AlerteProximiteFiltrageRegionalTests(TestCase):
    """AlerteProximite : région dérivée de `boitier__region` (FK directe vérifiée par
    audit — Zone n'est volontairement pas touchée à cette étape)."""

    @classmethod
    def setUpTestData(cls):
        cls.super_admin = Administrateur.objects.create_user(
            email='super-admin-ap@test.sn', password='x', nom='Sarr', prenom='Ndeye',
            role=Administrateur.Role.SUPER_ADMIN,
        )
        cls.admin_dakar = Administrateur.objects.create_user(
            email='admin-dakar-ap@test.sn', password='x', nom='Thiam', prenom='Oumar',
            role=Administrateur.Role.ADMIN, region='dakar',
        )
        cls.admin_sans_region = Administrateur.objects.create_user(
            email='admin-sr-ap@test.sn', password='x', nom='Ba', prenom='Khady',
            role=Administrateur.Role.ADMIN, region=None,
        )
        cls.anaser = Administrateur.objects.create_user(
            email='anaser-ap@test.sn', password='x', nom='Diallo', prenom='Serigne',
            role=Administrateur.Role.ANASER,
        )

        cls.boitier_dakar = Boitier.objects.create(region='dakar')
        cls.boitier_thies = Boitier.objects.create(region='thies')
        cls.zone = Zone.objects.create(latitude_centre=LATITUDE_BASE, longitude_centre=LONGITUDE_BASE, rayon_metres=500)

        cls.ap_dakar = AlerteProximite.objects.create(
            boitier=cls.boitier_dakar, zone=cls.zone, distance_metres=120,
            latitude=LATITUDE_BASE, longitude=LONGITUDE_BASE,
        )
        cls.ap_thies = AlerteProximite.objects.create(
            boitier=cls.boitier_thies, zone=cls.zone, distance_metres=80,
            latitude=LATITUDE_BASE, longitude=LONGITUDE_BASE,
        )

    def setUp(self):
        self.client = APIClient()

    def test_super_admin_voit_toutes_les_alertes_de_proximite(self):
        self.client.force_authenticate(user=self.super_admin)
        reponse = self.client.get('/api/v1/alertes-proximite/')
        self.assertEqual(reponse.status_code, 200)
        ids = {a['id'] for a in reponse.data}
        self.assertEqual(ids, {self.ap_dakar.id, self.ap_thies.id})

    def test_admin_regional_ne_voit_que_les_alertes_de_proximite_de_sa_region(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.get('/api/v1/alertes-proximite/')
        self.assertEqual(reponse.status_code, 200)
        ids = {a['id'] for a in reponse.data}
        self.assertEqual(ids, {self.ap_dakar.id})

    def test_admin_regional_ne_peut_pas_recuperer_une_alerte_de_proximite_d_une_autre_region(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.get(f'/api/v1/alertes-proximite/{self.ap_thies.id}/')
        self.assertEqual(reponse.status_code, 404)

    def test_admin_regional_sans_region_ne_voit_aucune_alerte_de_proximite(self):
        self.client.force_authenticate(user=self.admin_sans_region)
        reponse = self.client.get('/api/v1/alertes-proximite/')
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data, [])

    def test_anaser_n_a_toujours_pas_acces_aux_alertes_de_proximite(self):
        self.client.force_authenticate(user=self.anaser)
        reponse = self.client.get('/api/v1/alertes-proximite/')
        self.assertEqual(reponse.status_code, 403)

    def test_aucune_action_de_creation_n_existe_pour_les_alertes_de_proximite(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.post('/api/v1/alertes-proximite/', {
            'boitier': str(self.boitier_thies.id), 'zone': self.zone.id, 'distance_metres': 10,
            'latitude': LATITUDE_BASE, 'longitude': LONGITUDE_BASE,
        }, format='json')
        self.assertEqual(reponse.status_code, 405)
