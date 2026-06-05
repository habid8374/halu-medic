import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("pacientes", "0002_paciente_tarifa"),
        ("tarifas", "0002_manualtarifario_itemtarifario"),
    ]

    operations = [
        migrations.AddField(
            model_name="aseguradora",
            name="tarifario",
            field=models.ForeignKey(
                blank=True,
                help_text="Tarifario base para facturar a esta aseguradora",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="aseguradoras",
                to="tarifas.manualtarifario",
            ),
        ),
    ]
