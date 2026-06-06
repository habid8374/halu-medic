"""
Módulo Historia Clínica
Modelos: Ingreso, Egreso, HistoriaClinica
Vinculados al paciente, consultas (RDA) y facturación.
"""
from django.db import models
from django.contrib.auth import get_user_model
import uuid

User = get_user_model()


class TipoEgreso(models.TextChoices):
    ALTA_MEDICA   = 'alta_medica',   'Alta médica'
    TRASLADO      = 'traslado',      'Traslado'
    VOLUNTARIO    = 'voluntario',    'Retiro voluntario'
    FALLECIMIENTO = 'fallecimiento', 'Fallecimiento'
    FUGA          = 'fuga',          'Fuga'


class Ingreso(models.Model):
    """Registro de ingreso/admisión del paciente."""
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    numero_ingreso  = models.PositiveIntegerField(editable=False)
    paciente        = models.ForeignKey('pacientes.Paciente', on_delete=models.PROTECT,
                                         related_name='ingresos')
    medico          = models.ForeignKey('citas.Medico', on_delete=models.SET_NULL,
                                         null=True, blank=True, related_name='ingresos')
    fecha_ingreso   = models.DateTimeField()
    motivo_ingreso  = models.TextField()
    tipo_atencion   = models.CharField(max_length=20, choices=[
        ('consulta_externa', 'Consulta externa'),
        ('urgencias',        'Urgencias'),
        ('hospitalizacion',  'Hospitalización'),
        ('procedimiento',    'Procedimiento'),
    ], default='consulta_externa')
    observaciones   = models.TextField(blank=True)
    activo          = models.BooleanField(default=True, help_text='False = paciente egresado')
    creado_en       = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha_ingreso']
        indexes = [
            models.Index(fields=['paciente', 'activo']),
            models.Index(fields=['numero_ingreso']),
        ]

    def save(self, *args, **kwargs):
        if not self.numero_ingreso:
            ultimo = Ingreso.objects.order_by('-numero_ingreso').first()
            self.numero_ingreso = (ultimo.numero_ingreso + 1) if ultimo else 1
        super().save(*args, **kwargs)

    def __str__(self):
        return f'Ingreso #{self.numero_ingreso} — {self.paciente}'


class Egreso(models.Model):
    """Registro de alta/egreso vinculado a un ingreso."""
    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ingreso          = models.OneToOneField(Ingreso, on_delete=models.PROTECT, related_name='egreso')
    fecha_egreso     = models.DateTimeField()
    tipo_egreso      = models.CharField(max_length=20, choices=TipoEgreso.choices,
                                         default=TipoEgreso.ALTA_MEDICA)
    diagnostico_egreso = models.CharField(max_length=10, blank=True, help_text='CIE-10')
    descripcion_diagnostico = models.CharField(max_length=300, blank=True)
    condicion_al_egreso = models.TextField(blank=True)
    medico           = models.ForeignKey('citas.Medico', on_delete=models.SET_NULL,
                                          null=True, blank=True)
    observaciones    = models.TextField(blank=True)
    creado_en        = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha_egreso']

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Marcar ingreso como inactivo
        self.ingreso.activo = False
        self.ingreso.save(update_fields=['activo'])

    def __str__(self):
        return f'Egreso ingreso #{self.ingreso.numero_ingreso}'


