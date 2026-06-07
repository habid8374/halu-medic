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
            name='Cargo',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('nombre', models.CharField(max_length=200)),
                ('departamento', models.CharField(blank=True, max_length=100)),
                ('nivel', models.CharField(blank=True, help_text='Asistencial, Administrativo, Directivo', max_length=50)),
                ('requiere_tarjeta_prof', models.BooleanField(default=False)),
                ('activo', models.BooleanField(default=True)),
            ],
            options={
                'verbose_name': 'Cargo',
                'ordering': ['nombre'],
            },
        ),
        migrations.CreateModel(
            name='ContratoEmpleado',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('tipo', models.CharField(
                    choices=[
                        ('termino_fijo', 'Término fijo'),
                        ('termino_indefinido', 'Término indefinido'),
                        ('obra_labor', 'Obra o labor'),
                        ('prestacion_servicios', 'Prestación de servicios'),
                        ('aprendizaje', 'Contrato de aprendizaje'),
                    ],
                    max_length=25,
                )),
                ('salario_basico', models.DecimalField(decimal_places=2, max_digits=14)),
                ('auxilio_transporte', models.BooleanField(default=True)),
                ('fecha_inicio', models.DateField()),
                ('fecha_fin', models.DateField(blank=True, null=True)),
                ('estado', models.CharField(
                    choices=[
                        ('activo', 'Activo'),
                        ('vencido', 'Vencido'),
                        ('terminado', 'Terminado'),
                        ('suspendido', 'Suspendido'),
                    ],
                    default='activo',
                    max_length=15,
                )),
                ('numero_contrato', models.CharField(blank=True, max_length=50)),
                ('jornada_horas_semana', models.PositiveSmallIntegerField(default=44)),
                ('eps', models.CharField(blank=True, max_length=200)),
                ('arl', models.CharField(blank=True, max_length=200)),
                ('pension', models.CharField(blank=True, max_length=200)),
                ('caja_compensacion', models.CharField(blank=True, max_length=200)),
                ('observaciones', models.TextField(blank=True)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('cargo', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    to='rrhh.cargo',
                )),
                ('empleado', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='contratos',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Contrato empleado',
                'ordering': ['-fecha_inicio'],
            },
        ),
        migrations.CreateModel(
            name='Turno',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('fecha', models.DateField()),
                ('tipo', models.CharField(
                    choices=[
                        ('manana', 'Mañana'),
                        ('tarde', 'Tarde'),
                        ('noche', 'Noche'),
                        ('rotativo', 'Rotativo'),
                        ('descanso', 'Descanso'),
                    ],
                    max_length=10,
                )),
                ('hora_inicio', models.TimeField(blank=True, null=True)),
                ('hora_fin', models.TimeField(blank=True, null=True)),
                ('servicio', models.CharField(blank=True, max_length=100)),
                ('horas_extras', models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ('novedad', models.CharField(blank=True, help_text='Incapacidad, calamidad, permiso, etc.', max_length=200)),
                ('empleado', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='turnos',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Turno',
                'ordering': ['-fecha'],
            },
        ),
        migrations.AlterUniqueTogether(
            name='turno',
            unique_together={('empleado', 'fecha')},
        ),
        migrations.CreateModel(
            name='LiquidacionNomina',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('periodo_inicio', models.DateField()),
                ('periodo_fin', models.DateField()),
                ('salario_basico', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('auxilio_transporte', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('horas_extras_diurnas', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('horas_extras_nocturnas', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('otros_devengados', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('total_devengado', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('descuento_salud', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('descuento_pension', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('descuento_fondo_solidaridad', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('otros_descuentos', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('total_descuentos', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('neto_pagar', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('estado', models.CharField(
                    choices=[('borrador', 'Borrador'), ('aprobada', 'Aprobada'), ('pagada', 'Pagada')],
                    default='borrador',
                    max_length=15,
                )),
                ('observaciones', models.TextField(blank=True)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('contrato', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    to='rrhh.contratoempelado',
                )),
                ('empleado', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='liquidaciones',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Liquidación nómina',
                'ordering': ['-periodo_fin'],
            },
        ),
        migrations.CreateModel(
            name='Incapacidad',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('tipo', models.CharField(
                    choices=[
                        ('enfermedad_general', 'Enfermedad general'),
                        ('accidente_trabajo', 'Accidente de trabajo'),
                        ('enfermedad_profesional', 'Enfermedad profesional'),
                        ('maternidad', 'Maternidad/Paternidad'),
                        ('licencia', 'Licencia'),
                    ],
                    max_length=25,
                )),
                ('fecha_inicio', models.DateField()),
                ('fecha_fin', models.DateField()),
                ('dias', models.PositiveIntegerField()),
                ('diagnostico_cie10', models.CharField(blank=True, max_length=10)),
                ('medico_expide', models.CharField(blank=True, max_length=200)),
                ('entidad_paga', models.CharField(
                    choices=[('eps', 'EPS'), ('arl', 'ARL'), ('empleador', 'Empleador')],
                    default='eps',
                    max_length=15,
                )),
                ('observaciones', models.TextField(blank=True)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('empleado', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='incapacidades',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Incapacidad',
                'ordering': ['-fecha_inicio'],
            },
        ),
    ]
