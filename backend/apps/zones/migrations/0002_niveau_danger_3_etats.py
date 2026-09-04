from django.db import migrations, models

REMAP_VERS_3_ETATS = {
    'faible': 'normale',
    'moyen': 'vigilance',
    'eleve': 'vigilance',
    'critique': 'critique',
}

REMAP_VERS_4_ETATS = {
    'normale': 'faible',
    'vigilance': 'moyen',
    'critique': 'critique',
}


def remap_vers_3_etats(apps, schema_editor):
    Zone = apps.get_model('zones', 'Zone')
    for ancien, nouveau in REMAP_VERS_3_ETATS.items():
        if ancien != nouveau:
            Zone.objects.filter(niveau_danger=ancien).update(niveau_danger=nouveau)


def remap_vers_4_etats(apps, schema_editor):
    Zone = apps.get_model('zones', 'Zone')
    for nouveau, ancien in REMAP_VERS_4_ETATS.items():
        if ancien != nouveau:
            Zone.objects.filter(niveau_danger=nouveau).update(niveau_danger=ancien)


class Migration(migrations.Migration):

    dependencies = [
        ('zones', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(remap_vers_3_etats, remap_vers_4_etats),
        migrations.AlterField(
            model_name='zone',
            name='niveau_danger',
            field=models.CharField(
                choices=[('normale', 'Normale'), ('vigilance', 'Vigilance'), ('critique', 'Critique')],
                default='normale',
                max_length=10,
            ),
        ),
    ]
