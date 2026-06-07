from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='CuentaContable',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('codigo', models.CharField(max_length=20, unique=True)),
                ('nombre', models.CharField(max_length=200)),
                ('tipo', models.CharField(
                    choices=[
                        ('activo', 'Activo'),
                        ('pasivo', 'Pasivo'),
                        ('patrimonio', 'Patrimonio'),
                        ('ingreso', 'Ingreso'),
                        ('gasto', 'Gasto'),
                        ('costo', 'Costo'),
                    ],
                    max_length=15,
                )),
                ('naturaleza', models.CharField(
                    choices=[('debito', 'Débito'), ('credito', 'Crédito')],
                    max_length=7,
                )),
                ('activa', models.BooleanField(default=True)),
                ('cuenta_padre', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='subcuentas',
                    to='contabilidad.cuentacontable',
                )),
            ],
            options={
                'verbose_name': 'Cuenta contable',
                'ordering': ['codigo'],
            },
        ),
        migrations.CreateModel(
            name='AsientoContable',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('numero', models.PositiveIntegerField(editable=False)),
                ('tipo', models.CharField(
                    choices=[
                        ('ingreso', 'Ingreso'),
                        ('egreso', 'Egreso'),
                        ('traslado', 'Traslado'),
                        ('ajuste', 'Ajuste'),
                        ('apertura', 'Apertura'),
                        ('cierre', 'Cierre'),
                    ],
                    max_length=15,
                )),
                ('fecha', models.DateField()),
                ('descripcion', models.CharField(max_length=300)),
                ('referencia', models.CharField(blank=True, help_text='Nro. factura, recibo, etc.', max_length=100)),
                ('estado', models.CharField(
                    choices=[('borrador', 'Borrador'), ('aprobado', 'Aprobado'), ('anulado', 'Anulado')],
                    default='borrador',
                    max_length=10,
                )),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('creado_por', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='asientos_contables',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Asiento contable',
                'ordering': ['-fecha', '-numero'],
            },
        ),
        migrations.CreateModel(
            name='LineaAsiento',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('descripcion', models.CharField(blank=True, max_length=200)),
                ('debito', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('credito', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('asiento', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='lineas',
                    to='contabilidad.asientocontable',
                )),
                ('cuenta', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='lineas',
                    to='contabilidad.cuentacontable',
                )),
            ],
            options={
                'verbose_name': 'Línea asiento',
            },
        ),
        migrations.CreateModel(
            name='PresupuestoAnual',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('ano', models.PositiveSmallIntegerField()),
                ('nombre', models.CharField(max_length=200)),
                ('total_ingresos_presupuestados', models.DecimalField(decimal_places=2, default=0, max_digits=16)),
                ('total_gastos_presupuestados', models.DecimalField(decimal_places=2, default=0, max_digits=16)),
                ('estado', models.CharField(
                    choices=[
                        ('borrador', 'Borrador'),
                        ('aprobado', 'Aprobado'),
                        ('ejecutando', 'Ejecutando'),
                        ('cerrado', 'Cerrado'),
                    ],
                    default='borrador',
                    max_length=15,
                )),
                ('observaciones', models.TextField(blank=True)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('aprobado_por', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='presupuestos_aprobados',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Presupuesto anual',
                'ordering': ['-ano'],
            },
        ),
    ]
