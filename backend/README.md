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

## Tâches planifiées

Deux commandes doivent tourner automatiquement :

| Commande | Fréquence | Rôle |
| --- | --- | --- |
| `verifier_boitiers_hors_ligne` | toutes les 5 min | alerte « boîtier hors ligne » (délai réglable dans la configuration) |
| `generer_statistiques --jours 3` | chaque nuit | statistiques quotidiennes ; `--jours 3` rattrape les nuits où la machine était éteinte |

Sur un poste Windows (PostgreSQL doit tourner, la tâche s'exécute quand la session est ouverte) :

```powershell
$py = "C:\chemin\vers\backend\venv\Scripts\python.exe"
$manage = "C:\chemin\vers\backend\manage.py"
schtasks /Create /TN "SafeRoad\BoitiersHorsLigne" /SC MINUTE /MO 5 /TR "`"$py`" `"$manage`" verifier_boitiers_hors_ligne"
schtasks /Create /TN "SafeRoad\Statistiques" /SC DAILY /ST 00:30 /TR "`"$py`" `"$manage`" generer_statistiques --jours 3"
```

Sur un serveur Linux (`crontab -e`) :

```cron
*/5 * * * *  /chemin/venv/bin/python /chemin/backend/manage.py verifier_boitiers_hors_ligne
30 0 * * *   /chemin/venv/bin/python /chemin/backend/manage.py generer_statistiques --jours 3
```

## Structure

- `apps/comptes` — authentification JWT (admin / ANASER), modèle `Administrateur`, mots de passe
- `apps/conducteurs` — comptes conducteurs (inscription, connexion, profil)
- `apps/incidents`, `apps/zones` — détection, traitement et validation des zones (technique puis ANASER)
- `apps/boitiers` — boîtiers embarqués (clé API hachée), affectation aux conducteurs
- `apps/signalements` — dangers signalés par les conducteurs (photo protégée)
- `apps/demandes` — demandes d'installation et messages de contact du site public
- `apps/statistiques`, `apps/alertes`, `apps/notifications`, `apps/anaser`
