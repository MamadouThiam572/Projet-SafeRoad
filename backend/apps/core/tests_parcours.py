"""Parcours complet de la plateforme, tel qu'il sera testé avec le boîtier réel, par les mêmes
routes que le frontend : demande d'installation -> rendez-vous -> installation (compte
conducteur + boîtier) -> messages MQTT du boîtier -> incidents -> recalcul des zones ->
validation technique -> reconnaissance ANASER -> alerte au conducteur, carte publique et
tableaux de bord."""

import json
from datetime import timedelta

from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.boitiers.models import Boitier
from apps.boitiers.mqtt import traiter_message
from apps.comptes.models import Administrateur
from apps.conducteurs.models import Conducteur

API = '/api/v1'
# Thiès centre : position où le boîtier « roule » pendant le test.
LAT, LNG = 14.7910, -16.9256


@override_settings(SMS_BACKEND='memoire', EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class ParcoursCompletTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.super_admin = Administrateur.objects.create_user(
            email='super@parcours.sn', password='x', nom='Sarr', prenom='Awa', role=Administrateur.Role.SUPER_ADMIN,
        )
        cls.admin = Administrateur.objects.create_user(
            email='admin@parcours.sn', password='x', nom='Diop', prenom='Modou',
            role=Administrateur.Role.ADMIN, region='thies',
        )
        cls.anaser = Administrateur.objects.create_user(
            email='anaser@parcours.sn', password='x', nom='Faye', prenom='Bineta', role=Administrateur.Role.ANASER,
        )

    def setUp(self):
        cache.clear()

    def client_de(self, compte):
        client = APIClient()
        client.force_authenticate(user=compte)
        return client

    def ok(self, reponse, code=200):
        self.assertEqual(reponse.status_code, code, getattr(reponse, 'data', reponse.content))
        return reponse.data

    def mqtt(self, boitier, **donnees):
        cache.delete(f'mqtt:position:{boitier.pk}')  # sinon une position par 10 s seulement
        with override_settings(MQTT_BOITIER_PAR_DEFAUT=str(boitier.pk)):
            return traiter_message('saferoad/data', json.dumps(donnees))

    def test_de_la_demande_a_l_alerte_du_conducteur(self):
        admin, super_admin, anaser = (self.client_de(c) for c in (self.admin, self.super_admin, self.anaser))

        # 1. Demande publique (« Demander un boîtier »), sans compte.
        demande = self.ok(APIClient().post(f'{API}/demandes-installation/', {
            'nom': 'Ndiaye', 'prenom': 'Fatou', 'telephone': '+221 77 000 00 00', 'email': 'fatou@parcours.sn',
            'region': 'thies', 'commune': 'Thiès', 'type_vehicule': 'voiture', 'consentement_donnees': True,
        }, format='json'), 201)
        self.assertEqual(len(self.ok(admin.get(f'{API}/demandes-installation/'))), 1)  # sa région

        # 2. Rendez-vous puis installation : compte conducteur + boîtier + clé API (une fois).
        self.ok(admin.post(f'{API}/demandes-installation/{demande["id"]}/rendez-vous/', {
            'rdv_date': (timezone.now() + timedelta(days=1)).isoformat(), 'rdv_lieu': 'Agence de Thiès',
        }, format='json'))
        installee = self.ok(admin.post(f'{API}/demandes-installation/{demande["id"]}/installer/', {
            'numero_cni': '1234567890123', 'immatriculation': 'TH-1234-AB',
        }, format='json'))
        self.assertTrue(installee['boitier_api_key'])
        boitier = Boitier.objects.get(pk=installee['boitier'])
        conducteur = Conducteur.objects.get(email='fatou@parcours.sn')
        self.assertEqual(conducteur.boitier, boitier)
        self.assertTrue(any('fatou@parcours.sn' in m.to for m in mail.outbox))  # invitation

        # 3. Le boîtier publie en MQTT : position (GPS fiable) puis trois événements au même endroit.
        self.mqtt(boitier, latitude=LAT, longitude=LNG, vitesse_vehicule=42.0, hdop=0.9, satellites=9,
                  canal_reseau='wifi')
        for evenement in ('Freinage', 'ObstacleCritique', 'SecousseDangereuse'):
            with override_settings(MQTT_BOITIER_PAR_DEFAUT=str(boitier.pk)):
                resume = traiter_message('saferoad/alertes', json.dumps({'alerte': evenement, 'valeur': 3.1}))
            self.assertEqual(len(resume['incidents']), 1, evenement)

        # Le boîtier apparaît en ligne, avec sa position, dans la supervision de l'admin.
        boitiers = self.ok(admin.get(f'{API}/boitiers/'))
        self.assertEqual(len(boitiers), 1)
        self.assertTrue(boitiers[0]['en_ligne'])
        self.assertEqual(boitiers[0]['dernier_reseau'], 'wifi')
        incidents = self.ok(admin.get(f'{API}/incidents/'))['results']
        self.assertEqual(len(incidents), 3)
        self.assertEqual(len(self.ok(anaser.get(f'{API}/incidents/'))['results']), 3)  # lecture nationale

        # 4. Traitement d'un incident par l'admin (fiche incident).
        self.ok(admin.patch(f'{API}/incidents/{incidents[0]["id"]}/statut/', {'statut': 'en_cours'}, format='json'))
        self.assertEqual(anaser.patch(f'{API}/incidents/{incidents[0]["id"]}/statut/', {'statut': 'valide'},
                                      format='json').status_code, 403)

        # 5. Recalcul des zones (super admin) : une zone « proposée » naît des 3 incidents.
        resultat = self.ok(super_admin.post(f'{API}/zones/generer/'))
        self.assertEqual(resultat['zones_creees'], 1, resultat)
        zone = self.ok(admin.get(f'{API}/zones/'))[0]
        self.assertEqual((zone['statut_validation'], zone['region']), ('proposee', 'thies'))
        self.assertEqual(self.ok(APIClient().get(f'{API}/zones/')), [])  # pas encore publique

        # 6. Validation technique (admin) puis reconnaissance officielle (ANASER).
        for statut in ('validee_technique', 'soumise_anaser'):
            self.ok(admin.patch(f'{API}/zones/{zone["id"]}/statut/', {'statut_validation': statut}, format='json'))
        self.assertEqual(admin.patch(f'{API}/zones/{zone["id"]}/statut/', {'statut_validation': 'reconnue'},
                                     format='json').status_code, 403)
        self.ok(anaser.patch(f'{API}/zones/{zone["id"]}/statut/', {'statut_validation': 'reconnue'}, format='json'))
        self.assertEqual(len(self.ok(admin.get(f'{API}/zones/{zone["id"]}/historique/'))), 3)

        # 7. Carte publique : la zone est visible sans compte.
        publiques = self.ok(APIClient().get(f'{API}/zones/'))
        self.assertEqual([z['id'] for z in publiques], [zone['id']])

        # 8. Le boîtier repasse dans la zone : alerte de proximité pour le conducteur.
        cache.clear()  # cache des zones actives
        self.mqtt(boitier, latitude=LAT, longitude=LNG, vitesse_vehicule=38.0, hdop=0.9, satellites=9)
        # Rechargé comme à chaque vraie requête (JWT) : son boîtier a communiqué depuis.
        conducteur_client = self.client_de(Conducteur.objects.get(pk=conducteur.pk))
        alertes = self.ok(conducteur_client.get(f'{API}/conducteur/alertes/'))
        self.assertEqual(len(alertes), 1)
        self.assertEqual(alertes[0]['zone'], zone['id'])

        # 9. Signalement du conducteur, vérifié par l'admin avec les incidents proches.
        signalement = self.ok(conducteur_client.post(f'{API}/signalements/', {
            'type_danger': 'nid_de_poule', 'latitude': LAT, 'longitude': LNG, 'description': 'Gros trou',
        }, format='multipart'), 201)
        self.assertEqual(signalement['region'], 'thies')
        proches = self.ok(admin.get(f'{API}/signalements/{signalement["id"]}/incidents-proches/'))
        self.assertEqual(proches['nombre'], 3)
        self.ok(admin.patch(f'{API}/signalements/{signalement["id"]}/statut/', {'statut': 'valide'}, format='json'))

        # 10. Tableaux de bord : admin (sa région), ANASER et super admin (national), conducteur.
        tdb_admin = self.ok(admin.get(f'{API}/tableau-de-bord/?jours=30'))
        self.assertEqual(tdb_admin['indicateurs']['incidents']['aujourd_hui'], 3)
        self.assertEqual(tdb_admin['indicateurs']['zones']['reconnues'], 1)
        self.assertEqual(tdb_admin['zones_plus_dangereuses'][0]['id'], zone['id'])
        tdb_national = self.ok(super_admin.get(f'{API}/tableau-de-bord/?jours=90'))
        self.assertEqual(len(tdb_national['series_par_region']), 14)
        self.ok(anaser.get(f'{API}/tableau-de-bord/?jours=30'))
        tdb_conducteur = self.ok(conducteur_client.get(f'{API}/conducteur/tableau-de-bord/'))
        self.assertEqual(tdb_conducteur['alertes']['total'], 1)
        self.assertTrue(tdb_conducteur['boitier']['en_ligne'])

        # 11. Alertes de l'admin (incidents moyens/critiques) : prise en charge.
        alertes_admin = self.ok(admin.get(f'{API}/alertes/'))
        self.assertTrue(alertes_admin)
        self.ok(admin.patch(f'{API}/alertes/{alertes_admin[0]["id"]}/statut/', {'statut': 'en_cours'}, format='json'))

        # 12. Lectures des autres pages : comptes, conducteurs, messages de contact.
        self.ok(super_admin.get(f'{API}/administrateurs/'))
        self.ok(admin.get(f'{API}/conducteurs/'))
        self.ok(APIClient().post(f'{API}/messages-contact/', {
            'nom': 'Awa', 'email': 'awa@parcours.sn', 'sujet': 'question', 'message': 'Bonjour',
        }, format='json'), 201)
        self.assertEqual(len(self.ok(super_admin.get(f'{API}/messages-contact/'))), 1)
