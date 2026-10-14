from rest_framework import serializers

from .models import AlerteAnaser


class AlerteAnaserSerializer(serializers.ModelSerializer):
    action_prevue_libelle = serializers.CharField(source='get_action_prevue_display', read_only=True)
    statut_libelle = serializers.CharField(source='get_statut_display', read_only=True)
    cible_libelle = serializers.SerializerMethodField()
    auteur_nom = serializers.SerializerMethodField()

    def get_cible_libelle(self, obj):
        """« Zone RN1 km 45 (Dakar) » ou « Incident #12 — Freinage brusque (Thiès) »."""
        if obj.zone_id:
            region = obj.zone.get_region_display() if obj.zone.region else None
            return f"{obj.zone}{f' ({region})' if region else ''}"
        incident = obj.incident
        region = incident.boitier.get_region_display() if incident.boitier.region else None
        return f"Incident #{incident.pk} — {incident.get_type_incident_display()}{f' ({region})' if region else ''}"

    def get_auteur_nom(self, obj):
        return f"{obj.auteur.prenom} {obj.auteur.nom}".strip()

    class Meta:
        model = AlerteAnaser
        fields = '__all__'
        read_only_fields = ['id', 'auteur', 'date_creation', 'date_maj']

    def validate(self, attrs):
        zone = attrs.get('zone') or getattr(self.instance, 'zone', None)
        incident = attrs.get('incident') or getattr(self.instance, 'incident', None)
        if not zone and not incident:
            raise serializers.ValidationError("Une zone ou un incident doit être renseigné.")
        return attrs
