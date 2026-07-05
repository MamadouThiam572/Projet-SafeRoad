from django.db import models


class ModeleHorodate(models.Model):
    date_creation = models.DateTimeField(auto_now_add=True)
    date_maj = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
