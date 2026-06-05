import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("facturacion", "0001_initial"),
        ("tarifas", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="FacturaPGP",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("convenio", models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name="facturas_pgp",
                    to="tarifas.convenioeps",
                )),
                ("periodo_desde", models.DateField()),
                ("periodo_hasta", models.DateField()),
                ("descripcion_contrato", models.TextField(
                    help_text="Ej: Contrato PGP que comprende el mes de mayo del 1 al 31 de mayo de 2026"
                )),
                ("numero_contrato_eps", models.CharField(
                    blank=True, max_length=100,
                    help_text="Número de contrato en el sistema de la EPS (diferente al CUCON)"
                )),
                ("valor_total", models.DecimalField(decimal_places=2, max_digits=14)),
                ("numero_factus", models.CharField(blank=True, max_length=50)),
                ("cufe", models.CharField(blank=True, max_length=200)),
                ("qr_url", models.TextField(blank=True)),
                ("pdf_base64", models.TextField(blank=True)),
                ("xml_base64", models.TextField(blank=True)),
                ("rango_numeracion_id", models.IntegerField(blank=True, null=True)),
                ("rips_json", models.JSONField(blank=True, null=True)),
                ("cuv", models.CharField(blank=True, max_length=100)),
                ("estado", models.CharField(
                    choices=[
                        ("borrador", "Borrador"),
                        ("enviada", "Enviada a Factus"),
                        ("validada", "Validada por DIAN"),
                        ("error", "Error de validación"),
                        ("anulada", "Anulada (nota crédito)"),
                    ],
                    default="borrador",
                    max_length=20,
                )),
                ("errores_dian", models.JSONField(blank=True, default=list)),
                ("observaciones", models.TextField(blank=True)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                ("actualizado_en", models.DateTimeField(auto_now=True)),
                ("fecha_validacion", models.DateTimeField(blank=True, null=True)),
            ],
            options={"ordering": ["-creado_en"]},
        ),
        migrations.AddIndex(
            model_name="facturapgp",
            index=models.Index(fields=["estado"], name="facturapgp_estado_idx"),
        ),
        migrations.AddIndex(
            model_name="facturapgp",
            index=models.Index(fields=["numero_factus"], name="facturapgp_numero_idx"),
        ),
    ]
