from django.db import migrations, models
import django.db.models.deletion
import uuid
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ('historia', '0006_triage_verificacion_anestesia_consentimiento_enfermeria'),
        ('pacientes', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── ReferenciaPaciente ────────────────────────────────────────────────
        migrations.CreateModel(
            name='ReferenciaPaciente',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('tipo', models.CharField(
                    choices=[
                        ('referencia', 'Referencia (envío a otra IPS)'),
                        ('contrareferencia', 'Contrareferencia (respuesta de regreso)'),
                        ('interconsulta', 'Interconsulta interna'),
                    ],
                    default='referencia',
                    max_length=20,
                )),
                ('institucion_origen', models.CharField(blank=True, max_length=300)),
                ('codigo_habilitacion_origen', models.CharField(blank=True, max_length=20)),
                ('institucion_destino', models.CharField(max_length=300)),
                ('codigo_habilitacion_destino', models.CharField(blank=True, max_length=20)),
                ('servicio_destino', models.CharField(blank=True, help_text='Especialidad o servicio al que se refiere', max_length=200)),
                ('diagnostico_cie10', models.CharField(blank=True, max_length=10)),
                ('descripcion_diagnostico', models.CharField(blank=True, max_length=300)),
                ('motivo_referencia', models.TextField(help_text='Motivo clínico de la referencia')),
                ('resumen_clinico', models.TextField(blank=True, help_text='Resumen del caso, tratamiento recibido')),
                ('examenes_adjuntos', models.TextField(blank=True, help_text='Lista de exámenes que acompañan al paciente')),
                ('medicamentos_actuales', models.TextField(blank=True)),
                ('prioridad', models.CharField(
                    choices=[
                        ('inmediata', 'Inmediata (< 1 hora)'),
                        ('urgente', 'Urgente (< 6 horas)'),
                        ('prioritaria', 'Prioritaria (< 24 horas)'),
                        ('no_urgente', 'No urgente (programada)'),
                    ],
                    default='urgente',
                    max_length=15,
                )),
                ('estado', models.CharField(
                    choices=[
                        ('generada', 'Generada'),
                        ('enviada', 'Enviada / en tránsito'),
                        ('aceptada', 'Aceptada por IPS receptora'),
                        ('rechazada', 'Rechazada por IPS receptora'),
                        ('respondida', 'Respondida (contrareferencia recibida)'),
                        ('anulada', 'Anulada'),
                    ],
                    default='generada',
                    max_length=15,
                )),
                ('numero_autorizacion', models.CharField(blank=True, max_length=60)),
                ('requiere_ambulancia', models.BooleanField(default=False)),
                ('tipo_transporte', models.CharField(blank=True, max_length=50)),
                ('respuesta_diagnostico', models.TextField(blank=True)),
                ('respuesta_tratamiento', models.TextField(blank=True)),
                ('respuesta_recomendaciones', models.TextField(blank=True)),
                ('medico_responde', models.CharField(blank=True, max_length=200)),
                ('fecha_respuesta', models.DateTimeField(blank=True, null=True)),
                ('motivo_rechazo', models.TextField(blank=True)),
                ('fecha_referencia', models.DateTimeField(auto_now_add=True)),
                ('paciente', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='referencias',
                    to='pacientes.paciente',
                )),
                ('ingreso', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='referencias',
                    to='historia.ingreso',
                )),
                ('medico_remitente', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='referencias_generadas',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('creado_por', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='referencias_creadas',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Referencia / Contrareferencia',
                'verbose_name_plural': 'Referencias / Contrareferencias',
                'ordering': ['-fecha_referencia'],
            },
        ),

        # ── PlanRehabilitacion ────────────────────────────────────────────────
        migrations.CreateModel(
            name='PlanRehabilitacion',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('tipo_terapia', models.CharField(
                    choices=[
                        ('fisioterapia', 'Fisioterapia'),
                        ('ocupacional', 'Terapia ocupacional'),
                        ('fonoaudiologia', 'Fonoaudiología / Terapia del lenguaje'),
                        ('psicologia', 'Psicología clínica'),
                        ('nutricion', 'Nutrición y dietética'),
                        ('trabajo_social', 'Trabajo social'),
                    ],
                    max_length=20,
                )),
                ('diagnostico_cie10', models.CharField(blank=True, max_length=10)),
                ('descripcion_diagnostico', models.CharField(blank=True, max_length=300)),
                ('objetivo_general', models.TextField(help_text='Objetivo terapéutico principal')),
                ('objetivos_especificos', models.TextField(blank=True)),
                ('numero_sesiones_prescritas', models.PositiveIntegerField(default=10)),
                ('frecuencia_semanal', models.PositiveSmallIntegerField(default=3, help_text='Sesiones por semana')),
                ('estado', models.CharField(
                    choices=[
                        ('activo', 'Activo'),
                        ('completado', 'Completado'),
                        ('suspendido', 'Suspendido'),
                        ('cancelado', 'Cancelado'),
                    ],
                    default='activo',
                    max_length=15,
                )),
                ('fecha_inicio', models.DateField()),
                ('fecha_fin_estimada', models.DateField(blank=True, null=True)),
                ('observaciones', models.TextField(blank=True)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('paciente', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='planes_rehabilitacion',
                    to='pacientes.paciente',
                )),
                ('ingreso', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='planes_rehabilitacion',
                    to='historia.ingreso',
                )),
                ('terapeuta', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='planes_asignados',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('medico_prescriptor', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='planes_prescritos',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Plan de rehabilitación',
                'ordering': ['-creado_en'],
            },
        ),

        # ── SesionRehabilitacion ──────────────────────────────────────────────
        migrations.CreateModel(
            name='SesionRehabilitacion',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('numero_sesion', models.PositiveIntegerField()),
                ('fecha_hora', models.DateTimeField()),
                ('duracion_minutos', models.PositiveIntegerField(default=45)),
                ('actividades_realizadas', models.TextField(help_text='Descripción de las actividades terapéuticas realizadas')),
                ('escala_funcional', models.CharField(blank=True, help_text='Escala de evaluación funcional utilizada y puntaje', max_length=200)),
                ('evolucion', models.TextField(help_text='Evolución del paciente en esta sesión')),
                ('proximos_objetivos', models.TextField(blank=True)),
                ('asistio', models.BooleanField(default=True)),
                ('motivo_inasistencia', models.CharField(blank=True, max_length=200)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('plan', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='sesiones',
                    to='historia.planrehabilitacion',
                )),
                ('terapeuta', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='sesiones_realizadas',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Sesión de rehabilitación',
                'ordering': ['numero_sesion'],
            },
        ),

        # ── HistoriaOdontologica ──────────────────────────────────────────────
        migrations.CreateModel(
            name='HistoriaOdontologica',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('antecedentes_sistemicos', models.TextField(blank=True, help_text='Enfermedades sistémicas relevantes para odontología')),
                ('antecedentes_dentales', models.TextField(blank=True)),
                ('alergias', models.TextField(blank=True)),
                ('medicamentos_actuales', models.TextField(blank=True)),
                ('habitos', models.TextField(blank=True, help_text='Tabaquismo, bruxismo, etc.')),
                ('motivo_consulta', models.TextField(blank=True)),
                ('higiene_oral', models.CharField(
                    blank=True,
                    choices=[('buena', 'Buena'), ('regular', 'Regular'), ('mala', 'Mala')],
                    max_length=15,
                )),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('actualizado_en', models.DateTimeField(auto_now=True)),
                ('paciente', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='historia_odontologica',
                    to='pacientes.paciente',
                )),
            ],
            options={
                'verbose_name': 'Historia odontológica',
            },
        ),

        # ── ProcedimientoOdontologico ─────────────────────────────────────────
        migrations.CreateModel(
            name='ProcedimientoOdontologico',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('numero_diente', models.PositiveSmallIntegerField(help_text='Número FDI: 11-18, 21-28, 31-38, 41-48')),
                ('cara', models.CharField(
                    choices=[
                        ('oclusal', 'Oclusal/Incisal'),
                        ('mesial', 'Mesial'),
                        ('distal', 'Distal'),
                        ('vestibular', 'Vestibular/Labial'),
                        ('lingual', 'Lingual/Palatino'),
                        ('total', 'Diente completo'),
                    ],
                    default='total',
                    max_length=15,
                )),
                ('codigo_cie10_o', models.CharField(blank=True, help_text='Diagnóstico odontológico', max_length=10)),
                ('descripcion_diagnostico', models.CharField(blank=True, max_length=300)),
                ('cups', models.CharField(blank=True, max_length=10)),
                ('descripcion_tratamiento', models.CharField(blank=True, max_length=300)),
                ('material_utilizado', models.CharField(blank=True, max_length=200)),
                ('estado', models.CharField(
                    choices=[
                        ('diagnosticado', 'Diagnosticado'),
                        ('en_tratamiento', 'En tratamiento'),
                        ('completado', 'Completado'),
                        ('referido', 'Referido a especialista'),
                    ],
                    default='diagnosticado',
                    max_length=20,
                )),
                ('observaciones', models.TextField(blank=True)),
                ('fecha', models.DateField(auto_now_add=True)),
                ('valor_cobrado', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('historia', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='procedimientos',
                    to='historia.historiaodontologica',
                )),
                ('odontologo', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='procedimientos_odontologicos',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Procedimiento odontológico',
                'ordering': ['numero_diente', 'cara'],
            },
        ),

        # ── SesionTelemedicina ────────────────────────────────────────────────
        migrations.CreateModel(
            name='SesionTelemedicina',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('tipo', models.CharField(
                    choices=[
                        ('teleconsulta', 'Teleconsulta (primera vez)'),
                        ('telecontrol', 'Telecontrol (seguimiento)'),
                        ('teleinterconsulta', 'Teleinterconsulta'),
                        ('telemonitoreo', 'Telemonitoreo crónico'),
                        ('telediagnostico', 'Telediagnóstico'),
                    ],
                    default='teleconsulta',
                    max_length=25,
                )),
                ('cups', models.CharField(blank=True, help_text='CUPS del servicio de telemedicina', max_length=10)),
                ('plataforma', models.CharField(
                    choices=[
                        ('zoom', 'Zoom'),
                        ('meet', 'Google Meet'),
                        ('teams', 'Microsoft Teams'),
                        ('jitsi', 'Jitsi / HaluMedic'),
                        ('whatsapp', 'WhatsApp Video'),
                        ('otra', 'Otra'),
                    ],
                    default='jitsi',
                    max_length=15,
                )),
                ('link_reunion', models.URLField(blank=True)),
                ('codigo_sala', models.CharField(blank=True, max_length=100)),
                ('fecha_programada', models.DateTimeField()),
                ('duracion_estimada_min', models.PositiveIntegerField(default=20)),
                ('motivo_consulta', models.TextField(blank=True)),
                ('diagnostico_cie10', models.CharField(blank=True, max_length=10)),
                ('notas_clinicas', models.TextField(blank=True, help_text='Anamnesis, examen físico virtual, plan')),
                ('formula_medica', models.TextField(blank=True)),
                ('incapacidad_dias', models.PositiveIntegerField(blank=True, null=True)),
                ('estado', models.CharField(
                    choices=[
                        ('programada', 'Programada'),
                        ('en_curso', 'En curso'),
                        ('completada', 'Completada'),
                        ('cancelada', 'Cancelada'),
                        ('no_asistio', 'No asistió'),
                    ],
                    default='programada',
                    max_length=15,
                )),
                ('consentimiento_firmado', models.BooleanField(default=False, help_text='Paciente aceptó términos telemedicina')),
                ('duracion_real_min', models.PositiveIntegerField(blank=True, null=True)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('actualizado_en', models.DateTimeField(auto_now=True)),
                ('paciente', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='sesiones_telemedicina',
                    to='pacientes.paciente',
                )),
                ('medico', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='sesiones_telemedicina',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Sesión telemedicina',
                'verbose_name_plural': 'Sesiones telemedicina',
                'ordering': ['-fecha_programada'],
            },
        ),

        # ── CamaUCI ───────────────────────────────────────────────────────────
        migrations.CreateModel(
            name='CamaUCI',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('numero_cama', models.CharField(max_length=10)),
                ('tipo', models.CharField(
                    choices=[
                        ('uci_adulto', 'UCI Adulto'),
                        ('uci_neo', 'UCI Neonatal'),
                        ('uci_ped', 'UCI Pediátrica'),
                        ('ucc', 'Unidad Coronaria (UCC)'),
                        ('ucin', 'UCIN'),
                        ('intermedia', 'Cuidados intermedios'),
                    ],
                    default='uci_adulto',
                    max_length=15,
                )),
                ('estado', models.CharField(
                    choices=[
                        ('libre', 'Libre'),
                        ('ocupada', 'Ocupada'),
                        ('mantenimiento', 'En mantenimiento'),
                        ('reservada', 'Reservada'),
                    ],
                    default='libre',
                    max_length=15,
                )),
                ('ubicacion', models.CharField(blank=True, help_text='Piso, ala, box', max_length=100)),
                ('tiene_ventilador', models.BooleanField(default=True)),
                ('tiene_monitor', models.BooleanField(default=True)),
                ('observaciones', models.TextField(blank=True)),
            ],
            options={
                'verbose_name': 'Cama UCI',
                'verbose_name_plural': 'Camas UCI',
                'ordering': ['numero_cama'],
            },
        ),

        # ── AdmisionUCI ───────────────────────────────────────────────────────
        migrations.CreateModel(
            name='AdmisionUCI',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('diagnostico_ingreso_uci', models.CharField(blank=True, help_text='CIE-10', max_length=10)),
                ('descripcion_diagnostico', models.CharField(blank=True, max_length=300)),
                ('motivo_ingreso', models.CharField(
                    choices=[
                        ('respiratorio', 'Falla respiratoria'),
                        ('cardiaco', 'Falla cardíaca/cardiopatía'),
                        ('sepsis', 'Sepsis/choque séptico'),
                        ('neurologico', 'Evento neurológico'),
                        ('trauma', 'Politraumatismo'),
                        ('postquirurgico', 'Postoperatorio'),
                        ('metabolico', 'Trastorno metabólico'),
                        ('renal', 'Falla renal'),
                        ('otro', 'Otro'),
                    ],
                    default='otro',
                    max_length=20,
                )),
                ('apache_ii_score', models.PositiveSmallIntegerField(blank=True, help_text='Score APACHE II (0-71)', null=True)),
                ('sofa_score', models.PositiveSmallIntegerField(blank=True, help_text='Score SOFA', null=True)),
                ('ventilacion_mecanica', models.BooleanField(default=False)),
                ('modo_ventilacion', models.CharField(blank=True, help_text='VCV, PCV, PSV, SIMV, etc.', max_length=50)),
                ('drogas_vasoactivas', models.BooleanField(default=False)),
                ('dialisis', models.BooleanField(default=False)),
                ('fecha_ingreso_uci', models.DateTimeField()),
                ('fecha_egreso_uci', models.DateTimeField(blank=True, null=True)),
                ('motivo_egreso', models.CharField(blank=True, max_length=200)),
                ('dias_uci', models.PositiveIntegerField(blank=True, null=True)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('ingreso', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='admisiones_uci',
                    to='historia.ingreso',
                )),
                ('paciente', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='admisiones_uci',
                    to='pacientes.paciente',
                )),
                ('cama', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='admisiones',
                    to='historia.camauci',
                )),
                ('medico_responsable', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='admisiones_uci',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Admisión UCI',
                'verbose_name_plural': 'Admisiones UCI',
                'ordering': ['-fecha_ingreso_uci'],
            },
        ),

        # ── MonitoreoUCI ──────────────────────────────────────────────────────
        migrations.CreateModel(
            name='MonitoreoUCI',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('fecha_hora', models.DateTimeField()),
                ('tension_arterial_sistolica', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('tension_arterial_diastolica', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('presion_arterial_media', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('frecuencia_cardiaca', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('spo2', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('temperatura', models.DecimalField(blank=True, decimal_places=1, max_digits=4, null=True)),
                ('frecuencia_resp', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('fio2', models.PositiveSmallIntegerField(blank=True, help_text='FiO2 %', null=True)),
                ('peep', models.PositiveSmallIntegerField(blank=True, help_text='PEEP cmH2O', null=True)),
                ('volumen_tidal', models.PositiveSmallIntegerField(blank=True, help_text='VT ml', null=True)),
                ('presion_plateau', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('etco2', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('norepinefrina_dosis', models.DecimalField(blank=True, decimal_places=3, max_digits=6, null=True)),
                ('dopamina_dosis', models.DecimalField(blank=True, decimal_places=3, max_digits=6, null=True)),
                ('entradas_ml', models.PositiveIntegerField(blank=True, null=True)),
                ('salidas_ml', models.PositiveIntegerField(blank=True, null=True)),
                ('diuresis_ml_hora', models.PositiveIntegerField(blank=True, null=True)),
                ('glasgow', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('observaciones', models.TextField(blank=True)),
                ('admision', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='monitoreos',
                    to='historia.admisionuci',
                )),
                ('registrado_por', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='monitoreos_uci',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Monitoreo UCI',
                'ordering': ['-fecha_hora'],
            },
        ),

        # ── UnidadHemoderivado ────────────────────────────────────────────────
        migrations.CreateModel(
            name='UnidadHemoderivado',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('tipo', models.CharField(
                    choices=[
                        ('globulos_rojos', 'Glóbulos rojos empaquetados'),
                        ('plasma', 'Plasma fresco congelado'),
                        ('plaquetas', 'Concentrado de plaquetas'),
                        ('crioprecipitado', 'Crioprecipitado'),
                        ('sangre_total', 'Sangre total'),
                        ('albumina', 'Albúmina'),
                        ('inmunoglobulina', 'Inmunoglobulina'),
                    ],
                    max_length=20,
                )),
                ('grupo_sanguineo', models.CharField(
                    choices=[('A', 'A'), ('B', 'B'), ('AB', 'AB'), ('O', 'O')],
                    max_length=2,
                )),
                ('rh', models.CharField(
                    choices=[('+', 'RH+'), ('-', 'RH-')],
                    max_length=1,
                )),
                ('numero_unidad', models.CharField(max_length=30, unique=True)),
                ('banco_origen', models.CharField(blank=True, max_length=200)),
                ('fecha_donacion', models.DateField(blank=True, null=True)),
                ('fecha_vencimiento', models.DateField()),
                ('volumen_ml', models.PositiveIntegerField()),
                ('estado', models.CharField(
                    choices=[
                        ('disponible', 'Disponible'),
                        ('reservada', 'Reservada'),
                        ('transfundida', 'Transfundida'),
                        ('vencida', 'Vencida'),
                        ('descartada', 'Descartada'),
                    ],
                    default='disponible',
                    max_length=15,
                )),
                ('pruebas_serologicas', models.JSONField(blank=True, default=dict, help_text='{VIH, HepB, HepC, Chagas, Sifilis: neg/pos}')),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'Unidad hemoderivado',
                'ordering': ['fecha_vencimiento'],
            },
        ),

        # ── SolicitudHemoderivado ─────────────────────────────────────────────
        migrations.CreateModel(
            name='SolicitudHemoderivado',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('tipo_solicitado', models.CharField(
                    choices=[
                        ('globulos_rojos', 'Glóbulos rojos empaquetados'),
                        ('plasma', 'Plasma fresco congelado'),
                        ('plaquetas', 'Concentrado de plaquetas'),
                        ('crioprecipitado', 'Crioprecipitado'),
                        ('sangre_total', 'Sangre total'),
                        ('albumina', 'Albúmina'),
                        ('inmunoglobulina', 'Inmunoglobulina'),
                    ],
                    max_length=20,
                )),
                ('cantidad_unidades', models.PositiveIntegerField(default=1)),
                ('grupo_requerido', models.CharField(
                    blank=True,
                    choices=[('A', 'A'), ('B', 'B'), ('AB', 'AB'), ('O', 'O')],
                    max_length=2,
                )),
                ('rh_requerido', models.CharField(
                    blank=True,
                    choices=[('+', 'RH+'), ('-', 'RH-')],
                    max_length=1,
                )),
                ('indicacion_clinica', models.TextField()),
                ('urgente', models.BooleanField(default=False)),
                ('estado', models.CharField(
                    choices=[
                        ('solicitada', 'Solicitada'),
                        ('en_reserva', 'En reserva'),
                        ('transfundida', 'Transfundida'),
                        ('cancelada', 'Cancelada'),
                    ],
                    default='solicitada',
                    max_length=15,
                )),
                ('reaccion_transfusional', models.TextField(blank=True)),
                ('fecha_solicitud', models.DateTimeField(auto_now_add=True)),
                ('fecha_transfusion', models.DateTimeField(blank=True, null=True)),
                ('paciente', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='solicitudes_hemoderivados',
                    to='pacientes.paciente',
                )),
                ('ingreso', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='solicitudes_hemoderivados',
                    to='historia.ingreso',
                )),
                ('medico_solicitante', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='solicitudes_hemoderivados',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('unidades_asignadas', models.ManyToManyField(
                    blank=True,
                    related_name='solicitudes',
                    to='historia.unidadhemoderivado',
                )),
            ],
            options={
                'verbose_name': 'Solicitud hemoderivado',
                'ordering': ['-fecha_solicitud'],
            },
        ),
    ]
