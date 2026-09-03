"""Aides géospatiales légères (pas de dépendance PostGIS — voir la justification
dans l'étude de correction : le volume de zones actuel ne le justifie pas encore)."""

import math

METRES_PAR_DEGRE_LATITUDE = 111_320


def boite_englobante(latitude, longitude, rayon_metres):
    """(delta_latitude, delta_longitude) du rectangle englobant un cercle de
    `rayon_metres` autour de (latitude, longitude).

    Sert de pré-filtre bon marché (comparaisons numériques, utilisables par un index
    B-tree classique sur les colonnes latitude/longitude) avant un calcul géodésique
    précis mais coûteux — on ne calcule `geodesic()` que sur les quelques candidats
    restants, plus sur l'ensemble des zones/incidents à chaque appel.
    """
    delta_latitude = rayon_metres / METRES_PAR_DEGRE_LATITUDE
    metres_par_degre_longitude = METRES_PAR_DEGRE_LATITUDE * max(math.cos(math.radians(latitude)), 0.01)
    delta_longitude = rayon_metres / metres_par_degre_longitude
    return delta_latitude, delta_longitude
