from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('historia', '0012_liquidacioncirugia_procedimientoliquidacion'),
    ]

    operations = [
        migrations.AddField(
            model_name='egreso',
            name='indicaciones_alta',
            field=models.TextField(blank=True, help_text='Indicaciones de alta: medicamentos, cuidados, cita control'),
        ),
    ]
