# SafeRoad — Backend (Django + DRF)

API de la plateforme de prévention routière SafeRoad.

## Démarrage

```bash
cd backend
python -m venv venv
venv/Scripts/activate            # Windows
pip install -r requirements.txt
cp .env.example .env             # puis ajuster les valeurs
python manage.py migrate
python manage.py runserver 8000
```

L'API écoute sur http://localhost:8000, le frontend Vite sur http://localhost:5173.

## Comptes de démonstration

**Ne créez jamais les comptes à la main dans le shell.** Une commande idempotente
les (re)crée de façon reproductible :

```bash
python manage.py creer_comptes_demo                     # crée / réaligne les comptes
python manage.py creer_comptes_demo --reinitialiser-mdp # force aussi le mot de passe
```

| Rôle          | Email                     |
| ------------- | ------------------------- |
| Administrateur | `admin@saferoad.sn`       |
| Agent ANASER   | `anaser.test@saferoad.sn` |

Le mot de passe est fourni via `DJANGO_DEMO_PASSWORD` (voir `.env.example`), sinon généré
aléatoirement et affiché une seule fois dans la sortie de la commande — aucun mot de passe
n'est codé en dur dans le dépôt. La commande refuse de s'exécuter si `DEBUG=False`.
Elle est **idempotente** : la rejouer ne duplique rien et réaligne les champs.

## Données de démonstration

```bash
python manage.py generer_zones          # recalcule les zones (clustering DBSCAN des incidents)
python manage.py generer_statistiques   # agrège les statistiques publiques
```

## Structure

- `apps/comptes` — authentification JWT (admin / ANASER), modèle `Administrateur`
- `apps/incidents`, `apps/zones` — détection et cartographie des points noirs
- `apps/boitiers` — boîtiers embarqués (clé API hachée)
- `apps/statistiques`, `apps/alertes`, `apps/notifications`, `apps/anaser`
