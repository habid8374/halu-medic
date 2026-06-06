from django.db import migrations, models
import django.db.models.deletion
import uuid
from django.conf import settings


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('pacientes', '0001_initial'),
        ('historia', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='MedicamentoFarmacia',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('nombre_generico', models.CharField(max_length=200)),
                ('nombre_comercial', models.CharField(blank=True, max_length=200)),
                ('cum', models.CharField(blank=True, help_text='Código único de medicamentos INVIMA', max_length=20)),
                ('forma_farmaceutica', models.CharField(blank=True, help_text='Tableta, solución, ampolla, etc.', max_length=100)),
                ('concentracion', models.CharField(blank=True, help_text='ej: 500mg, 10mg/ml', max_length=100)),
                ('via_administracion', models.CharField(blank=True, max_length=50)),
                ('clase_riesgo', models.CharField(blank=True, help_text='A, B, C, D, X (categoría embarazo)', max_length=10)),
                ('requiere_formula', models.BooleanField(default=False)),
                ('medicamento_alto_riesgo', models.BooleanField(default=False, help_text='Insulina, anticoagulantes, etc.')),
                ('activo', models.BooleanField(default=True)),
                ('stock_minimo', models.PositiveIntegerField(default=10, help_text='Alerta de stock bajo')),
                ('stock_actual', models.IntegerField(default=0)),
                ('unidad_medida', models.CharField(default='und', help_text='und, ml, mg, g', max_length=20)),
                ('precio_unitario', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('ubicacion_bodega', models.CharField(blank=True, max_length=100)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('actualizado_en', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Medicamento farmacia',
                'verbose_name_plural': 'Medicamentos farmacia',
                'ordering': ['nombre_generico'],
            },
        ),
        migrations.CreateModel(
            name='LoteInventario',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('numero_lote', models.CharField(max_length=50)),
                ('fecha_vencimiento', models.DateField()),
                ('cantidad_inicial', models.PositiveIntegerField()),
                ('cantidad_actual', models.IntegerField(default=0)),
                ('precio_compra', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('proveedor', models.CharField(blank=True, max_length=200)),
                ('registro_invima', models.CharField(blank=True, max_length=50)),
                ('estado', models.CharField(
                    choices=[
                        ('disponible', 'Disponible'),
                        ('agotado', 'Agotado'),
                        ('vencido', 'Vencido'),
                        ('retirado', 'Retirado del mercado'),
                    ],
                    default='disponible',
                    max_length=15,
                )),
                ('fecha_ingreso', models.DateField(auto_now_add=True)),
                ('medicamento', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='lotes',
                    to='farmacia.medicamentofarmacia',
                )),
                ('ingresado_por', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='lotes_ingresados',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Lote inventario',
                'ordering': ['fecha_vencimiento'],
            },
        ),
        migrations.CreateModel(
            name='MovimientoInventario',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('tipo', models.CharField(
                    choices=[
                        ('entrada', 'Entrada (compra/donación)'),
                        ('salida', 'Salida (dispensación)'),
                        ('ajuste_pos', 'Ajuste positivo'),
                        ('ajuste_neg', 'Ajuste negativo'),
                        ('devolucion', 'Devolución paciente'),
                        ('vencimiento', 'Baja por vencimiento'),
                        ('traslado', 'Traslado entre servicios'),
                    ],
                    max_length=15,
                )),
                ('cantidad', models.IntegerField(help_text='Positivo=entrada, negativo=salida')),
                ('stock_resultante', models.IntegerField()),
                ('motivo', models.CharField(blank=True, max_length=300)),
                ('referencia', models.CharField(blank=True, help_text='Nro. orden compra, dispensación, etc.', max_length=100)),
                ('fecha_hora', models.DateTimeField(auto_now_add=True)),
                ('medicamento', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='movimientos',
                    to='farmacia.medicamentofarmacia',
                )),
                ('lote', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    to='farmacia.loteinventario',
                )),
                ('usuario', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='movimientos_inventario',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Movimiento inventario',
                'ordering': ['-fecha_hora'],
            },
        ),
        migrations.CreateModel(
            name='DispensacionMedicamento',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('cantidad', models.PositiveIntegerField()),
                ('dosis', models.CharField(blank=True, max_length=50)),
                ('frecuencia', models.CharField(blank=True, max_length=50)),
                ('via_administracion', models.CharField(blank=True, max_length=50)),
                ('duracion_dias', models.PositiveIntegerField(blank=True, null=True)),
                ('estado', models.CharField(
                    choices=[
                        ('pendiente', 'Pendiente'),
                        ('dispensado', 'Dispensado'),
                        ('devuelto', 'Devuelto'),
                        ('cancelado', 'Cancelado'),
                    ],
                    default='pendiente',
                    max_length=15,
                )),
                ('observaciones', models.TextField(blank=True)),
                ('fecha_prescripcion', models.DateTimeField(auto_now_add=True)),
                ('fecha_dispensacion', models.DateTimeField(blank=True, null=True)),
                ('valor_total', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('paciente', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='dispensaciones',
                    to='pacientes.paciente',
                )),
                ('ingreso', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='dispensaciones',
                    to='historia.ingreso',
                )),
                ('medicamento', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='dispensaciones',
                    to='farmacia.medicamentofarmacia',
                )),
                ('lote', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    to='farmacia.loteinventario',
                )),
                ('medico_prescriptor', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='prescripciones_dispensadas',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('dispensado_por', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='dispensaciones_realizadas',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Dispensación medicamento',
                'ordering': ['-fecha_prescripcion'],
            },
        ),
    ]
