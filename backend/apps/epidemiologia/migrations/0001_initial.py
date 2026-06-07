from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


EVENTOS_SIVIGILA = [
    ('dengue', 'Dengue'),
    ('malaria', 'Malaria'),
    ('tuberculosis', 'Tuberculosis'),
    ('vih_sida', 'VIH/SIDA'),
    ('hepatitis_a', 'Hepatitis A'),
    ('hepatitis_b', 'Hepatitis B'),
    ('hepatitis_c', 'Hepatitis C'),
    ('leptospirosis', 'Leptospirosis'),
    ('leishmaniasis', 'Leishmaniasis'),
    ('chagas', 'Enfermedad de Chagas'),
    ('rabia', 'Rabia'),
    ('influenza', 'Influenza/Gripe'),
    ('covid19', 'COVID-19'),
    ('varicela', 'Varicela'),
    ('sarampion', 'Sarampión'),
    ('rubeola', 'Rubéola'),
    ('parotiditis', 'Parotiditis'),
    ('tosferina', 'Tosferina'),
    ('tetanos', 'Tétanos'),
    ('meningitis', 'Meningitis bacteriana'),
    ('sifilis', 'Sífilis congénita/gestacional'),
    ('gonorrea', 'Gonorrea'),
    ('ira', 'IRA/Neumonía'),
    ('eda', 'EDA/Diarrea'),
    ('intoxicacion', 'Intoxicación alimentaria/química'),
    ('violencia', 'Violencia/Maltrato'),
    ('accidente_laboral', 'Accidente laboral'),
    ('otro', 'Otro evento de notificación obligatoria'),
]


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('pacientes', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='NotificacionSIVIGILA',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('evento', models.CharField(choices=EVENTOS_SIVIGILA, max_length=30)),
                ('codigo_sivigila', models.CharField(blank=True, help_text='Código del evento en SIVIGILA', max_length=10)),
                ('clasificacion', models.CharField(
                    choices=[
                        ('sospechoso', 'Caso sospechoso'),
                        ('probable', 'Caso probable'),
                        ('confirmado', 'Caso confirmado'),
                        ('descartado', 'Descartado'),
                    ],
                    default='sospechoso',
                    max_length=15,
                )),
                ('tipo_notificacion', models.CharField(
                    choices=[
                        ('inmediata', 'Inmediata (< 24h)'),
                        ('semanal', 'Semanal'),
                        ('periodo', 'Por período'),
                    ],
                    default='semanal',
                    max_length=15,
                )),
                ('fecha_inicio_sintomas', models.DateField(blank=True, null=True)),
                ('fecha_consulta', models.DateField()),
                ('fecha_notificacion', models.DateField(blank=True, null=True)),
                ('semana_epidemiologica', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('municipio_residencia', models.CharField(blank=True, help_text='Código DANE municipio', max_length=10)),
                ('municipio_ocurrencia', models.CharField(blank=True, max_length=10)),
                ('hospitalizado', models.BooleanField(default=False)),
                ('fallecio', models.BooleanField(default=False)),
                ('fuente_infeccion', models.TextField(blank=True)),
                ('datos_complementarios', models.JSONField(blank=True, default=dict, help_text='Campos específicos del evento')),
                ('estado', models.CharField(
                    choices=[
                        ('borrador', 'Borrador'),
                        ('notificada', 'Notificada al SIVIGILA'),
                        ('confirmada', 'Confirmada'),
                        ('descartada', 'Descartada'),
                    ],
                    default='borrador',
                    max_length=15,
                )),
                ('numero_sivigila', models.CharField(blank=True, help_text='Número asignado por SIVIGILA', max_length=30)),
                ('observaciones', models.TextField(blank=True)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('actualizado_en', models.DateTimeField(auto_now=True)),
                ('notificado_por', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='notificaciones_sivigila',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('paciente', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='notificaciones_sivigila',
                    to='pacientes.paciente',
                )),
            ],
            options={
                'verbose_name': 'Notificación SIVIGILA',
                'verbose_name_plural': 'Notificaciones SIVIGILA',
                'ordering': ['-fecha_consulta'],
            },
        ),
        migrations.AddIndex(
            model_name='notificacionsivigila',
            index=models.Index(fields=['evento', 'estado'], name='epidemiolog_evento_estado_idx'),
        ),
        migrations.AddIndex(
            model_name='notificacionsivigila',
            index=models.Index(fields=['semana_epidemiologica'], name='epidemiolog_semana_idx'),
        ),
        migrations.CreateModel(
            name='BrotEpidemico',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('evento', models.CharField(choices=EVENTOS_SIVIGILA, max_length=30)),
                ('descripcion', models.TextField()),
                ('fecha_inicio', models.DateField()),
                ('fecha_control', models.DateField(blank=True, null=True)),
                ('numero_casos', models.PositiveIntegerField(default=0)),
                ('numero_fallecidos', models.PositiveIntegerField(default=0)),
                ('municipio', models.CharField(blank=True, max_length=200)),
                ('medidas_control', models.TextField(blank=True)),
                ('estado', models.CharField(
                    choices=[('activo', 'Activo'), ('controlado', 'Controlado'), ('cerrado', 'Cerrado')],
                    default='activo',
                    max_length=15,
                )),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('responsable', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='brotes_epidemicos',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('notificaciones', models.ManyToManyField(
                    blank=True,
                    related_name='brotes',
                    to='epidemiologia.notificacionsivigila',
                )),
            ],
            options={
                'verbose_name': 'Brote epidémico',
                'ordering': ['-fecha_inicio'],
            },
        ),
    ]
