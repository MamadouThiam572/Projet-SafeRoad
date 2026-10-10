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



class DonneesGpsIngestionTests(TestCase):
    """Le boîtier transmet vitesse GPS, HDOP et nombre de satellites avec chaque incident :
    une position douteuse est conservée mais marquée non fiable ; la vitesse GPS remplace le
    radar absent dans le calcul de gravité."""

    def setUp(self):
        self.boitier = Boitier(region='dakar')
        self.boitier.set_api_key('cle-gps')
        self.boitier.save()
        self.client = APIClient()
        self.entetes = {'HTTP_X_BOITIER_UUID': str(self.boitier.id), 'HTTP_X_BOITIER_API_KEY': 'cle-gps'}

    def envoyer(self, **donnees):
        corps = {
            'latitude': LATITUDE_BASE, 'longitude': LONGITUDE_BASE,
            'horodatage': timezone.now().isoformat(), 'type_incident': 'choc_violent',
        }
        corps.update(donnees)
        return self.client.post('/api/v1/incidents/ingestion/', corps, format='json', **self.entetes)

    def test_les_donnees_gps_sont_enregistrees(self):
        reponse = self.envoyer(vitesse_gps=72.5, hdop=0.9, nombre_satellites=9)
        self.assertEqual(reponse.status_code, 201)
        incident = Incident.objects.get()
        self.assertEqual((incident.vitesse_gps, incident.hdop, incident.nombre_satellites), (72.5, 0.9, 9))
        self.assertTrue(incident.position_fiable)

    def test_trop_peu_de_satellites_rend_la_position_non_fiable(self):
        self.envoyer(hdop=1.0, nombre_satellites=3)
        self.assertFalse(Incident.objects.get().position_fiable)

    def test_hdop_trop_eleve_rend_la_position_non_fiable(self):
        self.envoyer(hdop=8.0, nombre_satellites=7)
        self.assertFalse(Incident.objects.get().position_fiable)

    def test_sans_donnees_de_qualite_la_position_reste_fiable(self):
        # Firmware qui n'envoie pas encore HDOP/satellites : rien ne prouve une mauvaise position.
        self.envoyer()
        self.assertTrue(Incident.objects.get().position_fiable)

    def test_la_vitesse_gps_remplace_le_radar_absent_pour_la_gravite(self):
        self.envoyer(vitesse_gps=90)
        self.assertEqual(Incident.objects.get().niveau_gravite, Incident.NiveauGravite.CRITIQUE)

    def test_le_radar_reste_prioritaire_sur_la_vitesse_gps(self):
        self.envoyer(vitesse_radar=10, vitesse_gps=90)
        self.assertEqual(Incident.objects.get().niveau_gravite, Incident.NiveauGravite.FAIBLE)

    def test_valeurs_negatives_refusees(self):
        self.assertEqual(self.envoyer(hdop=-1).status_code, 400)
        self.assertEqual(self.envoyer(vitesse_gps=-5).status_code, 400)

    def test_le_lot_hors_ligne_applique_les_memes_regles(self):
        horodatage = timezone.now().isoformat()
        commun = {'latitude': LATITUDE_BASE, 'longitude': LONGITUDE_BASE, 'horodatage': horodatage,
                  'type_incident': 'choc_violent'}
        reponse = self.client.post('/api/v1/incidents/sync-batch/', {'incidents': [
            {**commun, 'hdop': 0.8, 'nombre_satellites': 10},
            {**commun, 'hdop': 9.0, 'nombre_satellites': 10},
        ]}, format='json', **self.entetes)
        self.assertEqual(reponse.status_code, 201)
        self.assertEqual(
            sorted(Incident.objects.values_list('position_fiable', flat=True)), [False, True],
        )