class HistoriaClinica(models.Model):
    """
    Registro de historia clínica de una atención.
    Puede vincularse a un Ingreso (hospitalización) y/o a una Consulta (RDA).
    """
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    numero_hc       = models.PositiveIntegerField(editable=False, null=True, blank=True)
    paciente        = models.ForeignKey('pacientes.Paciente', on_delete=models.PROTECT,
                                         related_name='historias')
    ingreso         = models.ForeignKey(Ingreso, on_delete=models.SET_NULL,
                                         null=True, blank=True, related_name='historias')
    consulta        = models.OneToOneField('consultas.Consulta', on_delete=models.SET_NULL,
                                            null=True, blank=True, related_name='historia')
    medico          = models.ForeignKey('citas.Medico', on_delete=models.SET_NULL,
                                         null=True, blank=True)
    fecha_atencion  = models.DateTimeField()

    tipo_registro   = models.CharField(max_length=20, choices=[
        ('consulta',         'Consulta'),
        ('urgencias',        'Urgencias'),
        ('hospitalizacion',  'Hospitalización'),
        ('procedimiento',    'Procedimiento'),
        ('evolucion',        'Nota de evolución'),
        ('interconsulta',    'Interconsulta'),
    ], default='consulta')

    # Clínico
    motivo_consulta  = models.TextField(blank=True)
    anamnesis        = models.TextField(blank=True)
    enfermedad_actual = models.TextField(blank=True)

    # Signos vitales (JSON flexible)
    signos_vitales   = models.JSONField(null=True, blank=True,
        help_text='{"pa_sistolica":120,"pa_diastolica":80,"fc":72,"fr":16,"temperatura":36.5,"peso":70,"talla":170,"spo2":98}')

    examen_fisico    = models.TextField(blank=True)
    impresion_diagnostica = models.TextField(blank=True)

    # Diagnósticos CIE-10
    diagnostico_principal     = models.CharField(max_length=10, blank=True)
    diagnostico_relacionado_1 = models.CharField(max_length=10, blank=True)
    diagnostico_relacionado_2 = models.CharField(max_length=10, blank=True)

    plan_tratamiento = models.TextField(blank=True)
    ordenes_medicas  = models.TextField(blank=True)
    observaciones    = models.TextField(blank=True)

    creado_en        = models.DateTimeField(auto_now_add=True)
    actualizado_en   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-fecha_atencion']
        indexes = [
            models.Index(fields=['paciente', 'fecha_atencion']),
        ]

    def save(self, *args, **kwargs):
        if not self.numero_hc:
            ultimo = HistoriaClinica.objects.order_by('-numero_hc').filter(numero_hc__isnull=False).first()
            self.numero_hc = (ultimo.numero_hc + 1) if ultimo else 1
        super().save(*args, **kwargs)

    def __str__(self):
        return f'HC-{self.numero_hc or self.id} — {self.paciente}'


class MedicamentoHC(models.Model):
    """
    Medicamento prescrito en una Historia Clínica.
    El CUM (cum) identifica el medicamento en el RIPS (Res.948/2026).
    """
    VIA_CHOICES = [
        ('oral',         'Oral'),
        ('iv',           'Intravenosa'),
        ('im',           'Intramuscular'),
        ('sc',           'Subcutánea'),
        ('topica',       'Tópica'),
        ('inhalatoria',  'Inhalatoria'),
        ('sublingual',   'Sublingual'),
        ('rectal',       'Rectal'),
        ('oftalmica',    'Oftálmica'),
        ('otica',        'Ótica'),
        ('nasal',        'Nasal'),
        ('otra',         'Otra'),
    ]

    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    historia            = models.ForeignKey(HistoriaClinica, on_delete=models.CASCADE,
                                             related_name='medicamentos')
    # Datos del catálogo CUM
    cum                 = models.CharField(max_length=20, help_text='Código Único de Medicamento (CUM)')
    principio_activo    = models.CharField(max_length=400)
    concentracion       = models.CharField(max_length=150, blank=True)
    forma_farmaceutica  = models.CharField(max_length=150, blank=True)
    # Prescripción
    dosis               = models.CharField(max_length=100, blank=True, help_text='Ej: 500 mg')
    frecuencia          = models.CharField(max_length=100, blank=True, help_text='Ej: cada 8 horas')
    via_administracion  = models.CharField(max_length=20, choices=VIA_CHOICES, default='oral')
    cantidad            = models.PositiveIntegerField(default=1)
    dias_tratamiento    = models.PositiveIntegerField(default=1)
    indicaciones        = models.TextField(blank=True)
    # Facturación (si la IPS factura medicamentos)
    genera_factura      = models.BooleanField(default=False)
    valor_unitario      = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    valor_dispensacion  = models.DecimalField(max_digits=14, decimal_places=2, default=0,
                                               help_text='Valor dispensación separado (Res.948)')
    creado_en           = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['creado_en']
        verbose_name = 'Medicamento HC'
        verbose_name_plural = 'Medicamentos HC'

    def __str__(self):
        return f'{self.cum} — {self.principio_activo} ({self.historia})'


