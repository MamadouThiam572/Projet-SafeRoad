# Explication du diagramme de classes — SafeRoad

Ce document accompagne [`diagramme-classes-saferoad.png`](diagramme-classes-saferoad.png). Il détaille chaque
classe du modèle de données (généré depuis les migrations Django de `backend/apps/`) et la logique métier
derrière les associations.

## 1. Vue d'ensemble

SafeRoad repose sur des **boîtiers connectés** installés sur des véhicules. Ces boîtiers détectent des
**incidents** (choc, freinage brusque, collision, chute) grâce à leurs capteurs (accéléromètre, gyroscope,
radar de vitesse, capteur de distance). Les incidents sont regroupés géographiquement en **zones**
accidentogènes, que les administrateurs valident. L'**ANASER** (Agence Nationale de la Sécurité Routière)
peut ensuite soumettre des retours sur ces zones ou incidents (signalisation, ralentisseur, éclairage...).
Le système génère aussi des **alertes** (internes et de proximité), des **notifications** pour les
administrateurs, et des **statistiques** quotidiennes.

Le modèle compte **10 classes concrètes** réparties sur **9 apps Django**, plus **1 classe abstraite**
(`ModeleHorodate`).

## 2. Convention du diagramme

Toutes les relations sont représentées comme des **associations simples** : une ligne avec une flèche
indiquant le sens de navigation (celui de la clé étrangère), et une cardinalité à chaque extrémité
(`1`, `0..1`, `0..*`). Le comportement `on_delete` de Django (CASCADE / PROTECT / SET_NULL) n'est **pas**
encodé dans le type de trait — c'est un détail d'implémentation, pas une sémantique UML — mais il reste
documenté dans la table de la section 4 pour référence.

Seule `ModeleHorodate` utilise une notation UML dédiée : le triangle creux de l'**héritage**.

## 3. Les classes

### Comptes & Boîtiers

- **`Administrateur`** (*app `comptes`*) — Utilisateur du back-office, avec un rôle `admin` ou `anaser`.
  Sert d'utilisateur Django personnalisé (`AUTH_USER_MODEL`), authentifié par email.
- **`Boitier`** (*app `boitiers`*) — Le dispositif IoT embarqué. Identifié par un UUID, protégé par une clé
  API hashée (`api_key_hash`). Conserve sa dernière position connue et son statut (actif / inactif /
  maintenance).
