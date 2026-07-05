from django.db import migrations


def creer_configuration_initiale(apps, schema_editor):
    ConfigurationSysteme = apps.get_model('configuration', 'ConfigurationSysteme')
    ConfigurationSysteme.objects.get_or_create(pk=1)


def supprimer_configuration_initiale(apps, schema_editor):
    ConfigurationSysteme = apps.get_model('configuration', 'ConfigurationSysteme')
    ConfigurationSysteme.objects.filter(pk=1).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('configuration', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(creer_configuration_initiale, supprimer_configuration_initiale),
    ]