class OrdenHC(models.Model):
    """
    Órdenes médicas emitidas desde la Historia Clínica.
    Cubre procedimientos CUPS, cirugías, interconsultas, laboratorios e imágenes.
    """
    TIPO_CHOICES = [
        ('procedimiento',       'Procedimiento'),
        ('cirugia',             'Cirugía'),
        ('consulta_especializada', 'Consulta especializada'),
        ('laboratorio',         'Laboratorio'),
        ('imagen',              'Imagen diagnóstica'),
        ('interconsulta',       'Interconsulta / Remisión'),
        ('otro',                'Otro'),
    ]
    ESTADO_CHOICES = [
        ('pendiente',  'Pendiente'),
        ('ejecutada',  'Ejecutada'),
        ('cancelada',  'Cancelada'),
    ]

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    historia    = models.ForeignKey(HistoriaClinica, on_delete=models.CASCADE,
                                     related_name='ordenes')
    tipo        = models.CharField(max_length=25, choices=TIPO_CHOICES, default='procedimiento')
    estado      = models.CharField(max_length=12, choices=ESTADO_CHOICES, default='pendiente')

    # Identificación del servicio (CUPS obligatorio excepto para laboratorio libre)
    cups             = models.CharField(max_length=10, blank=True, help_text='Código CUPS')
    descripcion_cups = models.CharField(max_length=300, blank=True)

    # Diagnóstico que justifica la orden (CIE-10)
    cie10_justificacion    = models.CharField(max_length=10, blank=True)
    desc_cie10             = models.CharField(max_length=300, blank=True)

    cantidad          = models.PositiveIntegerField(default=1)
    urgente           = models.BooleanField(default=False)
    indicacion        = models.TextField(blank=True, help_text='Indicación clínica / justificación')
    observaciones     = models.TextField(blank=True)
    vigencia_dias     = models.PositiveSmallIntegerField(default=30)

    # Facturación
    genera_factura    = models.BooleanField(default=False)
    valor_unitario    = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    creado_en         = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['creado_en']
        verbose_name = 'Orden HC'
        verbose_name_plural = 'Órdenes HC'

    def __str__(self):
        return f'{self.get_tipo_display()} — {self.cups or self.descripcion_cups}'


# ════════════════════════════════════════════════════════════════════════════
#  MÓDULO SALUD — Hospitalización, Cirugías y Ayudas Diagnósticas
# ════════════════════════════════════════════════════════════════════════════

ANESTESIA_CHOICES = [
    ('general',   'General'),
    ('regional',  'Regional'),
    ('local',     'Local'),
    ('sedacion',  'Sedación'),
    ('epidural',  'Epidural'),
    ('raquidea',  'Raquídea'),
    ('mixta',     'Mixta'),
]


