from django.test import TestCase
from django.utils import timezone

from apps.boitiers.models import Boitier
from apps.configuration.models import ConfigurationSysteme
from apps.incidents.models import Incident

from .clustering import _niveau_danger, generer_zones_depuis_incidents
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
        self.assertEqual(zone.statut_validation, Zone.StatutValidation.EN_ATTENTE)

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
        zone.statut_validation = Zone.StatutValidation.VALIDEE
        zone.save(update_fields=['statut_validation'])

        self._creer_incident(decalage=0.0002)
        generer_zones_depuis_incidents()

        zone.refresh_from_db()
        self.assertEqual(zone.statut_validation, Zone.StatutValidation.VALIDEE)
