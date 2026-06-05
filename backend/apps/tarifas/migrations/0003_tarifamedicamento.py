import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("tarifas", "0002_manualtarifario_itemtarifario"),
    ]

    operations = [
        migrations.CreateModel(
            name="TarifaMedicamento",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("manual", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="medicamentos",
                    to="tarifas.manualtarifario",
                )),
                ("cum", models.CharField(help_text="Código Único de Medicamento", max_length=20)),
                ("principio_activo", models.CharField(max_length=400)),
                ("concentracion", models.CharField(blank=True, max_length=150)),
                ("forma_farmaceutica", models.CharField(blank=True, max_length=150)),
                ("valor_base", models.DecimalField(
                    decimal_places=2, max_digits=14,
                    help_text="Valor unitario base del medicamento",
                )),
                ("valor_dispensacion", models.DecimalField(
                    decimal_places=2, default=0, max_digits=14,
                    help_text="Valor de dispensación (Res.948/2026)",
                )),
                ("vigente", models.BooleanField(default=True)),
            ],
            options={
                "verbose_name": "Tarifa medicamento",
                "verbose_name_plural": "Tarifas medicamentos",
                "ordering": ["principio_activo"],
            },
        ),
        migrations.AlterUniqueTogether(
            name="tarifamedicamento",
            unique_together={("manual", "cum")},
        ),
    ]