class NotaMedica(models.Model):
    """
    Nota/evolución médica de hospitalización en formato SOAP.
    Una vez firmada NO puede editarse — solo se agrega nota aclaratoria.
    Obligatoria: fecha+hora, médico firmante, especialidad, contenido.
    """
    TIPO_CHOICES = [
        ('ingreso',         'Nota de ingreso/admisión'),
        ('evolucion',       'Evolución médica'),
        ('interconsulta',   'Interconsulta'),
        ('valoracion',      'Valoración por especialidad'),
        ('preoperatoria',   'Valoración preoperatoria'),
        ('postoperatoria',  'Nota postoperatoria'),
        ('anestesia',       'Valoración anestésica'),
        ('enfermeria',      'Nota de enfermería'),
        ('aclaratoria',     'Nota aclaratoria'),
        ('epicrisis',       'Epicrisis / Resumen de egreso'),
    ]

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ingreso         = models.ForeignKey(Ingreso, on_delete=models.CASCADE,
                                         related_name='notas_medicas')
    historia        = models.ForeignKey(HistoriaClinica, on_delete=models.SET_NULL,
                                         null=True, blank=True, related_name='notas_medicas')
    tipo            = models.CharField(max_length=20, choices=TIPO_CHOICES, default='evolucion')
    medico          = models.ForeignKey(User, on_delete=models.SET_NULL,
                                         null=True, blank=True, related_name='notas_medicas')
    # Snapshot de especialidad al momento de firmar (anti-glosa)
    especialidad_nota  = models.CharField(max_length=200, blank=True)
    tarjeta_prof_nota  = models.CharField(max_length=20, blank=True)
    servicio           = models.CharField(max_length=100, blank=True,
                                           help_text='Servicio/sala hospitalaria (ej: Medicina Interna, UCI)')

    fecha_hora      = models.DateTimeField(help_text='Fecha y hora de la evolución')

    # ── SOAP ─────────────────────────────────────────────────────────────────
    subjetivo   = models.TextField(blank=True, help_text='Síntomas y quejas referidas por el paciente')
    objetivo    = models.TextField(blank=True, help_text='Examen físico, signos vitales, paraclínicos')
    analisis    = models.TextField(blank=True, help_text='Análisis / impresión diagnóstica')
    plan        = models.TextField(blank=True, help_text='Plan de manejo, órdenes, conducta')

    # ── Epicrisis (solo tipo=epicrisis) ───────────────────────────────────────
    resumen_hospitalizacion = models.TextField(blank=True)
    diagnostico_egreso      = models.CharField(max_length=10, blank=True, help_text='CIE-10')
    desc_diagnostico_egreso = models.CharField(max_length=300, blank=True)
    condicion_al_egreso     = models.TextField(blank=True)
    recomendaciones_egreso  = models.TextField(blank=True)

    # ── Firma (una vez firmada el registro es inmutable) ──────────────────────
    firmada     = models.BooleanField(default=False)
    firmada_en  = models.DateTimeField(null=True, blank=True)

    creado_en   = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['fecha_hora']
        verbose_name = 'Nota médica'
        verbose_name_plural = 'Notas médicas'

    def __str__(self):
        return f'{self.get_tipo_display()} — {self.ingreso} — {self.fecha_hora}'


class ProgramacionCx(models.Model):
    """
    Programación quirúrgica. Genera número propio (CX-XXXXX) amarrado al Ingreso.
    Campos mínimos exigidos para autorización EPS y reporte RIPS quirúrgico.
    """
    ESTADO_CHOICES = [
        ('programada',  'Programada'),
        ('confirmada',  'Confirmada'),
        ('en_curso',    'En curso'),
        ('realizada',   'Realizada'),
        ('suspendida',  'Suspendida'),
        ('cancelada',   'Cancelada'),
    ]
    TIPO_CIRUGIA_CHOICES = [
        ('electiva',   'Electiva'),
        ('urgente',    'Urgente'),
        ('emergencia', 'Emergencia'),
    ]

    id                    = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    numero_cx             = models.PositiveIntegerField(editable=False,
                                                          help_text='Consecutivo CX-XXXXX')
    ingreso               = models.ForeignKey(Ingreso, on_delete=models.SET_NULL,
                                               null=True, blank=True,
                                               related_name='programaciones_cx')
    paciente              = models.ForeignKey('pacientes.Paciente', on_delete=models.PROTECT,
                                               related_name='programaciones_cx')

    # Procedimiento
    cups_principal        = models.CharField(max_length=10, help_text='CUPS del procedimiento principal')
    descripcion_cups      = models.CharField(max_length=300, blank=True)
    diagnostico_preop     = models.CharField(max_length=10, blank=True, help_text='CIE-10 preoperatorio')
    desc_diagnostico_preop = models.CharField(max_length=300, blank=True)
    tipo_cirugia          = models.CharField(max_length=15, choices=TIPO_CIRUGIA_CHOICES,
                                              default='electiva')

    # Equipo quirúrgico
    cirujano              = models.ForeignKey(User, on_delete=models.SET_NULL,
                                               null=True, blank=True,
                                               related_name='cx_como_cirujano')
    anestesiologo         = models.ForeignKey(User, on_delete=models.SET_NULL,
                                               null=True, blank=True,
                                               related_name='cx_como_anestesiologo')

    # Logística
    fecha_programada      = models.DateTimeField()
    duracion_estimada_min = models.PositiveIntegerField(default=60)
    quirofano             = models.CharField(max_length=50, blank=True)
    tipo_anestesia        = models.CharField(max_length=10, choices=ANESTESIA_CHOICES,
                                              default='general')

    # Autorización EPS
    numero_autorizacion   = models.CharField(max_length=60, blank=True)
    requiere_autorizacion = models.BooleanField(default=True)

    estado                = models.CharField(max_length=15, choices=ESTADO_CHOICES,
                                              default='programada')
    observaciones_preop   = models.TextField(blank=True)
    creado_en             = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha_programada']
        verbose_name = 'Programación quirúrgica'
        verbose_name_plural = 'Programaciones quirúrgicas'
        indexes = [
            models.Index(fields=['numero_cx']),
            models.Index(fields=['paciente', 'estado']),
        ]

    def save(self, *args, **kwargs):
        if not self.numero_cx:
            ultimo = ProgramacionCx.objects.order_by('-numero_cx').first()
            self.numero_cx = (ultimo.numero_cx + 1) if ultimo else 1
        super().save(*args, **kwargs)

    def __str__(self):
        return f'CX-{str(self.numero_cx).zfill(5)} — {self.descripcion_cups or self.cups_principal}'


