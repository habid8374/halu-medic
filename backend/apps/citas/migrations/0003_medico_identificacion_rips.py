from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Agrega tipo_identificacion y numero_identificacion al médico.
    Requeridos en cada línea de servicios del RIPS (Res. 948/2026).
    """

    dependencies = [
        ("citas", "0002_medico_nullable"),
    ]

    operations = [
        migrations.AddField(
            model_name="medico",
            name="tipo_identificacion",
            field=models.CharField(
                choices=[
                    ("CC", "Cédula de ciudadanía"),
                    ("CE", "Cédula de extranjería"),
                    ("PA", "Pasaporte"),
                    ("NIT", "NIT"),
                ],
                default="CC",
                help_text="Tipo documento para RIPS",
                max_length=5,
            ),
        ),
        migrations.AddField(
            model_name="medico",
            name="numero_identificacion",
            field=models.CharField(
                blank=True,
                help_text="Número documento para RIPS",
                max_length=30,
            ),
        ),
    ]
