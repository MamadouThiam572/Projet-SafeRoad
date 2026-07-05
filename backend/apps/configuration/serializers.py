from rest_framework import serializers

from .models import ConfigurationSysteme


class ConfigurationSystemeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfigurationSysteme
        fields = '__all__'
        read_only_fields = ['id', 'date_maj', 'modifie_par']