class DescripcionQuirurgica(models.Model):
    """
    Informe/descripción operatoria. Número propio DQX-XXXXX, siempre
    amarrado al Ingreso del paciente.  Una vez firmado es inmutable.
    Fuente: Res. 1995/1999 Art. 11 — registros específicos quirúrgicos.
    """
    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    numero_dqx       = models.PositiveIntegerField(editable=False)
    programacion     = models.OneToOneField(ProgramacionCx, on_delete=models.SET_NULL,
                                             null=True, blank=True,
                                             related_name='descripcion_qx')
    ingreso          = models.ForeignKey(Ingreso, on_delete=models.SET_NULL,
                                          null=True, blank=True,
                                          related_name='descripciones_qx')

    # Diagnósticos
    diagnostico_preoperatorio   = models.CharField(max_length=10, blank=True, help_text='CIE-10')
    desc_diag_preop             = models.CharField(max_length=300, blank=True)
    diagnostico_postoperatorio  = models.CharField(max_length=10, blank=True, help_text='CIE-10')
    desc_diag_postop            = models.CharField(max_length=300, blank=True)

    # Procedimiento
    cups_principal          = models.CharField(max_length=10)
    descripcion_procedimiento = models.CharField(max_length=300, blank=True)
    tipo_anestesia          = models.CharField(max_length=10, choices=ANESTESIA_CHOICES,
                                                default='general')

    # Equipo quirúrgico (snapshots anti-glosa)
    cirujano                = models.ForeignKey(User, on_delete=models.SET_NULL,
                                                 null=True, blank=True,
                                                 related_name='dqx_cirujano')
    cirujano_nombre         = models.CharField(max_length=200, blank=True)
    cirujano_tp             = models.CharField(max_length=20, blank=True,
                                                help_text='TP del cirujano al momento de la firma')
    cirujano_especialidad   = models.CharField(max_length=200, blank=True)

    anestesiologo           = models.ForeignKey(User, on_delete=models.SET_NULL,
                                                 null=True, blank=True,
                                                 related_name='dqx_anestesiologo')
    anestesiologo_nombre    = models.CharField(max_length=200, blank=True)

    primer_ayudante         = models.CharField(max_length=200, blank=True)
    segundo_ayudante        = models.CharField(max_length=200, blank=True)
    instrumentadora         = models.CharField(max_length=200, blank=True)
    enfermera_circulante    = models.CharField(max_length=200, blank=True)

    # Tiempos
    fecha_hora_inicio       = models.DateTimeField()
    fecha_hora_fin          = models.DateTimeField(null=True, blank=True)
    quirofano               = models.CharField(max_length=50, blank=True)

    # Contenido clínico del informe operatorio
    descripcion_tecnica     = models.TextField(
        help_text='Descripción paso a paso de la técnica quirúrgica utilizada')
    hallazgos               = models.TextField(blank=True,
        help_text='Hallazgos intraoperatorios relevantes')
    especimenes             = models.TextField(blank=True,
        help_text='Especímenes enviados a patología')
    implantes               = models.TextField(blank=True,
        help_text='Implantes, prótesis, mallas o dispositivos utilizados')
    complicaciones          = models.TextField(blank=True)
    sangrado_estimado_ml    = models.PositiveIntegerField(null=True, blank=True)
    liquidos_administrados  = models.TextField(blank=True)
    plan_postoperatorio     = models.TextField(blank=True)

    # Firma (inmutable después de firmar)
    firmada     = models.BooleanField(default=False)
    firmada_en  = models.DateTimeField(null=True, blank=True)
    creado_en   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-creado_en']
        verbose_name = 'Descripción quirúrgica'
        verbose_name_plural = 'Descripciones quirúrgicas'
        indexes = [models.Index(fields=['numero_dqx'])]

    def save(self, *args, **kwargs):
        if not self.numero_dqx:
            ultimo = DescripcionQuirurgica.objects.order_by('-numero_dqx').first()
            self.numero_dqx = (ultimo.numero_dqx + 1) if ultimo else 1
        super().save(*args, **kwargs)

    def __str__(self):
        return f'DQX-{str(self.numero_dqx).zfill(5)} — {self.descripcion_procedimiento or self.cups_principal}'


