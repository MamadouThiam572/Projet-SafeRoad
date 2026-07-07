from django.contrib import admin

from .models import Alerte, AlerteProximite


@admin.register(Alerte)
class AlerteAdmin(admin.ModelAdmin):
    list_display = ['id', 'incident', 'statut', 'traitee_par', 'date_creation']
    list_filter = ['statut']


@admin.register(AlerteProximite)
class AlerteProximiteAdmin(admin.ModelAdmin):
    list_display = ['id', 'boitier', 'zone', 'distance_metres', 'canal_led', 'canal_buzzer_declenche', 'canal_audio_declenche', 'date_creation']
    list_filter = ['canal_led']
