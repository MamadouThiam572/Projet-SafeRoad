import math

from .models import Incident


def calculer_gravite(config, vitesse_radar, acceleration_x, acceleration_y, acceleration_z):
    """Détermine le niveau de gravité d'un incident à partir des seuils de ConfigurationSysteme.

    Heuristique simple pour un prototype de mémoire : un incident est CRITIQUE si la vitesse
    d'impact (radar HB100) ou la magnitude d'accélération (MPU6050) dépasse le seuil configuré ;
    MOYEN à la moitié de ce seuil ; FAIBLE sinon.
    """
    magnitude_acceleration = None
    if acceleration_x is not None and acceleration_y is not None and acceleration_z is not None:
        magnitude_acceleration = math.sqrt(acceleration_x**2 + acceleration_y**2 + acceleration_z**2)

    depasse_critique = (
        (vitesse_radar is not None and vitesse_radar >= config.seuil_vitesse_choc)
        or (magnitude_acceleration is not None and magnitude_acceleration >= config.seuil_acceleration_critique)
    )
    if depasse_critique:
        return Incident.NiveauGravite.CRITIQUE

    depasse_moyen = (
        (vitesse_radar is not None and vitesse_radar >= config.seuil_vitesse_choc / 2)
        or (magnitude_acceleration is not None and magnitude_acceleration >= config.seuil_acceleration_critique / 2)
    )
    if depasse_moyen:
        return Incident.NiveauGravite.MOYEN

    return Incident.NiveauGravite.FAIBLE
