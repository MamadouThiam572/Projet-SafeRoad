import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models

STATUTS = [
    ('proposee', 'Proposée'),
    ('en_verification', 'En vérification'),
    ('validee_technique', 'Validée techniquement'),
    ('soumise_anaser', 'Soumise à ANASER'),
    ('reconnue', 'Reconnue par ANASER'),
    ('rejetee', 'Rejetée'),
    ('archivee', 'Archivée'),
]

# Ancien workflow à une étape -> nouveau. Une zone déjà « validée » était publique sur la
# carte : elle devient « reconnue » pour rester publique (et continuer d'alerter les boîtiers).
CORRESPONDANCE = {'en_attente': 'proposee', 'validee': 'reconnue', 'rejetee': 'rejetee'}


def convertir_statuts(apps, schema_editor):
    Zone = apps.get_model('zones', 'Zone')
    HistoriqueStatutZone = apps.get_model('zones', 'HistoriqueStatutZone')
    for zone in Zone.objects.all():
        ancien = zone.statut_validation
        zone.statut_validation = CORRESPONDANCE.get(ancien, 'proposee')
        zone.save(update_fields=['statut_validation'])
        # Conserve la trace de l'ancienne décision avant de supprimer validee_par/validee_le.
        if zone.validee_par_id:
            HistoriqueStatutZone.objects.create(
                zone=zone, statut_precedent='proposee', statut_nouveau=zone.statut_validation,
                acteur_id=zone.validee_par_id, role_acteur=zone.validee_par.role,
                commentaire="Décision reprise de l'ancien workflow de validation à une étape.",
                date=zone.validee_le or django.utils.timezone.now(),
            )


def restaurer_statuts(apps, schema_editor):
    Zone = apps.get_model('zones', 'Zone')
    inverse = {'proposee': 'en_attente', 'reconnue': 'validee', 'rejetee': 'rejetee'}
    for zone in Zone.objects.all():
        zone.statut_validation = inverse.get(zone.statut_validation, 'en_attente')
        zone.save(update_fields=['statut_validation'])


class Migration(migrations.Migration):

    dependencies = [
        ('zones', '0004_zone_region'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name='zone',
            name='statut_validation',
            field=models.CharField(choices=STATUTS, default='proposee', max_length=20),
        ),
        migrations.CreateModel(
            name='HistoriqueStatutZone',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('statut_precedent', models.CharField(choices=STATUTS, max_length=20)),
                ('statut_nouveau', models.CharField(choices=STATUTS, max_length=20)),
                ('role_acteur', models.CharField(max_length=15)),
                ('commentaire', models.TextField(blank=True)),
                ('date', models.DateTimeField(default=django.utils.timezone.now)),
                ('acteur', models.ForeignKey(
                    null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='decisions_zones', to=settings.AUTH_USER_MODEL,
                )),
                ('zone', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='historique_statuts', to='zones.zone',
                )),
            ],
            options={'ordering': ['date', 'id']},
        ),
        migrations.RunPython(convertir_statuts, restaurer_statuts),
        migrations.RemoveField(model_name='zone', name='validee_par'),
        migrations.RemoveField(model_name='zone', name='validee_le'),
    ]
