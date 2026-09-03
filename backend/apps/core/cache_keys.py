"""Clés de cache partagées entre apps (évite les imports croisés entre modules views)."""

CACHE_CLE_ZONES_ACTIVES = 'zones_validees_actives'
CACHE_TTL_ZONES_ACTIVES_SECONDES = 60
