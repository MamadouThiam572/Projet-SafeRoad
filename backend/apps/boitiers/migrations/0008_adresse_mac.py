from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('boitiers', '0007_derniere_communication'),
    ]

    operations = [
        migrations.AddField(
            model_name='boitier',
            name='adresse_mac',
            field=models.CharField(blank=True, max_length=17, null=True, unique=True),
        ),
    ]
