from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalogos", "0003_cups_rips_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="CatalogoMedicamento",
            fields=[
                ("cum", models.CharField(
                    help_text="Código Único de Medicamento (expediente INVIMA)",
                    max_length=20, primary_key=True, serialize=False,
                )),
                ("principio_activo", models.CharField(max_length=400)),
                ("concentracion", models.CharField(
                    blank=True,
                    help_text="Cantidad + unidad de medida + unidad de referencia",
                    max_length=150,
                )),
                ("forma_farmaceutica", models.CharField(blank=True, max_length=150)),
                ("registro_sanitario", models.CharField(
                    blank=True,
                    help_text="Ej: INVIMA 2022M-0002654-R3",
                    max_length=60,
                )),
                ("vigente", models.BooleanField(
                    default=True,
                    help_text="False si el registro está vencido",
                )),
            ],
            options={
                "verbose_name": "Medicamento (catálogo CUM)",
                "verbose_name_plural": "Medicamentos (catálogo CUM)",
                "ordering": ["principio_activo"],
            },
        ),
        migrations.AddIndex(
            model_name="catalogomedicamento",
            index=models.Index(fields=["principio_activo"], name="catalogos_p_princip_idx"),
        ),
        migrations.AddIndex(
            model_name="catalogomedicamento",
            index=models.Index(fields=["vigente"], name="catalogos_m_vigente_idx"),
        ),
    ]
