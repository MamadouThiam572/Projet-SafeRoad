from django.db import models


class Region(models.TextChoices):
    """Les 14 régions administratives du Sénégal — référence partagée : toute app ayant
    besoin d'une région (comptes, boîtiers, zones...) importe cette classe plutôt que de
    redéfinir sa propre liste, pour qu'il n'existe qu'une seule source de vérité."""

    DAKAR = 'dakar', 'Dakar'
    DIOURBEL = 'diourbel', 'Diourbel'
    FATICK = 'fatick', 'Fatick'
    KAFFRINE = 'kaffrine', 'Kaffrine'
    KAOLACK = 'kaolack', 'Kaolack'
    KEDOUGOU = 'kedougou', 'Kédougou'
    KOLDA = 'kolda', 'Kolda'
    LOUGA = 'louga', 'Louga'
    MATAM = 'matam', 'Matam'
    SAINT_LOUIS = 'saint_louis', 'Saint-Louis'
    SEDHIOU = 'sedhiou', 'Sédhiou'
    TAMBACOUNDA = 'tambacounda', 'Tambacounda'
    THIES = 'thies', 'Thiès'
    ZIGUINCHOR = 'ziguinchor', 'Ziguinchor'