class AyudaDiagnostica(models.Model):
    """
    Solicitud de ayuda diagnóstica (laboratorio, imagen, ecografía, etc.).
    Amarrada al ingreso y/o historia clínica.
    """
    TIPO_CHOICES = [
        ('laboratorio',       'Laboratorio clínico'),
        ('rx',                'Radiografía'),
        ('ecografia',         'Ecografía'),
        ('tomografia',        'Tomografía (TAC)'),
        ('resonancia',        'Resonancia magnética (RMN)'),
        ('electrocardiograma','Electrocardiograma'),
        ('ecocardiograma',    'Ecocardiograma'),
        ('endoscopia',        'Endoscopia'),
        ('biopsia',           'Biopsia / Patología'),
        ('espirometria',      'Espirometría'),
        ('otro',              'Otro'),
    ]
    ESTADO_CHOICES = [
        ('solicitada',  'Solicitada'),
        ('tomada',      'Tomada/Procesada'),
        ('resultado',   'Con resultado'),
        ('cancelada',   'Cancelada'),
    ]

    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ingreso             = models.ForeignKey(Ingreso, on_delete=models.SET_NULL,
                                             null=True, blank=True,
                                             related_name='ayudas_diagnosticas')
    historia            = models.ForeignKey(HistoriaClinica, on_delete=models.SET_NULL,
                                             null=True, blank=True,
                                             related_name='ayudas_diagnosticas')
    tipo                = models.CharField(max_length=20, choices=TIPO_CHOICES)
    cups                = models.CharField(max_length=10, blank=True)
    descripcion         = models.CharField(max_length=300)
    indicacion_clinica  = models.TextField(blank=True)
    urgente             = models.BooleanField(default=False)
    medico_solicitante  = models.ForeignKey(User, on_delete=models.SET_NULL,
                                             null=True, blank=True,
                                             related_name='ayudas_solicitadas')
    estado              = models.CharField(max_length=15, choices=ESTADO_CHOICES,
                                            default='solicitada')
    fecha_solicitud     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha_solicitud']
        verbose_name = 'Ayuda diagnóstica'
        verbose_name_plural = 'Ayudas diagnósticas'

    def __str__(self):
        return f'{self.get_tipo_display()} — {self.descripcion}'


class ResultadoAD(models.Model):
    """
    Resultado de una ayuda diagnóstica.
    Soporta texto libre + archivo adjunto (imagen, PDF, DICOM thumbnail).
    """
    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ayuda               = models.OneToOneField(AyudaDiagnostica, on_delete=models.CASCADE,
                                                related_name='resultado')
    medico_interpreta   = models.ForeignKey(User, on_delete=models.SET_NULL,
                                             null=True, blank=True,
                                             related_name='resultados_interpretados')
    fecha_resultado     = models.DateTimeField()
    resultado_texto     = models.TextField(blank=True, help_text='Texto del resultado / informe')
    interpretacion      = models.TextField(blank=True, help_text='Interpretación clínica')
    conclusion          = models.TextField(blank=True)
    archivo             = models.FileField(upload_to='ayudas_diagnosticas/%Y/%m/',
                                            null=True, blank=True,
                                            help_text='PDF, imagen, DICOM thumbnail')
    creado_en           = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Resultado ayuda diagnóstica'
        verbose_name_plural = 'Resultados ayudas diagnósticas'

    def __str__(self):
        return f'Resultado: {self.ayuda}'
