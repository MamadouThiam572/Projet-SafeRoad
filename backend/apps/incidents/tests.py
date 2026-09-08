from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.boitiers.models import Boitier
from apps.comptes.models import Administrateur

from .models import Incident

LATITUDE_BASE, LONGITUDE_BASE = 14.6928, -17.4467


def creer_incident(boitier, **kwargs):
    donnees = {
        'boitier': boitier,
        'latitude': LATITUDE_BASE,
        'longitude': LONGITUDE_BASE,
        'horodatage': timezone.now(),
        'type_incident': Incident.TypeIncident.FREINAGE_BRUSQUE,
    }
    donnees.update(kwargs)
    return Incident.objects.create(**donnees)


class IncidentFiltrageRegionalTests(TestCase):
    """Étape 4B : IncidentViewSet applique FiltreRegional via `boitier__region` (voir
    apps/core/regionalisation.py) — la région d'un incident se déduit de son boîtier,
    aucun champ `region` propre n'a été ajouté au modèle. Ce ViewSet n'expose que
    List + Retrieve (voir views.py) : aucune action d'écriture à protéger séparément."""

    @classmethod
    def setUpTestData(cls):
        cls.super_admin = Administrateur.objects.create_user(
            email='super-admin-incidents@test.sn', password='x', nom='Cissé', prenom='Modou',
            role=Administrateur.Role.SUPER_ADMIN,
        )
        cls.admin_dakar = Administrateur.objects.create_user(
            email='admin-dakar-incidents@test.sn', password='x', nom='Ndoye', prenom='Awa',
            role=Administrateur.Role.ADMIN, region='dakar',
        )
        cls.admin_sans_region = Administrateur.objects.create_user(
            email='admin-sr-incidents@test.sn', password='x', nom='Gueye', prenom='Ibrahima',
            role=Administrateur.Role.ADMIN, region=None,
        )
        cls.anaser = Administrateur.objects.create_user(
            email='anaser-incidents@test.sn', password='x', nom='Diagne', prenom='Fatou',
            role=Administrateur.Role.ANASER,
        )

        cls.boitier_dakar = Boitier.objects.create(region='dakar', numero_immatriculation='DK-0001')
        cls.boitier_thies = Boitier.objects.create(region='thies', numero_immatriculation='TH-0001')

        cls.incident_dakar = creer_incident(cls.boitier_dakar)
        cls.incident_thies = creer_incident(cls.boitier_thies)

    def setUp(self):
        self.client = APIClient()

    # --- A / J. Super Admin : accès national ---

    def test_super_admin_voit_les_incidents_de_toutes_les_regions(self):
        self.client.force_authenticate(user=self.super_admin)
        reponse = self.client.get('/api/v1/incidents/')
        self.assertEqual(reponse.status_code, 200)
        ids = {i['id'] for i in reponse.data['results']}
        self.assertEqual(ids, {self.incident_dakar.id, self.incident_thies.id})

    # --- B. Admin régional : liste ---

    def test_admin_regional_ne_voit_que_les_incidents_de_sa_region(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.get('/api/v1/incidents/')
        self.assertEqual(reponse.status_code, 200)
        ids = {i['id'] for i in reponse.data['results']}
        self.assertEqual(ids, {self.incident_dakar.id})

    # --- C. Détail d'un incident d'une autre région ---

    def test_admin_regional_ne_peut_pas_recuperer_un_incident_d_une_autre_region(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.get(f'/api/v1/incidents/{self.incident_thies.id}/')
        self.assertEqual(reponse.status_code, 404)

    # --- K. Incident de sa propre région : accessible normalement ---

    def test_admin_regional_peut_recuperer_un_incident_de_sa_propre_region(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.get(f'/api/v1/incidents/{self.incident_dakar.id}/')
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data['id'], self.incident_dakar.id)

    # --- D / E. PATCH / DELETE : n'existent pas du tout sur ce ViewSet (List+Retrieve
    # seulement) — un admin régional ne peut donc, par construction, modifier ou supprimer
    # AUCUN incident, ni celui d'une autre région ni le sien. Vérifié explicitement plutôt
    # que supposé, conformément à l'audit (aucune ambiguïté : 405 quelle que soit la région). ---

    def test_patch_est_impossible_sur_un_incident_quelle_que_soit_la_region(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse_meme_region = self.client.patch(
            f'/api/v1/incidents/{self.incident_dakar.id}/', {'type_incident': 'chute'}, format='json',
        )
        reponse_autre_region = self.client.patch(
            f'/api/v1/incidents/{self.incident_thies.id}/', {'type_incident': 'chute'}, format='json',
        )
        self.assertEqual(reponse_meme_region.status_code, 405)
        self.assertEqual(reponse_autre_region.status_code, 405)

    def test_delete_est_impossible_sur_un_incident_quelle_que_soit_la_region(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse_meme_region = self.client.delete(f'/api/v1/incidents/{self.incident_dakar.id}/')
        reponse_autre_region = self.client.delete(f'/api/v1/incidents/{self.incident_thies.id}/')
        self.assertEqual(reponse_meme_region.status_code, 405)
        self.assertEqual(reponse_autre_region.status_code, 405)
        self.assertTrue(Incident.objects.filter(id=self.incident_dakar.id).exists())
        self.assertTrue(Incident.objects.filter(id=self.incident_thies.id).exists())

    # --- F. Admin régional sans région ---

    def test_admin_regional_sans_region_ne_voit_aucun_incident(self):
        self.client.force_authenticate(user=self.admin_sans_region)
        reponse = self.client.get('/api/v1/incidents/')
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data['results'], [])

    # --- G. Anti-contournement ---

    def test_un_parametre_region_dans_l_url_est_ignore(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.get('/api/v1/incidents/?region=thies')
        self.assertEqual(reponse.status_code, 200)
        ids = {i['id'] for i in reponse.data['results']}
        self.assertEqual(ids, {self.incident_dakar.id})  # jamais l'incident de Thiès

    # --- H. Création : aucune voie d'écriture accessible à un admin humain ---

    def test_aucune_action_de_creation_n_existe_pour_un_administrateur(self):
        # IncidentViewSet n'a pas de create() (List+Retrieve seulement) : POST /incidents/
        # n'est routé vers rien. La création réelle (IngestionView/SyncBatchView) est
        # réservée à EstBoitier — un admin humain, quel que soit son rôle, en est exclu.
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.post('/api/v1/incidents/', {
            'boitier': str(self.boitier_thies.id), 'latitude': LATITUDE_BASE, 'longitude': LONGITUDE_BASE,
            'horodatage': timezone.now().isoformat(), 'type_incident': 'autre',
        }, format='json')
        self.assertEqual(reponse.status_code, 405)

        reponse_ingestion = self.client.post('/api/v1/incidents/ingestion/', {
            'latitude': LATITUDE_BASE, 'longitude': LONGITUDE_BASE,
            'horodatage': timezone.now().isoformat(), 'type_incident': 'autre',
        }, format='json')
        self.assertEqual(reponse_ingestion.status_code, 403)  # EstBoitier : un admin n'est pas un Boitier

    # --- I. ANASER : comportement inchangé ---

    def test_anaser_conserve_un_acces_national_sans_filtrage_regional(self):
        # ANASER a déjà accès à /incidents/ (EstAdminOuAnaser) et FiltreRegional ne
        # restreint que role='admin' — aucun changement de comportement attendu ici.
        self.client.force_authenticate(user=self.anaser)
        reponse = self.client.get('/api/v1/incidents/')
        self.assertEqual(reponse.status_code, 200)
        ids = {i['id'] for i in reponse.data['results']}
        self.assertEqual(ids, {self.incident_dakar.id, self.incident_thies.id})

    # --- L. Incident sans boîtier : comportement réel vérifié, pas supposé ---

    def test_incident_sans_boitier_est_impossible_au_niveau_modele(self):
        # Incident.boitier n'a pas null=True : structurellement impossible à créer sans
        # boîtier. Aucun cas « incident orphelin » ne peut donc jamais exister — pas de
        # traitement particulier nécessaire pour le filtrage régional.
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Incident.objects.create(
                    boitier=None, latitude=LATITUDE_BASE, longitude=LONGITUDE_BASE,
                    horodatage=timezone.now(), type_incident=Incident.TypeIncident.AUTRE,
                )
