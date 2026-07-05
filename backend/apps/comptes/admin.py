from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Administrateur


@admin.register(Administrateur)
class AdministrateurAdmin(UserAdmin):
    model = Administrateur
    ordering = ['email']
    list_display = ['email', 'nom', 'prenom', 'role', 'is_active', 'is_staff']
    list_filter = ['role', 'is_active', 'is_staff']
    search_fields = ['email', 'nom', 'prenom']
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Informations personnelles', {'fields': ('nom', 'prenom', 'role')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Dates', {'fields': ('derniere_connexion',)}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'nom', 'prenom', 'role', 'password1', 'password2'),
        }),
    )
    readonly_fields = ['derniere_connexion']
