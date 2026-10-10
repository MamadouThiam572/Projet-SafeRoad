from io import StringIO

from django.core import mail
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.boitiers.models import Boitier
from apps.comptes.models import Administrateur
from apps.conducteurs.models import Conducteur
from apps.core.sms import boite_sms
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
    """AlerteViewSet applique FiltreRegional via `boitier__region` : la région d'une alerte
    est celle du boîtier concerné, quelle que soit la source de l'alerte."""

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
        reponse = self.client.patch(f'/api/v1/alertes/{self.alerte_dakar.id}/statut/', {'statut': 'traitee'}, format='json')
        self.assertEqual(reponse.status_code, 200)
        self.alerte_dakar.refresh_from_db()
        self.assertEqual(self.alerte_dakar.statut, 'traitee')
        self.assertEqual(self.alerte_dakar.traitee_par_id, self.admin_dakar.id)
        self.assertIsNotNone(self.alerte_dakar.traitee_le)

    def test_admin_regional_ne_peut_pas_traiter_une_alerte_d_une_autre_region(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.patch(f'/api/v1/alertes/{self.alerte_thies.id}/statut/', {'statut': 'traitee'}, format='json')
        self.assertEqual(reponse.status_code, 404)
        self.alerte_thies.refresh_from_db()
        self.assertEqual(self.alerte_thies.statut, 'nouvelle')  # inchangée
        self.assertIsNone(self.alerte_thies.traitee_par)

    def test_traiter_refuse_un_statut_inconnu(self):
        self.client.force_authenticate(user=self.admin_dakar)
        reponse = self.client.patch(f'/api/v1/alertes/{self.alerte_dakar.id}/statut/', {'statut': 'xyz'}, format='json')
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


class AlerteSourcesTests(TestCase):
    """Fil d'alertes de l'administrateur : incidents moyens/critiques (véhicule, ou zone s'ils
    surviennent dans une zone reconnue), boîtiers hors ligne ; prise en charge puis traitement."""

    @classmethod
    def setUpTestData(cls):
        cls.admin_dakar = Administrateur.objects.create_user(
            email='dakar-sources@test.sn', password='x', nom='Sy', prenom='Astou',
            role=Administrateur.Role.ADMIN, region='dakar',
        )

    def setUp(self):
        self.boitier = Boitier.objects.create(region='dakar', numero_immatriculation='DK-4471-EF')
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin_dakar)

    def test_un_incident_moyen_cree_une_alerte_vigilance_vehicule(self):
        incident = creer_incident_critique(
            self.boitier, niveau_gravite=Incident.NiveauGravite.MOYEN,
            type_incident=Incident.TypeIncident.FREINAGE_BRUSQUE, vitesse_radar=48.6,
        )
        alerte = Alerte.objects.get(incident=incident)
        self.assertEqual((alerte.source, alerte.niveau), ('vehicule', 'vigilance'))

        donnees = self.client.get(f'/api/v1/alertes/{alerte.id}/').data
        self.assertEqual(donnees['titre'], 'Freinage brusque détecté')
        self.assertIn('49 km/h', donnees['description'])
        self.assertEqual(donnees['lieu'], 'Dakar')
        self.assertEqual(donnees['vehicule']['immatriculation'], 'DK-4471-EF')

    def test_un_incident_dans_une_zone_reconnue_est_une_alerte_zone(self):
        zone = Zone.objects.create(
            latitude_centre=LATITUDE_BASE, longitude_centre=LONGITUDE_BASE, rayon_metres=300, region='dakar',
            statut_validation=Zone.StatutValidation.RECONNUE,
        )
        incident = creer_incident_critique(self.boitier)
        alerte = Alerte.objects.get(incident=incident)
        self.assertEqual((alerte.source, alerte.zone), ('zone', zone))
        self.assertTrue(self.client.get(f'/api/v1/alertes/{alerte.id}/').data['titre'].endswith('sur une zone à risque'))

    def test_une_zone_non_reconnue_ne_change_pas_la_source(self):
        Zone.objects.create(
            latitude_centre=LATITUDE_BASE, longitude_centre=LONGITUDE_BASE, rayon_metres=300, region='dakar',
            statut_validation=Zone.StatutValidation.VALIDEE_TECHNIQUEMENT,
        )
        incident = creer_incident_critique(self.boitier)
        self.assertEqual(Alerte.objects.get(incident=incident).source, 'vehicule')

    def test_le_conducteur_qui_porte_le_boitier_est_rattache(self):
        conducteur = Conducteur.objects.create_user(
            email='moussa-sources@test.sn', password='x', nom='Diop', prenom='Moussa', boitier=self.boitier,
        )
        incident = creer_incident_critique(self.boitier)
        alerte = Alerte.objects.get(incident=incident)
        self.assertEqual(alerte.conducteur, conducteur)
        self.assertEqual(self.client.get(f'/api/v1/alertes/{alerte.id}/').data['vehicule']['conducteur'], 'Moussa Diop')

    def test_boitier_hors_ligne(self):
        silencieux = Boitier.objects.create(
            region='dakar', derniere_localisation_maj=timezone.now() - timezone.timedelta(minutes=45),
        )
        Boitier.objects.create(region='dakar', derniere_localisation_maj=timezone.now())  # actif récemment
        Boitier.objects.create(region='dakar')  # n'a encore jamais émis
        Boitier.objects.create(  # arrêté volontairement : pas d'alerte
            region='dakar', statut=Boitier.Statut.INACTIF,
            derniere_localisation_maj=timezone.now() - timezone.timedelta(hours=5),
        )

        call_command('verifier_boitiers_hors_ligne', stdout=StringIO())
        call_command('verifier_boitiers_hors_ligne', stdout=StringIO())  # pas de doublon

        alertes = Alerte.objects.filter(motif=Alerte.Motif.HORS_LIGNE)
        self.assertEqual([a.boitier for a in alertes], [silencieux])
        donnees = self.client.get(f'/api/v1/alertes/{alertes[0].id}/').data
        self.assertEqual((donnees['source'], donnees['titre']), ('boitier', 'Boîtier hors ligne'))
        self.assertIn('depuis 45 min', donnees['description'])

    def test_prise_en_charge_puis_traitement(self):
        alerte = Alerte.objects.get(incident=creer_incident_critique(self.boitier))
        url = f'/api/v1/alertes/{alerte.id}/statut/'

        self.assertEqual(self.client.patch(url, {'statut': 'en_cours'}, format='json').status_code, 200)
        alerte.refresh_from_db()
        self.assertEqual(alerte.prise_en_charge_par, self.admin_dakar)
        self.assertIsNone(alerte.traitee_par)

        self.assertEqual(self.client.patch(url, {'statut': 'traitee'}, format='json').status_code, 200)
        alerte.refresh_from_db()
        self.assertEqual((alerte.statut, alerte.traitee_par), ('traitee', self.admin_dakar))
        self.assertEqual(self.client.patch(url, {'statut': 'nouvelle'}, format='json').status_code, 400)


