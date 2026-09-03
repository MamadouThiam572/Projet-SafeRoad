from rest_framework.filters import BaseFilterBackend


def appliquer_filtre_regional(queryset, utilisateur, region_lookup_field='region'):
    """Restreint `queryset` à la région d'un administrateur régional.

    - `super_admin` : portée nationale, aucune restriction — y compris quand region=None,
      son état normal (voir Administrateur.erreur_coherence_role_region, étape 1).
    - `admin` (administrateur régional) : restreint à `region_lookup_field=utilisateur.region`.
      Sans région assignée, ne devient JAMAIS national par défaut — queryset vide, un
      comportement sûr et explicite plutôt qu'une fuite de données accidentelle.
    - tout autre rôle (notamment `anaser`) : comportement actuel conservé, aucune
      restriction régionale appliquée à ce stade (voir étude d'architecture).

    `region_lookup_field` permet de réutiliser cette même fonction pour un modèle qui
    porte directement sa région (ex. Boitier.region) comme pour un modèle qui la déduit
    d'une relation (ex. 'boitier__region' pour un futur Incident) — chaque app décidera du
    chemin approprié dans ses propres étapes de régionalisation, pas ici.
    """
    role = getattr(utilisateur, 'role', None)

    if role == 'super_admin':
        return queryset
    if role != 'admin':
        return queryset

    region = getattr(utilisateur, 'region', None)
    if not region:
        return queryset.none()

    return queryset.filter(**{region_lookup_field: region})


class FiltreRegional(BaseFilterBackend):
    """Backend DRF réutilisable autour de `appliquer_filtre_regional` : une vue l'active via
    `filter_backends = [FiltreRegional]` et déclare optionnellement `region_lookup_field`
    sur elle-même (défaut : 'region'). Lit exclusivement `request.user.region` — jamais une
    valeur fournie par le client (paramètre de requête, corps, etc.), pour qu'un
    administrateur régional ne puisse jamais élargir son accès en la falsifiant.

    Non branché sur un ViewSet à cette étape : le mécanisme est préparé, son application
    aux ViewSets métier (Boitier, Incident, Alerte, AlerteProximite, Zone, Statistiques)
    est traitée dans les étapes suivantes."""

    def filter_queryset(self, request, queryset, view):
        champ = getattr(view, 'region_lookup_field', 'region')
        return appliquer_filtre_regional(queryset, request.user, champ)
