import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("historia", "0002_alter_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="MedicamentoHC",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("historia", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="medicamentos",
                    to="historia.historiaclinica",
                )),
                ("cum", models.CharField(help_text="Código Único de Medicamento (CUM)", max_length=20)),
                ("principio_activo", models.CharField(max_length=400)),
                ("concentracion", models.CharField(blank=True, max_length=150)),
                ("forma_farmaceutica", models.CharField(blank=True, max_length=150)),
                ("dosis", models.CharField(blank=True, help_text="Ej: 500 mg", max_length=100)),
                ("frecuencia", models.CharField(blank=True, help_text="Ej: cada 8 horas", max_length=100)),
                ("via_administracion", models.CharField(
                    choices=[
                        ("oral", "Oral"), ("iv", "Intravenosa"), ("im", "Intramuscular"),
                        ("sc", "Subcutánea"), ("topica", "Tópica"), ("inhalatoria", "Inhalatoria"),
                        ("sublingual", "Sublingual"), ("rectal", "Rectal"), ("oftalmica", "Oftálmica"),
                        ("otica", "Ótica"), ("nasal", "Nasal"), ("otra", "Otra"),
                    ],
                    default="oral", max_length=20,
                )),
                ("cantidad", models.PositiveIntegerField(default=1)),
                ("dias_tratamiento", models.PositiveIntegerField(default=1)),
                ("indicaciones", models.TextField(blank=True)),
                ("genera_factura", models.BooleanField(default=False)),
                ("valor_unitario", models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ("valor_dispensacion", models.DecimalField(
                    decimal_places=2, default=0, max_digits=14,
                    help_text="Valor dispensación separado (Res.948)",
                )),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "verbose_name": "Medicamento HC",
                "verbose_name_plural": "Medicamentos HC",
                "ordering": ["creado_en"],
            },
        ),
    ]