- **`HistoriqueSync`** (*app `boitiers`*) — Trace chaque synchronisation d'un boîtier avec le serveur
  (nombre d'incidents transmis, succès ou échec).

### Cœur métier

- **`Incident`** (*app `incidents`*) — Un évènement détecté par un boîtier : position, horodatage, type
  (choc violent, freinage brusque, collision, chute, autre), niveau de gravité (faible/moyen/critique), et
  les valeurs brutes des capteurs au moment des faits.
- **`Zone`** (*app `zones`*, hérite de `ModeleHorodate`) — Une zone géographique à risque, calculée par
  clustering des incidents (rayon, score de danger, niveau de danger `normale` / `vigilance` / `critique`).
  Doit être validée par un administrateur (`statut_validation`).

### Alertes

- **`Alerte`** (*app `alertes`*) — Alerte interne créée **uniquement quand un incident est critique**
  (voir signal `creer_alerte_si_critique`). Suivie par un administrateur (nouvelle / vue / traitée).
- **`AlerteProximite`** (*app `alertes`*) — Notification envoyée au boîtier lorsqu'il s'approche d'une zone
  dangereuse. Trace les 3 canaux que le boîtier déclenche localement selon le niveau de danger de la zone :
  - **Visuel** (`canal_led`) — 3 LED : **vert** = situation normale, **jaune** = alerte de vigilance,
    **rouge** = alerte critique.
  - **Buzzer** (`canal_buzzer_declenche`) — sonne par intermittence en vigilance, en continu en critique.
  - **Vocal** (`canal_audio_declenche`) — message parlé via un module DFPlayer, diffusé en français et en
    wolof.
- **`AlerteAnaser`** (*app `anaser`*, hérite de `ModeleHorodate`) — Feedback soumis par l'ANASER sur une
  zone ou un incident, avec une action prévue (signalisation, ralentisseur, éclairage...). Contrainte :
  au moins l'un des deux (`zone` ou `incident`) doit être renseigné.

### Système

- **`ConfigurationSysteme`** (*app `configuration`*) — Singleton (une seule ligne, `pk=1`) contenant les
  seuils système : accélération critique, vitesse de choc, rayon de clustering, rayon d'alerte de
  proximité, etc.
- **`NotificationAdmin`** (*app `notifications`*) — Notification affichée aux administrateurs (incident
  critique, nouvelle zone, zone à valider, échec de synchronisation, feedback ANASER). `destinataire` nul
  = diffusée à tous les administrateurs.
- **`StatistiquesQuotidiennes`** (*app `statistiques`*) — Agrégat quotidien du nombre d'incidents par zone
  et par type, généré par la commande `generer_statistiques`.

### Classe abstraite

- **`ModeleHorodate`** (*app `core`*) — Mixin apportant `date_creation` et `date_maj`. Héritée par `Zone`
  et `AlerteAnaser`.

## 4. Table des associations

| Classe A | Card. A | → | Card. B | Classe B | Champ FK | `on_delete` (Django) |
|---|---|---|---|---|---|---|
| Boitier | 1 | → | 0..* | HistoriqueSync | `boitier` | CASCADE |
| Boitier | 1 | → | 0..* | Incident | `boitier` | PROTECT |
| Boitier | 1 | → | 0..* | AlerteProximite | `boitier` | CASCADE |
| Boitier | 0..1 | → | 0..* | NotificationAdmin | `boitier` | CASCADE (nullable) |
| HistoriqueSync | 0..1 | → | 0..* | Incident | `historique_sync` | SET_NULL |
| Zone | 0..1 | → | 0..* | Incident | `zone` | SET_NULL |
| Zone | 1 | → | 0..* | AlerteProximite | `zone` | CASCADE |
| Zone | 0..1 | → | 0..* | AlerteAnaser | `zone` | CASCADE (nullable) |
| Zone | 0..1 | → | 0..* | NotificationAdmin | `zone` | CASCADE (nullable) |
| Zone | 0..1 | → | 0..* | StatistiquesQuotidiennes | `zone` | CASCADE (nullable) |
| Administrateur | 0..1 | → | 0..* | Zone | `validee_par` | SET_NULL |
| Incident | 1 | → | 0..1 | Alerte | `incident` (OneToOne) | CASCADE |
| Incident | 0..1 | → | 0..* | AlerteAnaser | `incident` | CASCADE (nullable) |
| Incident | 0..1 | → | 0..* | NotificationAdmin | `incident` | CASCADE (nullable) |
| Administrateur | 0..1 | → | 0..* | Alerte | `traitee_par` | SET_NULL |
| Administrateur | 1 | → | 0..* | AlerteAnaser | `auteur` | PROTECT |
| Administrateur | 0..1 | → | 0..* | NotificationAdmin | `destinataire` | CASCADE (nullable) |
| Administrateur | 0..1 | → | 0..1 | ConfigurationSysteme | `modifie_par` | SET_NULL (singleton) |

**Comment lire `on_delete` :**
- `CASCADE` — si le parent est supprimé, la ligne enfant l'est aussi.
- `SET_NULL` — si le parent est supprimé, la clé étrangère de l'enfant est mise à `null` (l'enfant survit).
- `PROTECT` — la suppression du parent est bloquée tant qu'il existe des enfants liés.

## 5. Points particuliers à retenir

- **`ConfigurationSysteme` est un singleton** : sa méthode `save()` force `pk=1`, et `delete()` est
  interdit — il ne peut exister qu'une seule ligne de configuration.
- **`Alerte` n'est pas créée pour chaque incident** : uniquement quand `Incident.niveau_gravite = critique`
  (signal `post_save` sur `Incident`), d'où la cardinalité `0..1` côté `Alerte`.
- **`AlerteAnaser` a une contrainte `CHECK`** (`alerte_anaser_zone_ou_incident_requis`) : `zone` ou
  `incident` doit être non-null — un feedback ANASER ne peut pas flotter sans être rattaché à quelque
  chose.
- **`Boitier` utilise `PROTECT` sur ses incidents** : impossible de supprimer un boîtier tant qu'il a des
  incidents enregistrés, pour ne jamais perdre l'historique d'un accident.
- Les signaux (`apps/alertes/signals.py`, `apps/notifications/signals.py`) créent automatiquement des
  `Alerte` et des `NotificationAdmin` en réaction aux `Incident` critiques, aux nouvelles `Zone` en attente
  de validation, et aux `HistoriqueSync` en échec.
- **Correspondance `niveau_danger` de la zone → canaux du boîtier** (`apps/alertes/utils.py`) : le backend
  rejoue la même règle que le boîtier applique en local, uniquement pour garder un historique/audit côté
  admin.

  | `niveau_danger` (Zone) | `canal_led` | Buzzer / audio DFPlayer |
  |---|---|---|
  | normale | vert | éteints — situation normale |
  | vigilance | jaune | actifs — alerte de vigilance (buzzer intermittent) |
  | critique | rouge | actifs — alerte critique (buzzer continu) |

  Les 3 niveaux de `Zone.niveau_danger` correspondent désormais 1:1 aux 3 états physiques du boîtier
  (le modèle comptait auparavant 4 niveaux — `faible`/`moyen`/`eleve`/`critique` — mais `moyen` et `eleve`
  déclenchaient déjà le même canal `jaune` ; le modèle a été simplifié à 3 niveaux pour refléter fidèlement
  ce que perçoit le conducteur).

  Le modèle ne stocke qu'un booléen (`canal_buzzer_declenche`) : la distinction intermittent/continu est un
  comportement du firmware du boîtier, pas une donnée persistée en base.
