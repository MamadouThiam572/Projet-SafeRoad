"""Aides géospatiales légères (pas de dépendance PostGIS — voir la justification
dans l'étude de correction : le volume de zones actuel ne le justifie pas encore)."""

import json
import math
from functools import lru_cache
from pathlib import Path

METRES_PAR_DEGRE_LATITUDE = 111_320

# Contours officiels des 14 régions (voir la clé "source" du fichier pour l'origine et la licence).
FICHIER_REGIONS = Path(__file__).resolve().parent / 'data' / 'regions_senegal.geojson'
# Un point GPS légèrement hors de tout contour (route côtière, tracé de frontière arrondi)
# est rattaché à la région la plus proche jusqu'à cette distance ; au-delà, il est hors du
# Sénégal (mer, Gambie, pays voisin) et aucune région n'est attribuée.
TOLERANCE_HORS_CONTOUR_METRES = 1_000


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


@lru_cache(maxsize=1)
def _contours_regions():
    """[(slug, (lon_min, lat_min, lon_max, lat_max), polygones)] chargé une seule fois par
    processus. Chaque polygone est une liste d'anneaux [(lon, lat), ...] : le premier est le
    contour extérieur, les suivants des trous (enclaves)."""
    donnees = json.loads(FICHIER_REGIONS.read_text(encoding='utf-8'))
    regions = []
    for feature in donnees['features']:
        geometrie = feature['geometry']
        polygones = geometrie['coordinates'] if geometrie['type'] == 'MultiPolygon' else [geometrie['coordinates']]
        polygones = [[[tuple(point) for point in anneau] for anneau in polygone] for polygone in polygones]
        points = [point for polygone in polygones for point in polygone[0]]
        boite = (
            min(p[0] for p in points), min(p[1] for p in points),
            max(p[0] for p in points), max(p[1] for p in points),
        )
        regions.append((feature['properties']['region'], boite, polygones))
    return regions


def _dans_anneau(longitude, latitude, anneau):
    """Lancer de rayon : un point est dedans s'il croise un nombre impair d'arêtes."""
    dedans = False
    j = len(anneau) - 1
    for i in range(len(anneau)):
        xi, yi = anneau[i]
        xj, yj = anneau[j]
        if (yi > latitude) != (yj > latitude) and longitude < (xj - xi) * (latitude - yi) / (yj - yi) + xi:
            dedans = not dedans
        j = i
    return dedans


def _dans_polygone(longitude, latitude, polygone):
    exterieur, *trous = polygone
    return _dans_anneau(longitude, latitude, exterieur) and not any(
        _dans_anneau(longitude, latitude, trou) for trou in trous
    )


def _distance_metres_au_contour(latitude, longitude, polygone):
    """Distance minimale du point aux arêtes du contour extérieur, en projection locale
    équirectangulaire (largement assez précise à l'échelle de la tolérance)."""
    kx = METRES_PAR_DEGRE_LATITUDE * math.cos(math.radians(latitude))
    ky = METRES_PAR_DEGRE_LATITUDE
    exterieur = polygone[0]
    meilleure = math.inf
    for (x1, y1), (x2, y2) in zip(exterieur, exterieur[1:]):
        ax, ay = (x1 - longitude) * kx, (y1 - latitude) * ky
        bx, by = (x2 - longitude) * kx, (y2 - latitude) * ky
        dx, dy = bx - ax, by - ay
        longueur2 = dx * dx + dy * dy
        t = 0.0 if longueur2 == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / longueur2))
        meilleure = min(meilleure, math.hypot(ax + t * dx, ay + t * dy))
    return meilleure


def region_depuis_gps(latitude, longitude):
    """Slug de la région administrative (voir apps.core.regions.Region) contenant ce point
    GPS, ou None s'il est hors du Sénégal. Les contours officiels sont la référence ; un point
    à moins de TOLERANCE_HORS_CONTOUR_METRES d'un contour est rattaché à la région la plus proche."""
    if latitude is None or longitude is None:
        return None
    regions = _contours_regions()
    for slug, (lon_min, lat_min, lon_max, lat_max), polygones in regions:
        if lon_min <= longitude <= lon_max and lat_min <= latitude <= lat_max:
            if any(_dans_polygone(longitude, latitude, polygone) for polygone in polygones):
                return slug

    delta_latitude, delta_longitude = boite_englobante(latitude, longitude, TOLERANCE_HORS_CONTOUR_METRES)
    plus_proche, distance_min = None, TOLERANCE_HORS_CONTOUR_METRES
    for slug, (lon_min, lat_min, lon_max, lat_max), polygones in regions:
        if not (lon_min - delta_longitude <= longitude <= lon_max + delta_longitude
                and lat_min - delta_latitude <= latitude <= lat_max + delta_latitude):
            continue
        for polygone in polygones:
            distance = _distance_metres_au_contour(latitude, longitude, polygone)
            if distance <= distance_min:
                plus_proche, distance_min = slug, distance
    return plus_proche
