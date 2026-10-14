from rest_framework import serializers

from .models import ConfigurationSysteme


class ConfigurationSystemeSerializer(serializers.ModelSerializer):
    modifie_par_nom = serializers.SerializerMethodField()

    def get_modifie_par_nom(self, obj):
        return f"{obj.modifie_par.prenom} {obj.modifie_par.nom}".strip() if obj.modifie_par else None

    class Meta:
        model = ConfigurationSysteme
        fields = '__all__'
        read_only_fields = ['id', 'date_maj', 'modifie_par']
