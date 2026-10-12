from .models import Incident


def position_gps_fiable(config, hdop, nombre_satellites):
    """Une position est douteuse si le module GPS voit trop peu de satellites ou si son HDOP
    est trop élevé (tunnel, bâtiments, démarrage à froid). Une donnée absente (firmware qui ne
    l'envoie pas encore) n'est pas une preuve de mauvaise qualité : elle ne déclasse rien."""
    if nombre_satellites is not None and nombre_satellites < config.gps_satellites_min:
        return False
    if hdop is not None and hdop > config.gps_hdop_max:
        return False
    return True


def gravite_pour(type_incident):
    """Gravité d'un incident d'après le type classé par le boîtier (Incident.GRAVITE_PAR_TYPE)."""
    return Incident.GRAVITE_PAR_TYPE.get(type_incident, Incident.NiveauGravite.FAIBLE)
