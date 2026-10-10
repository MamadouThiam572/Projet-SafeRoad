"""Envoi de SMS, sur le même principe que les e-mails de Django : le fournisseur se choisit
dans les réglages (SMS_BACKEND), sans toucher au code qui envoie.

- 'console' (défaut) : le SMS est affiché dans le terminal du serveur — développement ;
- 'memoire' : conservé dans `boite_sms` — tests automatiques ;
- 'orange' : API SMS d'Orange (developer.orange.com), avec ORANGE_SMS_CLIENT_ID,
  ORANGE_SMS_CLIENT_SECRET et ORANGE_SMS_EXPEDITEUR (ex. +221770000000) dans le .env.
  À valider avec un vrai compte : ce chemin n'a pas encore pu être testé.
"""

import base64
import json
import logging
from urllib.parse import quote
from urllib.request import Request, urlopen

from django.conf import settings

logger = logging.getLogger(__name__)

# SMS envoyés avec le backend 'memoire' : [(numero, message), ...]
boite_sms = []


def envoyer_sms(numero, message):
    """Envoie un SMS ; une panne du fournisseur est journalisée sans faire échouer l'appelant
    (l'alerte reste visible dans l'application quoi qu'il arrive)."""
    fournisseur = getattr(settings, 'SMS_BACKEND', 'console')
    try:
        if fournisseur == 'memoire':
            boite_sms.append((numero, message))
        elif fournisseur == 'orange':
            _envoyer_orange(numero, message)
        else:
            print(f"--- SMS vers {numero} ---\n{message}\n---", flush=True)
    except Exception:
        logger.exception("Échec de l'envoi du SMS vers %s", numero)


def _envoyer_orange(numero, message):
    identifiants = f"{settings.ORANGE_SMS_CLIENT_ID}:{settings.ORANGE_SMS_CLIENT_SECRET}".encode()
    requete_jeton = Request(
        'https://api.orange.com/oauth/v3/token', data=b'grant_type=client_credentials', method='POST',
        headers={'Authorization': 'Basic ' + base64.b64encode(identifiants).decode(),
                 'Content-Type': 'application/x-www-form-urlencoded'},
    )
    with urlopen(requete_jeton, timeout=10) as reponse:
        jeton = json.load(reponse)['access_token']

    expediteur = f"tel:{settings.ORANGE_SMS_EXPEDITEUR}"
    corps = {'outboundSMSMessageRequest': {
        'address': f"tel:{numero}", 'senderAddress': expediteur,
        'outboundSMSTextMessage': {'message': message},
    }}
    requete_envoi = Request(
        f"https://api.orange.com/smsmessaging/v1/outbound/{quote(expediteur, safe='')}/requests",
        data=json.dumps(corps).encode(), method='POST',
        headers={'Authorization': f'Bearer {jeton}', 'Content-Type': 'application/json'},
    )
    with urlopen(requete_envoi, timeout=10):
        pass
