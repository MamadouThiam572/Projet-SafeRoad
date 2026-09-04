import secrets

from decouple import config
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.comptes.models import Administrateur

# Comptes de démonstration recréés de façon déterministe pour le développement.
# Le mot de passe est fourni via DJANGO_DEMO_PASSWORD, sinon généré aléatoirement et
# affiché une seule fois (même logique que la clé API des boîtiers) : aucun mot de
# passe fixe n'est commité dans le dépôt.

COMPTES = [
    {
        'email': 'admin@saferoad.sn',
        'nom': 'Admin',
        'prenom': 'SafeRoad',
        'role': Administrateur.Role.ADMIN,
        'is_staff': True,
        'is_superuser': True,
    },
    {
        'email': 'anaser.test@saferoad.sn',
        'nom': 'Agent',
        'prenom': 'ANASER',
        'role': Administrateur.Role.ANASER,
        'is_staff': False,
        'is_superuser': False,
    },
]


class Command(BaseCommand):
    help = (
        "Crée (ou met à jour) les comptes de démonstration admin/ANASER de façon "
        "idempotente. Mot de passe via DJANGO_DEMO_PASSWORD, sinon valeur par défaut."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--reinitialiser-mdp',
            action='store_true',
            help="Réinitialise aussi le mot de passe des comptes déjà existants.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError(
                "creer_comptes_demo est réservée au développement (DEBUG=True) : "
                "elle crée des comptes avec un mot de passe affiché en clair."
            )

        # decouple.config lit .env comme le reste du projet (settings.py) — os.environ seul
        # ignorait silencieusement la valeur posée dans .env, il fallait la répéter en
        # préfixe de commande à chaque fois.
        mot_de_passe = config('DJANGO_DEMO_PASSWORD', default='') or secrets.token_urlsafe(12)
        reinitialiser = options['reinitialiser_mdp']

        for spec in COMPTES:
            email = spec['email']
            defauts = {k: v for k, v in spec.items() if k != 'email'}
            compte, cree = Administrateur.objects.get_or_create(email=email, defaults=defauts)

            if cree:
                compte.set_password(mot_de_passe)
                compte.save()
                self.stdout.write(self.style.SUCCESS(f"[créé]      {email} ({compte.role})"))
                continue

            # Compte déjà présent : on réaligne les champs, et le mot de passe si demandé.
            champs_modifies = []
            for champ, valeur in defauts.items():
                if getattr(compte, champ) != valeur:
                    setattr(compte, champ, valeur)
                    champs_modifies.append(champ)
            if reinitialiser:
                compte.set_password(mot_de_passe)
                champs_modifies.append('password')
            if champs_modifies:
                compte.save()
                self.stdout.write(self.style.WARNING(
                    f"[mis à jour] {email} — champs: {', '.join(champs_modifies)}"
                ))
            else:
                self.stdout.write(f"[inchangé]   {email}")

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            f"Mot de passe des comptes de démo : {mot_de_passe}"
        ))
        if not reinitialiser:
            self.stdout.write(
                "Astuce : ajoutez --reinitialiser-mdp pour forcer le mot de passe des comptes existants."
            )
