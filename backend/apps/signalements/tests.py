import shutil
import tempfile
from io import BytesIO

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from apps.boitiers.models import Boitier
from apps.comptes.models import Administrateur
from apps.conducteurs.models import Conducteur
from apps.incidents.models import Incident

from .models import Signalement

DAKAR = (14.6928, -17.4467)
THIES = (14.7910, -16.9359)

DOSSIER_MEDIA_TEST = tempfile.mkdtemp(prefix='saferoad-media-test-')


def image(format_pil='JPEG', taille=(32, 32), nom='photo.jpg'):
    tampon = BytesIO()
    Image.new('RGB', taille, (200, 80, 40)).save(tampon, format=format_pil)
    return SimpleUploadedFile(nom, tampon.getvalue(), content_type=f'image/{format_pil.lower()}')


@override_settings(MEDIA_ROOT=DOSSIER_MEDIA_TEST)
class SignalementTests(TestCase):

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(DOSSIER_MEDIA_TEST, ignore_errors=True)

    @classmethod
    def setUpTestData(cls):
        cls.boitier = Boitier.objects.create(region='dakar')
        cls.awa = Conducteur.objects.create_user(
            email='awa@test.sn', password='x', nom='Ba', prenom='Awa', boitier=cls.boitier,
        )
        cls.moussa = Conducteur.objects.create_user(email='moussa@test.sn', password='x', nom='Sy', prenom='Moussa')
        cls.super_admin = Administrateur.objects.create_user(
            email='super-sig@test.sn', password='x', nom='Fall', prenom='Aida', role=Administrateur.Role.SUPER_ADMIN,
        )
        cls.admin_dakar = Administrateur.objects.create_user(
            email='dakar-sig@test.sn', password='x', nom='Diop', prenom='Cheikh',
            role=Administrateur.Role.ADMIN, region='dakar',
        )
        cls.admin_thies = Administrateur.objects.create_user(
            email='thies-sig@test.sn', password='x', nom='Ndiaye', prenom='Fatou',
            role=Administrateur.Role.ADMIN, region='thies',
        )
        cls.anaser = Administrateur.objects.create_user(
            email='anaser-sig@test.sn', password='x', nom='Diallo', prenom='Assane', role=Administrateur.Role.ANASER,
        )

    def setUp(self):
        cache.clear()  # compteurs de limitation d'envoi

    def client_pour(self, utilisateur=None):
        client = APIClient()
        if utilisateur:
            client.force_authenticate(user=utilisateur)
        return client

    def signaler(self, conducteur, position=DAKAR, **donnees):
        corps = {'type_danger': 'nid_de_poule', 'latitude': position[0], 'longitude': position[1]}
        corps.update(donnees)
        return self.client_pour(conducteur).post('/api/v1/signalements/', corps, format='multipart')

    def creer(self, conducteur, position, region):
        return Signalement.objects.create(
            conducteur=conducteur, type_danger='obstacle', latitude=position[0], longitude=position[1], region=region,
        )

    def ids(self, utilisateur):
        return {s['id'] for s in self.client_pour(utilisateur).get('/api/v1/signalements/').data}

    # --- Création ---

    def test_le_conducteur_signale_avec_une_photo(self):
        reponse = self.signaler(self.awa, description='Grand trou', precision_metres=6, photo=image())
        self.assertEqual(reponse.status_code, 201, reponse.data)
        signalement = Signalement.objects.get()
        self.assertEqual(signalement.region, 'dakar')  # déduite du GPS
        self.assertEqual(signalement.boitier, self.boitier)
        self.assertEqual(signalement.statut, Signalement.Statut.A_VERIFIER)
        self.assertTrue(reponse.data['photo_url'].endswith(f'/api/v1/signalements/{signalement.id}/photo/'))

    def test_la_region_envoyee_par_le_client_est_ignoree(self):
        self.signaler(self.awa, position=THIES, region='dakar')
        self.assertEqual(Signalement.objects.get().region, 'thies')

    def test_position_hors_du_senegal_refusee(self):
        reponse = self.signaler(self.awa, position=(13.4549, -16.5790))  # Banjul
        self.assertEqual(reponse.status_code, 400)

    def test_photo_trop_lourde_refusee(self):
        lourde = SimpleUploadedFile('lourde.jpg', b'0' * (5 * 1024 * 1024 + 1), content_type='image/jpeg')
        self.assertEqual(self.signaler(self.awa, photo=lourde).status_code, 400)

    def test_format_de_photo_non_accepte(self):
        self.assertEqual(self.signaler(self.awa, photo=image('GIF', nom='anim.gif')).status_code, 400)

    def test_un_faux_fichier_image_est_refuse(self):
        faux = SimpleUploadedFile('photo.jpg', b'ceci n est pas une image', content_type='image/jpeg')
        self.assertEqual(self.signaler(self.awa, photo=faux).status_code, 400)

    def test_seul_un_conducteur_peut_signaler(self):
        for utilisateur in (self.admin_dakar, self.super_admin, self.anaser):
            with self.subTest(role=utilisateur.role):
                self.assertEqual(self.signaler(utilisateur).status_code, 403)
        self.assertIn(self.signaler(None).status_code, (401, 403))

    # --- Consultation ---

    def test_chacun_voit_ce_qui_le_concerne(self):
        de_awa = self.creer(self.awa, DAKAR, 'dakar')
        de_moussa = self.creer(self.moussa, THIES, 'thies')
        self.assertEqual(self.ids(self.awa), {de_awa.id})
        self.assertEqual(self.ids(self.admin_dakar), {de_awa.id})
        self.assertEqual(self.ids(self.admin_thies), {de_moussa.id})
        self.assertEqual(self.ids(self.super_admin), {de_awa.id, de_moussa.id})
        self.assertEqual(self.ids(self.anaser), {de_awa.id, de_moussa.id})

    def test_anaser_ne_voit_pas_l_identite_du_conducteur(self):
        signalement = self.creer(self.awa, DAKAR, 'dakar')
        donnees = self.client_pour(self.anaser).get(f'/api/v1/signalements/{signalement.id}/').data
        self.assertNotIn('conducteur', donnees)
        self.assertNotIn('conducteur_nom', donnees)
        admin = self.client_pour(self.admin_dakar).get(f'/api/v1/signalements/{signalement.id}/').data
        self.assertEqual(admin['conducteur_nom'], 'Awa Ba')

    # --- Photo protégée ---

    def test_acces_a_la_photo(self):
        self.signaler(self.awa, photo=image())
        url = f'/api/v1/signalements/{Signalement.objects.get().id}/photo/'
        for utilisateur, attendu in [
            (self.awa, 200), (self.admin_dakar, 200), (self.super_admin, 200), (self.anaser, 200),
            (self.moussa, 404), (self.admin_thies, 404),
        ]:
            with self.subTest(utilisateur=utilisateur.email):
                reponse = self.client_pour(utilisateur).get(url)
                self.assertEqual(reponse.status_code, attendu)
                if attendu == 200:
                    self.assertTrue(b''.join(reponse.streaming_content).startswith(b'\xff\xd8'))  # JPEG
        self.assertIn(self.client_pour().get(url).status_code, (401, 403))

    # --- Vérification par l'administrateur ---

    def changer(self, utilisateur, signalement, statut, commentaire=''):
        return self.client_pour(utilisateur).patch(
            f'/api/v1/signalements/{signalement.id}/statut/', {'statut': statut, 'commentaire': commentaire},
            format='json',
        )

    def test_parcours_de_verification_trace(self):
        signalement = self.creer(self.awa, DAKAR, 'dakar')
        self.assertEqual(self.changer(self.admin_dakar, signalement, 'en_verification').status_code, 200)
        self.assertEqual(self.changer(self.admin_dakar, signalement, 'valide').status_code, 200)
        historique = self.client_pour(self.super_admin).get(f'/api/v1/signalements/{signalement.id}/historique/').data
        self.assertEqual([h['statut_nouveau'] for h in historique], ['en_verification', 'valide'])
        self.assertEqual(historique[0]['acteur'], self.admin_dakar.id)

    def test_un_rejet_doit_etre_motive(self):
        signalement = self.creer(self.awa, DAKAR, 'dakar')
        self.assertEqual(self.changer(self.admin_dakar, signalement, 'rejete').status_code, 400)
        self.assertEqual(self.changer(self.admin_dakar, signalement, 'rejete', 'Photo floue, rien de visible').status_code, 200)

    def test_droits_de_decision(self):
        signalement = self.creer(self.awa, DAKAR, 'dakar')
        self.assertEqual(self.changer(self.admin_thies, signalement, 'valide').status_code, 404)  # autre région
        self.assertEqual(self.changer(self.anaser, signalement, 'valide').status_code, 403)
        self.assertEqual(self.changer(self.awa, signalement, 'valide').status_code, 403)
        self.assertEqual(self.changer(self.super_admin, signalement, 'valide').status_code, 200)

    def test_transition_impossible(self):
        signalement = self.creer(self.awa, DAKAR, 'dakar')
        self.changer(self.admin_dakar, signalement, 'valide')
        self.assertEqual(self.changer(self.admin_dakar, signalement, 'a_verifier').status_code, 400)

    # --- Incidents proches ---

    def test_incidents_proches_tries_par_distance(self):
        signalement = self.creer(self.awa, DAKAR, 'dakar')

        def incident(decalage_latitude):
            return Incident.objects.create(
                boitier=self.boitier, latitude=DAKAR[0] + decalage_latitude, longitude=DAKAR[1],
                horodatage=timezone.now(), type_incident='freinage_brusque',
            )

        a_200_m, a_50_m, a_2_km = incident(0.0018), incident(0.00045), incident(0.018)
        donnees = self.client_pour(self.admin_dakar).get(
            f'/api/v1/signalements/{signalement.id}/incidents-proches/'
        ).data
        self.assertEqual([i['id'] for i in donnees['incidents']], [a_50_m.id, a_200_m.id])
        self.assertNotIn(a_2_km.id, [i['id'] for i in donnees['incidents']])
        self.assertAlmostEqual(donnees['incidents'][0]['distance_metres'], 50, delta=5)

    def test_le_conducteur_n_a_pas_acces_aux_incidents_proches(self):
        signalement = self.creer(self.awa, DAKAR, 'dakar')
        reponse = self.client_pour(self.awa).get(f'/api/v1/signalements/{signalement.id}/incidents-proches/')
        self.assertEqual(reponse.status_code, 403)
