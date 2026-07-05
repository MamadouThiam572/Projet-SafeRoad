from rest_framework import serializers

from .models import StatistiquesQuotidiennes


class StatistiquesQuotidiennesSerializer(serializers.ModelSerializer):
    class Meta:
        model = StatistiquesQuotidiennes
        fields = '__all__'
        read_only_fields = [f.name for f in StatistiquesQuotidiennes._meta.fields]
