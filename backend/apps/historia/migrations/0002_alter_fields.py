from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('historia', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='egreso',
            name='diagnostico_egreso',
            field=models.CharField(blank=True, help_text='CIE-10', max_length=10),
        ),
        migrations.AlterField(
            model_name='historiaclinica',
            name='signos_vitales',
            field=models.JSONField(
                blank=True, null=True,
                help_text='{"pa_sistolica":120,"pa_diastolica":80,"fc":72,"fr":16,"temperatura":36.5,"peso":70,"talla":170,"spo2":98}',
            ),
        ),
        migrations.AlterField(
            model_name='ingreso',
            name='activo',
            field=models.BooleanField(default=True, help_text='False = paciente egresado'),
        ),
    ]
