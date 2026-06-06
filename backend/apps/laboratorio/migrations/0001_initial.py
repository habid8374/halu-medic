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
            name='PanelLaboratorio',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('nombre', models.CharField(max_length=200)),
                ('cups', models.CharField(blank=True, max_length=10)),
                ('categoria', models.CharField(blank=True, help_text='Hematología, Química, Microbiología, etc.', max_length=100)),
                ('activo', models.BooleanField(default=True)),
            ],
            options={
                'verbose_name': 'Panel de laboratorio',
                'ordering': ['nombre'],
            },
        ),
        migrations.CreateModel(
            name='SolicitudLaboratorio',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('urgente', models.BooleanField(default=False)),
                ('examenes', models.JSONField(default=list, help_text='[{cups, nombre, indicacion}]')),
                ('indicacion_clinica', models.TextField(blank=True)),
                ('diagnostico_cie10', models.CharField(blank=True, max_length=10)),
                ('estado', models.CharField(
                    choices=[
                        ('solicitada', 'Solicitada'),
                        ('tomada', 'Muestra tomada'),
                        ('proceso', 'En proceso'),
                        ('resultado', 'Con resultado'),
                        ('cancelada', 'Cancelada'),
                    ],
                    default='solicitada',
                    max_length=15,
                )),
                ('fecha_solicitud', models.DateTimeField(auto_now_add=True)),
                ('fecha_toma_muestra', models.DateTimeField(blank=True, null=True)),
                ('observaciones', models.TextField(blank=True)),
                ('paciente', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='solicitudes_lab',
                    to='pacientes.paciente',
                )),
                ('ingreso', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='solicitudes_lab',
                    to='historia.ingreso',
                )),
                ('medico_solicitante', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='solicitudes_lab',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('tomado_por', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='muestras_tomadas',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Solicitud laboratorio',
                'ordering': ['-fecha_solicitud'],
            },
        ),
        migrations.CreateModel(
            name='ResultadoLaboratorio',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('cups', models.CharField(blank=True, max_length=10)),
                ('nombre_examen', models.CharField(max_length=200)),
                ('valor', models.CharField(help_text='Valor del resultado como texto', max_length=100)),
                ('unidad', models.CharField(blank=True, max_length=50)),
                ('valor_referencia_min', models.DecimalField(blank=True, decimal_places=4, max_digits=12, null=True)),
                ('valor_referencia_max', models.DecimalField(blank=True, decimal_places=4, max_digits=12, null=True)),
                ('valor_referencia_texto', models.CharField(blank=True, help_text='Para resultados cualitativos', max_length=200)),
                ('estado_resultado', models.CharField(
                    blank=True,
                    choices=[
                        ('N', 'Normal'), ('A', 'Alto'), ('B', 'Bajo'),
                        ('C', 'Crítico'), ('P', 'Positivo'), ('N2', 'Negativo'),
                    ],
                    max_length=10,
                )),
                ('interpretacion', models.TextField(blank=True)),
                ('metodo', models.CharField(blank=True, max_length=100)),
                ('equipo', models.CharField(blank=True, max_length=100)),
                ('fecha_resultado', models.DateTimeField()),
                ('validado', models.BooleanField(default=False)),
                ('solicitud', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='resultados',
                    to='laboratorio.solicitudlaboratorio',
                )),
                ('laboratorista', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='resultados_lab',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('validado_por', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='resultados_validados',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Resultado laboratorio',
                'ordering': ['nombre_examen'],
            },
        ),
    ]
