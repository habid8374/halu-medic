from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('historia', '0001_initial'),
        ('pacientes', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='EquipoEsterilizable',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('codigo', models.CharField(max_length=30, unique=True)),
                ('nombre', models.CharField(max_length=200)),
                ('tipo', models.CharField(
                    choices=[
                        ('instrumental', 'Instrumental quirúrgico'),
                        ('endoscopia', 'Endoscopio'),
                        ('textil', 'Textil/Ropa quirúrgica'),
                        ('contenedor', 'Contenedor/Caja'),
                        ('otro', 'Otro'),
                    ],
                    max_length=15,
                )),
                ('servicio_propietario', models.CharField(blank=True, max_length=100)),
                ('cantidad_unidades', models.PositiveIntegerField(default=1)),
                ('material', models.CharField(blank=True, help_text='Acero inox, silicona, etc.', max_length=100)),
                ('activo', models.BooleanField(default=True)),
            ],
            options={
                'verbose_name': 'Equipo esterilizable',
                'ordering': ['nombre'],
            },
        ),
        migrations.CreateModel(
            name='CicloEsterilizacion',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('numero_ciclo', models.PositiveIntegerField(editable=False)),
                ('metodo', models.CharField(
                    choices=[
                        ('autoclave_vapor', 'Autoclave a vapor (134°C)'),
                        ('autoclave_ETO', 'Óxido de etileno (ETO)'),
                        ('plasma_peroxido', 'Plasma de peróxido de hidrógeno'),
                        ('glutaraldehido', 'Glutaraldehído 2%'),
                        ('calor_seco', 'Calor seco (horno Pasteur)'),
                        ('otro', 'Otro'),
                    ],
                    max_length=25,
                )),
                ('equipo_autoclave', models.CharField(blank=True, help_text='Nombre/serial del autoclave', max_length=100)),
                ('temperatura_programada', models.DecimalField(blank=True, decimal_places=1, max_digits=5, null=True)),
                ('presion_programada', models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True)),
                ('tiempo_ciclo_min', models.PositiveIntegerField(blank=True, null=True)),
                ('fecha_hora_inicio', models.DateTimeField()),
                ('fecha_hora_fin', models.DateTimeField(blank=True, null=True)),
                ('resultado', models.CharField(
                    choices=[
                        ('aprobado', 'Aprobado'),
                        ('rechazado', 'Rechazado — reprocesar'),
                        ('en_proceso', 'En proceso'),
                    ],
                    default='en_proceso',
                    max_length=15,
                )),
                ('indicador_biologico', models.CharField(
                    choices=[('positivo', 'Positivo'), ('negativo', 'Negativo'), ('pendiente', 'Pendiente')],
                    default='pendiente',
                    max_length=15,
                )),
                ('indicador_quimico', models.CharField(
                    choices=[('aprobado', 'Aprobado'), ('fallido', 'Fallido')],
                    default='aprobado',
                    max_length=15,
                )),
                ('lote_esterilizacion', models.CharField(blank=True, max_length=30)),
                ('observaciones', models.TextField(blank=True)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('equipos', models.ManyToManyField(related_name='ciclos', to='operaciones.equipoesterilizable')),
                ('operador', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='ciclos_esterilizacion',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Ciclo de esterilización',
                'ordering': ['-fecha_hora_inicio'],
            },
        ),
        migrations.CreateModel(
            name='EquipoBiomedico',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('codigo_inventario', models.CharField(max_length=30, unique=True)),
                ('nombre', models.CharField(max_length=200)),
                ('marca', models.CharField(blank=True, max_length=100)),
                ('modelo', models.CharField(blank=True, max_length=100)),
                ('serial', models.CharField(blank=True, max_length=100)),
                ('tipo', models.CharField(
                    choices=[
                        ('diagnostico', 'Diagnóstico'),
                        ('terapeutico', 'Terapéutico'),
                        ('apoyo', 'Apoyo vital'),
                        ('laboratorio', 'Laboratorio'),
                        ('imagenologia', 'Imagenología'),
                        ('rehabilitacion', 'Rehabilitación'),
                        ('otro', 'Otro'),
                    ],
                    max_length=20,
                )),
                ('servicio', models.CharField(blank=True, max_length=100)),
                ('ubicacion', models.CharField(blank=True, max_length=200)),
                ('fecha_adquisicion', models.DateField(blank=True, null=True)),
                ('valor_adquisicion', models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                ('vida_util_anos', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('registro_invima', models.CharField(blank=True, max_length=50)),
                ('proveedor', models.CharField(blank=True, max_length=200)),
                ('contacto_proveedor', models.CharField(blank=True, max_length=200)),
                ('frecuencia_mant_preventivo_meses', models.PositiveSmallIntegerField(default=6)),
                ('ultimo_mantenimiento', models.DateField(blank=True, null=True)),
                ('proximo_mantenimiento', models.DateField(blank=True, null=True)),
                ('estado', models.CharField(
                    choices=[
                        ('operativo', 'Operativo'),
                        ('en_mantenimiento', 'En mantenimiento'),
                        ('fuera_servicio', 'Fuera de servicio'),
                        ('dado_baja', 'Dado de baja'),
                    ],
                    default='operativo',
                    max_length=20,
                )),
                ('observaciones', models.TextField(blank=True)),
            ],
            options={
                'verbose_name': 'Equipo biomédico',
                'ordering': ['nombre'],
            },
        ),
        migrations.CreateModel(
            name='OrdenMantenimiento',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('numero_orden', models.PositiveIntegerField(editable=False)),
                ('tipo', models.CharField(
                    choices=[
                        ('preventivo', 'Preventivo'),
                        ('correctivo', 'Correctivo'),
                        ('calibracion', 'Calibración'),
                        ('instalacion', 'Instalación'),
                    ],
                    max_length=15,
                )),
                ('descripcion_falla', models.TextField(blank=True)),
                ('actividades_realizadas', models.TextField(blank=True)),
                ('repuestos_utilizados', models.TextField(blank=True)),
                ('tecnico', models.CharField(blank=True, max_length=200)),
                ('empresa_externa', models.CharField(blank=True, max_length=200)),
                ('costo', models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ('fecha_solicitud', models.DateTimeField(auto_now_add=True)),
                ('fecha_inicio', models.DateTimeField(blank=True, null=True)),
                ('fecha_fin', models.DateTimeField(blank=True, null=True)),
                ('equipo_operativo_post', models.BooleanField(default=True)),
                ('estado', models.CharField(
                    choices=[
                        ('abierta', 'Abierta'),
                        ('en_proceso', 'En proceso'),
                        ('completada', 'Completada'),
                        ('cancelada', 'Cancelada'),
                    ],
                    default='abierta',
                    max_length=15,
                )),
                ('equipo', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='ordenes_mantenimiento',
                    to='operaciones.equipobiomedico',
                )),
                ('solicitado_por', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='ordenes_mant_solicitadas',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Orden de mantenimiento',
                'ordering': ['-fecha_solicitud'],
            },
        ),
        migrations.CreateModel(
            name='DietaTerapeutica',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('tipo_dieta', models.CharField(
                    choices=[
                        ('normal', 'Normal/Libre'),
                        ('blanda', 'Blanda'),
                        ('liquida', 'Líquida'),
                        ('licuada', 'Licuada'),
                        ('hipocalorica', 'Hipocalórica'),
                        ('hipercalorica', 'Hipercalórica'),
                        ('hiposodica', 'Hiposódica'),
                        ('diabetica', 'Diabética'),
                        ('renal', 'Renal'),
                        ('hepatica', 'Hepática'),
                        ('npo', 'NPO — Nada por vía oral'),
                        ('otro', 'Otra'),
                    ],
                    max_length=20,
                )),
                ('via_administracion', models.CharField(
                    choices=[
                        ('oral', 'Oral'),
                        ('sonda_ng', 'Sonda nasogástrica'),
                        ('sonda_peg', 'Sonda PEG/yeyunal'),
                        ('parenteral', 'Nutrición parenteral'),
                    ],
                    default='oral',
                    max_length=15,
                )),
                ('calorias_dia', models.PositiveIntegerField(blank=True, help_text='Kcal/día prescritas', null=True)),
                ('proteinas_g', models.DecimalField(blank=True, decimal_places=1, max_digits=6, null=True)),
                ('restricciones', models.TextField(blank=True, help_text='Alimentos restringidos, alergias alimentarias')),
                ('suplementos', models.TextField(blank=True)),
                ('observaciones', models.TextField(blank=True)),
                ('fecha_inicio', models.DateField()),
                ('fecha_fin', models.DateField(blank=True, null=True)),
                ('activa', models.BooleanField(default=True)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('ingreso', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='dietas',
                    to='historia.ingreso',
                )),
                ('medico_prescriptor', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='dietas_prescritas',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('nutricionista', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='dietas_asignadas',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('paciente', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='dietas',
                    to='pacientes.paciente',
                )),
            ],
            options={
                'verbose_name': 'Dieta terapéutica',
                'ordering': ['-creado_en'],
            },
        ),
    ]
