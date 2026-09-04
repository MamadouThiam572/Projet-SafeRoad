from rest_framework.throttling import ScopedRateThrottle


class LoginRateThrottle(ScopedRateThrottle):
    """Limite les tentatives de connexion par IP (voir DEFAULT_THROTTLE_RATES['login'] dans
    settings.py). Le endpoint de login n'avait jusqu'ici aucune protection contre le
    bruteforce — n'importe quel script pouvait tester des mots de passe en boucle contre
    un compte admin connu (admin@saferoad.sn).

    ScopedRateThrottle détermine son scope depuis l'attribut `throttle_scope` de la VUE
    (pas depuis cette classe) : toute vue qui utilise ce throttle doit déclarer
    `throttle_scope = 'login'` — sans quoi le throttle se désactive silencieusement."""
