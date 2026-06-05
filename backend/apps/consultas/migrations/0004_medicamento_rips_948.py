from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Agrega dias_tratamiento y valor_dispensacion a Medicamento.
    vrDispensacion es obligatorio desde 1 julio 2026 (Res. 948/2026).
    """

    dependencies = [
        ("consultas", "0003_consulta_via_ingreso_orden_medica"),
    ]

    operations = [
        migrations.AddField(
            model_name="medicamento",
            name="dias_tratamiento",
            field=models.PositiveIntegerField(
                default=1,
                help_text="Días de tratamiento (RIPS)",
            ),
        ),
        migrations.AddField(
            model_name="medicamento",
            name="valor_dispensacion",
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text="Costo dispensación separado del medicamento (Res.948 Jul-2026)",
                max_digits=14,
            ),
        ),
    ]