@override_settings(SMS_BACKEND='memoire')
class UrgenceChocCritiqueTests(TestCase):
    """Choc critique récent -> SMS à l'admin de la région (avec téléphone) et e-mail au super
    admin, une seule fois par boîtier sur 10 minutes ; rien pour un choc ancien ou non critique."""

    @classmethod
    def setUpTestData(cls):
        cls.admin_dakar = Administrateur.objects.create_user(
            email='dakar-urg@test.sn', password='x', nom='Diop', prenom='Cheikh', telephone='+221771112233',
            role=Administrateur.Role.ADMIN, region='dakar',
        )
        Administrateur.objects.create_user(
            email='thies-urg@test.sn', password='x', nom='Sy', prenom='Astou', telephone='+221772223344',
            role=Administrateur.Role.ADMIN, region='thies',
        )
        Administrateur.objects.create_user(
            email='super-urg@test.sn', password='x', nom='Fall', prenom='Aida', role=Administrateur.Role.SUPER_ADMIN,
        )

    def setUp(self):
        boite_sms.clear()
        self.boitier = Boitier.objects.create(region='dakar', numero_immatriculation='DK-4471-EF')
        Conducteur.objects.create_user(email='moussa-urg@test.sn', password='x', nom='Diop', prenom='Moussa',
                                       boitier=self.boitier)

    def choc(self, **extra):
        with self.captureOnCommitCallbacks(execute=True):
            return creer_incident_critique(self.boitier, vitesse_radar=72, **extra)

    def test_choc_critique_previent_l_admin_de_la_region_et_le_super_admin(self):
        incident = self.choc()
        self.assertEqual([numero for numero, _ in boite_sms], ['+221771112233'])
        sms = boite_sms[0][1]
        self.assertIn('CHOC CRITIQUE', sms)
        self.assertIn('DK-4471-EF (Moussa Diop), 72 km/h', sms)
        self.assertIn(f'https://maps.google.com/?q={incident.latitude:.5f},{incident.longitude:.5f}', sms)
        self.assertEqual([m.to for m in mail.outbox], [['super-urg@test.sn']])

    def test_un_seul_envoi_par_boitier_sur_dix_minutes(self):
        self.choc()
        self.choc()
        self.assertEqual(len(boite_sms), 1)
        self.assertEqual(len(mail.outbox), 1)

    def test_un_choc_remonte_en_differe_ne_declenche_pas_d_urgence(self):
        self.choc(horodatage=timezone.now() - timezone.timedelta(hours=3))
        self.assertEqual(boite_sms, [])

    def test_un_incident_moyen_ne_declenche_pas_d_urgence(self):
        with self.captureOnCommitCallbacks(execute=True):
            creer_incident_critique(self.boitier, niveau_gravite=Incident.NiveauGravite.MOYEN)
        self.assertEqual(boite_sms, [])
