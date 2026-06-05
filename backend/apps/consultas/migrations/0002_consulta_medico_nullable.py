from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('consultas', '0001_initial'),
        ('citas', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='consulta',
            name='medico',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='consultas',
                to='citas.medico',
            ),
        ),
    ]
