import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('citas', '0001_initial'),
        ('consultas', '0001_initial'),
        ('pacientes', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Ingreso',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('numero_ingreso', models.PositiveIntegerField(editable=False)),
                ('paciente', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='ingresos',
                    to='pacientes.paciente',
                )),
                ('medico', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='ingresos',
                    to='citas.medico',
                )),
                ('fecha_ingreso', models.DateTimeField()),
                ('motivo_ingreso', models.TextField()),
                ('tipo_atencion', models.CharField(
                    choices=[
                        ('consulta_externa', 'Consulta externa'),
                        ('urgencias', 'Urgencias'),
                        ('hospitalizacion', 'Hospitalización'),
                        ('procedimiento', 'Procedimiento'),
                    ],
                    default='consulta_externa',
                    max_length=20,
                )),
                ('observaciones', models.TextField(blank=True)),
                ('activo', models.BooleanField(default=True)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
            ],
            options={'ordering': ['-fecha_ingreso']},
        ),
        migrations.AddIndex(
            model_name='ingreso',
            index=models.Index(fields=['paciente', 'activo'], name='ingreso_pac_activo_idx'),
        ),
        migrations.AddIndex(
            model_name='ingreso',
            index=models.Index(fields=['numero_ingreso'], name='ingreso_numero_idx'),
        ),
        migrations.CreateModel(
            name='Egreso',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('ingreso', models.OneToOneField(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='egreso',
                    to='historia.ingreso',
                )),
                ('fecha_egreso', models.DateTimeField()),
                ('tipo_egreso', models.CharField(
                    choices=[
                        ('alta_medica', 'Alta médica'),
                        ('traslado', 'Traslado'),
                        ('voluntario', 'Retiro voluntario'),
                        ('fallecimiento', 'Fallecimiento'),
                        ('fuga', 'Fuga'),
                    ],
                    default='alta_medica',
                    max_length=20,
                )),
                ('medico', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    to='citas.medico',
                )),
                ('diagnostico_egreso', models.CharField(blank=True, max_length=10)),
                ('descripcion_diagnostico', models.CharField(blank=True, max_length=300)),
                ('condicion_al_egreso', models.TextField(blank=True)),
                ('observaciones', models.TextField(blank=True)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
            ],
            options={'ordering': ['-fecha_egreso']},
        ),
        migrations.CreateModel(
            name='HistoriaClinica',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('paciente', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='historias',
                    to='pacientes.paciente',
                )),
                ('ingreso', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='historias',
                    to='historia.ingreso',
                )),
                ('consulta', models.OneToOneField(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='historia',
                    to='consultas.consulta',
                )),
                ('medico', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    to='citas.medico',
                )),
                ('fecha_atencion', models.DateTimeField()),
                ('tipo_registro', models.CharField(
                    choices=[
                        ('consulta', 'Consulta'),
                        ('urgencias', 'Urgencias'),
                        ('hospitalizacion', 'Hospitalización'),
                        ('procedimiento', 'Procedimiento'),
                        ('evolucion', 'Nota de evolución'),
                        ('interconsulta', 'Interconsulta'),
                    ],
                    default='consulta',
                    max_length=20,
                )),
                ('motivo_consulta', models.TextField(blank=True)),
                ('anamnesis', models.TextField(blank=True)),
                ('enfermedad_actual', models.TextField(blank=True)),
                ('signos_vitales', models.JSONField(blank=True, null=True)),
                ('examen_fisico', models.TextField(blank=True)),
                ('impresion_diagnostica', models.TextField(blank=True)),
                ('diagnostico_principal', models.CharField(blank=True, max_length=10)),
                ('diagnostico_relacionado_1', models.CharField(blank=True, max_length=10)),
                ('diagnostico_relacionado_2', models.CharField(blank=True, max_length=10)),
                ('plan_tratamiento', models.TextField(blank=True)),
                ('ordenes_medicas', models.TextField(blank=True)),
                ('observaciones', models.TextField(blank=True)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('actualizado_en', models.DateTimeField(auto_now=True)),
            ],
            options={'ordering': ['-fecha_atencion']},
        ),
        migrations.AddIndex(
            model_name='historiaclinica',
            index=models.Index(fields=['paciente', 'fecha_atencion'], name='hc_pac_fecha_idx'),
        ),
    ]
