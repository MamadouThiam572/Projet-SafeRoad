from rest_framework.pagination import PageNumberPagination


class PaginationListeGestion(PageNumberPagination):
    """15 éléments/page — listes de gestion interne (boîtiers, alertes, feedbacks ANASER).

    Pagination *optionnelle*, activée uniquement si `?page=` est présent dans la requête :
    le tableau de bord et les compteurs de la sidebar consomment ces mêmes endpoints pour
    calculer des totaux (ex. alertes « nouvelles ») en comptant sur la liste complète —
    les paginer inconditionnellement aurait tronqué ces totaux à la première page dès
    qu'une liste dépasse 15 éléments. Le tableau paginé de l'admin appelle donc l'API avec
    `?page=1`, tandis que dashboard/compteurs continuent d'appeler sans paramètre et
    reçoivent la liste complète, exactement comme avant.

    Volontairement PAS utilisée sur ZoneViewSet : la carte publique a besoin du jeu
    complet de zones validées en un seul appel (voir apps/zones/views.py).
    """

    page_size = 15

    def paginate_queryset(self, queryset, request, view=None):
        if 'page' not in request.query_params:
            return None
        return super().paginate_queryset(queryset, request, view)
