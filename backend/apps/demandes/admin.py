from django.contrib import admin

from .models import DemandeInstallation, HistoriqueDemande, MessageContact


@admin.register(DemandeInstallation)
class DemandeInstallationAdmin(admin.ModelAdmin):
    list_display = ['id', 'prenom', 'nom', 'telephone', 'region', 'commune', 'type_vehicule', 'statut', 'rdv_date']
    list_filter = ['statut', 'region', 'type_vehicule']


@admin.register(HistoriqueDemande)
class HistoriqueDemandeAdmin(admin.ModelAdmin):
    list_display = ['id', 'demande', 'statut_precedent', 'statut_nouveau', 'acteur', 'date']


@admin.register(MessageContact)
class MessageContactAdmin(admin.ModelAdmin):
    list_display = ['id', 'nom', 'email', 'sujet', 'traite', 'date_creation']
    list_filter = ['sujet', 'traite']