class TraitementIncidentTests(TestCase):
    """Statut administratif d'un incident : nouveau → en cours → validé → clôturé, ou rejeté
    (faux positif, motivé). Observations et décisions sont historisées ; l'ANASER consulte."""

    @classmethod
    def setUpTestData(cls):
        cls.boitier_dakar = Boitier.objects.create(region='dakar')
        cls.boitier_thies = Boitier.objects.create(region='thies')
        cls.super_admin = Administrateur.objects.create_user(
            email='super-trt@test.sn', password='x', nom='Fall', prenom='Aida', role=Administrateur.Role.SUPER_ADMIN,
        )
        cls.admin_dakar = Administrateur.objects.create_user(
            email='dakar-trt@test.sn', password='x', nom='Diop', prenom='Cheikh',
            role=Administrateur.Role.ADMIN, region='dakar',
        )
        cls.anaser = Administrateur.objects.create_user(
            email='anaser-trt@test.sn', password='x', nom='Diallo', prenom='Assane', role=Administrateur.Role.ANASER,
        )

    def setUp(self):
        self.incident = creer_incident(self.boitier_dakar)

    def client_pour(self, utilisateur):
        client = APIClient()
        client.force_authenticate(user=utilisateur)
        return client

    def changer(self, utilisateur, statut, commentaire='', incident=None):
        incident = incident or self.incident
        return self.client_pour(utilisateur).patch(
            f'/api/v1/incidents/{incident.id}/statut/', {'statut': statut, 'commentaire': commentaire}, format='json',
        )

    def test_un_incident_recu_est_nouveau(self):
        self.assertEqual(self.incident.statut, Incident.Statut.NOUVEAU)

    def test_parcours_complet_et_historique(self):
        for statut in ('en_cours', 'valide', 'cloture'):
            self.assertEqual(self.changer(self.admin_dakar, statut).status_code, 200)
        self.client_pour(self.admin_dakar).post(
            f'/api/v1/incidents/{self.incident.id}/observations/', {'texte': 'Gendarmerie prévenue'}, format='json',
        )
        historique = self.client_pour(self.anaser).get(f'/api/v1/incidents/{self.incident.id}/historique/').data
        self.assertEqual(
            [(h['statut_nouveau'], h['texte']) for h in historique],
            [('en_cours', ''), ('valide', ''), ('cloture', ''), ('', 'Gendarmerie prévenue')],
        )

    def test_rejeter_un_faux_positif_doit_etre_motive(self):
        self.assertEqual(self.changer(self.admin_dakar, 'rejete').status_code, 400)
        reponse = self.changer(self.admin_dakar, 'rejete', 'Dos-d\'âne pris pour un choc')
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data['statut_libelle'], 'Rejeté (faux positif)')

    def test_transition_impossible(self):
        self.assertEqual(self.changer(self.admin_dakar, 'cloture').status_code, 400)  # pas validé avant
        self.assertEqual(self.changer(self.admin_dakar, 'inconnu').status_code, 400)

    def test_droits(self):
        incident_thies = creer_incident(self.boitier_thies)
        self.assertEqual(self.changer(self.admin_dakar, 'en_cours', incident=incident_thies).status_code, 404)
        self.assertEqual(self.changer(self.anaser, 'en_cours').status_code, 403)
        self.assertEqual(
            self.client_pour(self.anaser).post(
                f'/api/v1/incidents/{self.incident.id}/observations/', {'texte': 'x'}, format='json',
            ).status_code,
            403,
        )
        self.assertEqual(self.changer(self.super_admin, 'en_cours', incident=incident_thies).status_code, 200)

    def test_observation_vide_refusee(self):
        reponse = self.client_pour(self.admin_dakar).post(
            f'/api/v1/incidents/{self.incident.id}/observations/', {'texte': '   '}, format='json',
        )
        self.assertEqual(reponse.status_code, 400)

    def test_les_donnees_capteurs_restent_non_modifiables(self):
        reponse = self.client_pour(self.super_admin).patch(
            f'/api/v1/incidents/{self.incident.id}/', {'vitesse_radar': 1}, format='json',
        )
        self.assertEqual(reponse.status_code, 405)
