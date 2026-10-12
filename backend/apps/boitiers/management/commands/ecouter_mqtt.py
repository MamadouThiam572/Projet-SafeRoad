import logging
import time
import uuid

import paho.mqtt.client as mqtt
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import close_old_connections

from apps.boitiers.mqtt import traiter_message

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        "Écoute les brokers MQTT des boîtiers (HiveMQ en Wi-Fi, Mosquitto en GSM) et enregistre "
        "positions et incidents. Tourne en continu, à côté du serveur Django ; Ctrl+C pour arrêter. "
        "Réglages : MQTT_* dans le .env (voir .env.example)."
    )

    def add_arguments(self, parser):
        parser.add_argument('--verbeux', action='store_true', help="Affiche chaque message reçu.")

    def handle(self, *args, **options):
        brokers = [broker for broker in settings.MQTT_BROKERS if broker['hote']]
        if not brokers:
            raise CommandError("Aucun broker configuré : renseignez MQTT_HIVEMQ_HOTE et/ou MQTT_MOSQUITTO_HOTE dans le .env.")
        if not settings.MQTT_BOITIER_PAR_DEFAUT:
            self.stdout.write(self.style.WARNING(
                "MQTT_BOITIER_PAR_DEFAUT est vide : les messages sans boitier_id seront ignorés."
            ))
        self.verbeux = options['verbeux']
        clients = [self._demarrer(broker) for broker in brokers]
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            self.stdout.write("Arrêt de l'écoute MQTT.")
        finally:
            for client in clients:
                client.disconnect()
                client.loop_stop()

    def _demarrer(self, broker):
        nom = broker['nom']
        client = mqtt.Client(
            mqtt.CallbackAPIVersion.VERSION2,
            # Identifiant unique : deux clients du même nom se déconnecteraient l'un l'autre.
            client_id=f"saferoad-backend-{nom}-{uuid.uuid4().hex[:8]}",
        )
        if broker['utilisateur']:
            client.username_pw_set(broker['utilisateur'], broker['mot_de_passe'])
        if broker['tls']:
            client.tls_set()
        client.reconnect_delay_set(min_delay=1, max_delay=60)

        def connecte(client, userdata, flags, reason_code, properties):
            if reason_code.is_failure:
                self.stderr.write(f"[{nom}] connexion refusée : {reason_code}")
                return
            for topic in settings.MQTT_TOPICS:
                client.subscribe(topic, qos=1)
            self.stdout.write(self.style.SUCCESS(f"[{nom}] connecté, abonné à {', '.join(settings.MQTT_TOPICS)}"))

        def deconnecte(client, userdata, flags, reason_code, properties):
            self.stderr.write(f"[{nom}] déconnecté ({reason_code}), nouvelle tentative automatique…")

        def message(client, userdata, msg):
            # Chaque message est traité dans le fil du client MQTT : connexions base de données
            # rafraîchies avant et après, et une erreur n'arrête jamais l'écoute.
            close_old_connections()
            try:
                resume = traiter_message(msg.topic, msg.payload)
                if self.verbeux or (resume and resume['incidents']):
                    self.stdout.write(f"[{nom}] {msg.topic} -> {resume}")
            except Exception:
                logger.exception("MQTT : erreur en traitant un message de %s", msg.topic)
            finally:
                close_old_connections()

        client.on_connect = connecte
        client.on_disconnect = deconnecte
        client.on_message = message
        client.connect_async(broker['hote'], broker['port'], keepalive=60)
        client.loop_start()
        self.stdout.write(f"[{nom}] connexion à {broker['hote']}:{broker['port']}…")
        return client
