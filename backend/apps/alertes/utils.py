from apps.zones.models import Zone

# Correspondance niveau_danger de la zone -> canaux déclenchés localement par le boîtier
# (LED verte/jaune/rouge, buzzer, message vocal DFPlayer FR/Wolof). Le boîtier applique cette
# même règle en local dès réception du niveau_danger ; le backend la rejoue ici uniquement pour
# enregistrer un historique/audit côté admin, sans dépendre d'un retour du boîtier.
_CANAL_LED_PAR_NIVEAU = {
    Zone.NiveauDanger.NORMALE: 'vert',
    Zone.NiveauDanger.VIGILANCE: 'jaune',
    Zone.NiveauDanger.CRITIQUE: 'rouge',
}


def determiner_canaux_alerte(niveau_danger):
    canal_led = _CANAL_LED_PAR_NIVEAU.get(niveau_danger, 'vert')
    canal_sonore_actif = canal_led in ('jaune', 'rouge')
    return {
        'canal_led': canal_led,
        'canal_buzzer_declenche': canal_sonore_actif,
        'canal_audio_declenche': canal_sonore_actif,
    }
