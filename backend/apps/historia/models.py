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
    indicaciones_alta   = models.TextField(blank=True, help_text='Indicaciones de alta: medicamentos, cuidados, cita control')
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


# ═══════════════════════════════════════════════════════════════════════════════
# TRIAGE  (Res. 5596/2015 — Clasificación en 5 niveles)
# ═══════════════════════════════════════════════════════════════════════════════
class Triage(models.Model):
    NIVEL_CHOICES = [
        (1, 'Nivel I — Reanimación (rojo)'),
        (2, 'Nivel II — Emergencia (naranja)'),
        (3, 'Nivel III — Urgencia (amarillo)'),
        (4, 'Nivel IV — Menos urgente (verde)'),
        (5, 'Nivel V — Sin urgencia (azul)'),
    ]
    ESTADO_CHOICES = [
        ('espera',      'En espera'),
        ('en_atencion', 'En atención'),
        ('atendido',    'Atendido'),
        ('referido',    'Referido'),
        ('abandono',    'Abandono'),
    ]

    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    paciente            = models.ForeignKey('pacientes.Paciente', on_delete=models.PROTECT,
                                             related_name='triages')
    ingreso             = models.ForeignKey(Ingreso, on_delete=models.SET_NULL,
                                             null=True, blank=True, related_name='triages')

    nivel               = models.PositiveSmallIntegerField(choices=NIVEL_CHOICES)
    motivo_consulta     = models.TextField(help_text='Motivo de consulta en palabras del paciente')
    hora_clasificacion  = models.DateTimeField(auto_now_add=True)
    clasificado_por     = models.ForeignKey(User, on_delete=models.SET_NULL,
                                             null=True, blank=True, related_name='triages_clasificados')

    # Signos vitales iniciales
    tension_arterial    = models.CharField(max_length=15, blank=True, help_text='ej: 120/80')
    frecuencia_cardiaca = models.PositiveSmallIntegerField(null=True, blank=True, help_text='lpm')
    frecuencia_resp     = models.PositiveSmallIntegerField(null=True, blank=True, help_text='rpm')
    temperatura         = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True, help_text='°C')
    spo2                = models.PositiveSmallIntegerField(null=True, blank=True, help_text='% saturación O2')
    glasgow             = models.PositiveSmallIntegerField(null=True, blank=True, help_text='3-15')
    dolor_escala        = models.PositiveSmallIntegerField(null=True, blank=True, help_text='0-10 EVA')
    peso_kg             = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)

    # Mecanismo / antecedentes urgentes
    mecanismo_trauma    = models.CharField(max_length=200, blank=True)
    alergias            = models.TextField(blank=True)
    medicamentos_actuales = models.TextField(blank=True)

    estado              = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='espera')
    observaciones       = models.TextField(blank=True)
    hora_atencion       = models.DateTimeField(null=True, blank=True,
                                               help_text='Hora en que inició la atención médica')

    creado_en           = models.DateTimeField(auto_now_add=True)
    actualizado_en      = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['hora_clasificacion']
        verbose_name = 'Triage'
        verbose_name_plural = 'Triages'
        indexes = [
            models.Index(fields=['nivel', 'estado']),
            models.Index(fields=['hora_clasificacion']),
        ]

    def __str__(self):
        return f'Triage N{self.nivel} — {self.paciente} — {self.hora_clasificacion:%Y-%m-%d %H:%M}'


# ═══════════════════════════════════════════════════════════════════════════════
# LISTA DE VERIFICACIÓN QUIRÚRGICA  (OPS/OMS — 3 Pausas)
# ═══════════════════════════════════════════════════════════════════════════════
class ListaVerificacionQx(models.Model):
    """
    Protocolo de cirugía segura OPS/OMS — tres pausas obligatorias.
    Res. MinSalud Circular 045/2012 y Programa Nacional de Seguridad del Paciente.
    """
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    programacion    = models.OneToOneField(ProgramacionCx, on_delete=models.CASCADE,
                                            related_name='lista_verificacion')

    # ── PAUSA 1: ENTRADA (antes de inducción anestésica) ─────────────────────
    entrada_identidad          = models.BooleanField(default=False, help_text='Paciente confirmó identidad, procedimiento y sitio')
    entrada_sitio_marcado      = models.BooleanField(default=False, help_text='Sitio quirúrgico marcado')
    entrada_anestesia_revisada = models.BooleanField(default=False, help_text='Revisión de seguridad anestésica completa')
    entrada_oximetro           = models.BooleanField(default=False, help_text='Oxímetro de pulso funcionando')
    entrada_alergias           = models.BooleanField(default=False, help_text='Alergias conocidas verificadas')
    entrada_via_aerea          = models.BooleanField(default=False, help_text='Vía aérea/riesgo de aspiración evaluado')
    entrada_sangrado           = models.BooleanField(default=False, help_text='Riesgo de pérdida sanguínea > 500 ml evaluado')
    entrada_consentimiento     = models.BooleanField(default=False, help_text='Consentimiento informado firmado')
    entrada_ayuno              = models.BooleanField(default=False, help_text='Ayuno verificado')
    entrada_notas_entrada      = models.TextField(blank=True)
    entrada_responsable        = models.ForeignKey(User, on_delete=models.SET_NULL,
                                                    null=True, blank=True, related_name='entradas_qx')
    entrada_hora               = models.DateTimeField(null=True, blank=True)

    # ── PAUSA 2: ACTO QUIRÚRGICO (antes de incisión) ─────────────────────────
    acto_presentacion_equipo   = models.BooleanField(default=False, help_text='Todos los miembros se presentaron por nombre y función')
    acto_confirmacion_paciente = models.BooleanField(default=False, help_text='Identidad, sitio y procedimiento confirmados')
    acto_profilaxis_antibiotica= models.BooleanField(default=False, help_text='Profilaxis antibiótica administrada en últimos 60 min')
    acto_estudios_imagen       = models.BooleanField(default=False, help_text='Imágenes diagnósticas necesarias visibles')
    acto_implantes             = models.BooleanField(default=False, help_text='Implantes/equipos especiales disponibles')
    acto_pasos_criticos        = models.TextField(blank=True, help_text='Pasos críticos o inesperados anticipados por cirujano')
    acto_preocupaciones_anest  = models.TextField(blank=True, help_text='Preocupaciones específicas del anestesiólogo')
    acto_preocupaciones_enf    = models.TextField(blank=True, help_text='Preocupaciones del equipo de enfermería')
    acto_responsable           = models.ForeignKey(User, on_delete=models.SET_NULL,
                                                    null=True, blank=True, related_name='actos_qx')
    acto_hora                  = models.DateTimeField(null=True, blank=True)

    # ── PAUSA 3: SALIDA (antes de que el paciente salga del quirófano) ────────
    salida_nombre_procedimiento= models.BooleanField(default=False, help_text='Nombre del procedimiento registrado')
    salida_conteo_instrumentos = models.BooleanField(default=False, help_text='Conteo de compresas e instrumentos completo')
    salida_especimenes         = models.BooleanField(default=False, help_text='Especímenes etiquetados correctamente')
    salida_equipos_problemas   = models.BooleanField(default=False, help_text='Problemas con equipos registrados')
    salida_recuperacion        = models.TextField(blank=True, help_text='Instrucciones de recuperación y manejo postoperatorio')
    salida_responsable         = models.ForeignKey(User, on_delete=models.SET_NULL,
                                                    null=True, blank=True, related_name='salidas_qx')
    salida_hora                = models.DateTimeField(null=True, blank=True)

    completada      = models.BooleanField(default=False)
    creado_en       = models.DateTimeField(auto_now_add=True)
    actualizado_en  = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Lista de verificación quirúrgica'
        verbose_name_plural = 'Listas de verificación quirúrgica'

    def __str__(self):
        return f'LVQx — {self.programacion}'


# ═══════════════════════════════════════════════════════════════════════════════
# REGISTRO DE ANESTESIA
# ═══════════════════════════════════════════════════════════════════════════════
class RegistroAnestesia(models.Model):
    TIPO_CHOICES = [
        ('general',    'General'),
        ('regional',   'Regional'),
        ('local',      'Local'),
        ('sedacion',   'Sedación'),
        ('mixta',      'Mixta'),
        ('espinal',    'Espinal/Raquídea'),
        ('epidural',   'Epidural'),
        ('peridural',  'Peridural'),
    ]
    ASA_CHOICES = [(str(i), f'ASA {i}') for i in range(1, 7)]

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    programacion     = models.OneToOneField(ProgramacionCx, on_delete=models.CASCADE,
                                             related_name='registro_anestesia')
    anestesiologo    = models.ForeignKey(User, on_delete=models.SET_NULL,
                                          null=True, blank=True, related_name='registros_anestesia')

    tipo_anestesia   = models.CharField(max_length=15, choices=TIPO_CHOICES, default='general')
    clasificacion_asa= models.CharField(max_length=2, choices=ASA_CHOICES, default='1',
                                         help_text='Clasificación ASA del paciente')

    # Tiempos
    hora_inicio_anestesia = models.DateTimeField(null=True, blank=True)
    hora_inicio_cirugia   = models.DateTimeField(null=True, blank=True)
    hora_fin_cirugia      = models.DateTimeField(null=True, blank=True)
    hora_fin_anestesia    = models.DateTimeField(null=True, blank=True)

    # Medicamentos e insumos
    induccion            = models.JSONField(default=list, blank=True,
                                             help_text='[{medicamento, dosis, via}]')
    mantenimiento        = models.JSONField(default=list, blank=True,
                                             help_text='[{medicamento, dosis, concentracion}]')
    reversión           = models.JSONField(default=list, blank=True)
    fluidos              = models.JSONField(default=list, blank=True,
                                            help_text='[{tipo, volumen_ml}] SSN, Lactato Ringer, etc.')

    # Signos vitales intraoperatorios (serie temporal)
    signos_vitales_intra = models.JSONField(default=list, blank=True,
                                             help_text='[{hora, ta, fc, spo2, etco2, temp}]')

    # Balance
    sangrado_ml          = models.PositiveIntegerField(null=True, blank=True)
    diuresis_ml          = models.PositiveIntegerField(null=True, blank=True)
    transfusiones        = models.TextField(blank=True)

    # Complicaciones y observaciones
    complicaciones       = models.TextField(blank=True)
    observaciones        = models.TextField(blank=True)
    condicion_egreso_qx  = models.CharField(max_length=200, blank=True,
                                             help_text='Condición al salir del quirófano')

    firmado              = models.BooleanField(default=False)
    firmado_en           = models.DateTimeField(null=True, blank=True)
    creado_en            = models.DateTimeField(auto_now_add=True)
    actualizado_en       = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Registro de anestesia'
        verbose_name_plural = 'Registros de anestesia'

    def __str__(self):
        return f'Anestesia — {self.programacion}'


# ═══════════════════════════════════════════════════════════════════════════════
# CONSENTIMIENTO INFORMADO
# ═══════════════════════════════════════════════════════════════════════════════
class ConsentimientoInformado(models.Model):
    TIPO_CHOICES = [
        ('general',          'Consentimiento general de hospitalización'),
        ('cirugia',          'Consentimiento quirúrgico'),
        ('anestesia',        'Consentimiento anestésico'),
        ('procedimiento',    'Procedimiento invasivo/diagnóstico'),
        ('transfusion',      'Transfusión de hemoderivados'),
        ('quimioterapia',    'Quimioterapia'),
        ('investigacion',    'Participación en investigación'),
        ('imagen',           'Uso de imágenes/datos clínicos'),
        ('telemedicina',     'Teleconsulta/Telemedicina'),
        ('otro',             'Otro'),
    ]
    ESTADO_CHOICES = [
        ('pendiente',  'Pendiente de firma'),
        ('firmado',    'Firmado'),
        ('rechazado',  'Rechazado por paciente'),
        ('anulado',    'Anulado'),
    ]

    id                       = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    paciente                 = models.ForeignKey('pacientes.Paciente', on_delete=models.PROTECT,
                                                  related_name='consentimientos')
    ingreso                  = models.ForeignKey(Ingreso, on_delete=models.SET_NULL,
                                                  null=True, blank=True,
                                                  related_name='consentimientos')
    programacion_cx          = models.ForeignKey(ProgramacionCx, on_delete=models.SET_NULL,
                                                  null=True, blank=True,
                                                  related_name='consentimientos')

    tipo                     = models.CharField(max_length=20, choices=TIPO_CHOICES)
    procedimiento            = models.CharField(max_length=300, blank=True,
                                                 help_text='Nombre del procedimiento o intervención')
    cups_procedimiento       = models.CharField(max_length=10, blank=True)

    # Contenido
    texto_completo           = models.TextField(help_text='Texto completo del consentimiento informado')
    riesgos_informados       = models.TextField(blank=True)
    alternativas_informadas  = models.TextField(blank=True)

    # Firmantes
    medico                   = models.ForeignKey(User, on_delete=models.SET_NULL,
                                                  null=True, blank=True,
                                                  related_name='consentimientos_firmados')
    nombre_paciente_firmante = models.CharField(max_length=200, blank=True)
    nombre_acompanante       = models.CharField(max_length=200, blank=True,
                                                 help_text='Si firma representante legal/familiar')
    parentesco_acompanante   = models.CharField(max_length=100, blank=True)
    motivo_representante     = models.CharField(max_length=200, blank=True,
                                                 help_text='Por qué firma el representante en vez del paciente')

    estado                   = models.CharField(max_length=15, choices=ESTADO_CHOICES,
                                                 default='pendiente')
    motivo_rechazo           = models.TextField(blank=True)

    fecha_firma              = models.DateTimeField(null=True, blank=True)
    creado_en                = models.DateTimeField(auto_now_add=True)
    creado_por               = models.ForeignKey(User, on_delete=models.SET_NULL,
                                                  null=True, blank=True,
                                                  related_name='consentimientos_creados')

    class Meta:
        ordering = ['-creado_en']
        verbose_name = 'Consentimiento informado'
        verbose_name_plural = 'Consentimientos informados'

    def __str__(self):
        return f'CI {self.get_tipo_display()} — {self.paciente}'


# ═══════════════════════════════════════════════════════════════════════════════
# NOTA DE ENFERMERÍA (extendida — balance hídrico, medicamentos, turno)
# ═══════════════════════════════════════════════════════════════════════════════
class NotaEnfermeria(models.Model):
    TURNO_CHOICES = [
        ('manana',  'Mañana (6am-2pm)'),
        ('tarde',   'Tarde (2pm-10pm)'),
        ('noche',   'Noche (10pm-6am)'),
    ]

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ingreso          = models.ForeignKey(Ingreso, on_delete=models.CASCADE,
                                          related_name='notas_enfermeria')
    enfermero        = models.ForeignKey(User, on_delete=models.SET_NULL,
                                          null=True, blank=True, related_name='notas_enfermeria')
    turno            = models.CharField(max_length=10, choices=TURNO_CHOICES)
    fecha_hora       = models.DateTimeField()

    # Signos vitales del turno
    tension_arterial = models.CharField(max_length=15, blank=True)
    frecuencia_cardiaca = models.PositiveSmallIntegerField(null=True, blank=True)
    frecuencia_resp  = models.PositiveSmallIntegerField(null=True, blank=True)
    temperatura      = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    spo2             = models.PositiveSmallIntegerField(null=True, blank=True)
    glasgow          = models.PositiveSmallIntegerField(null=True, blank=True)
    dolor_escala     = models.PositiveSmallIntegerField(null=True, blank=True)
    peso_kg          = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)

    # Balance hídrico
    entradas_ml      = models.JSONField(default=list, blank=True,
                                         help_text='[{tipo, volumen_ml}] líquidos administrados')
    salidas_ml       = models.JSONField(default=list, blank=True,
                                         help_text='[{tipo, volumen_ml}] diuresis, drenajes, etc.')
    balance_hidrico  = models.IntegerField(null=True, blank=True,
                                            help_text='Total entradas - salidas en ml')

    # Medicamentos administrados (MAR)
    medicamentos_administrados = models.JSONField(default=list, blank=True,
                                                   help_text='[{medicamento, dosis, via, hora, enfermero}]')

    # Cuidados y procedimientos de enfermería
    curaciones       = models.TextField(blank=True, help_text='Curaciones realizadas, estado de heridas')
    sondas_catéteres = models.TextField(blank=True, help_text='Estado de sondas, catéteres, drenajes')
    movilizacion     = models.TextField(blank=True, help_text='Cambios de posición, movilización')
    observaciones    = models.TextField(blank=True)

    firmada          = models.BooleanField(default=False)
    firmada_en       = models.DateTimeField(null=True, blank=True)
    creado_en        = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha_hora']
        verbose_name = 'Nota de enfermería'
        verbose_name_plural = 'Notas de enfermería'

    def __str__(self):
        return f'Enf/{self.get_turno_display()} — {self.ingreso} — {self.fecha_hora:%Y-%m-%d %H:%M}'

# ═══════════════════════════════════════════════════════════════════════════════
# REFERENCIA Y CONTRAREFERENCIA  (Res. 3047/2008)
# ═══════════════════════════════════════════════════════════════════════════════
class ReferenciaPaciente(models.Model):
    TIPO_CHOICES = [
        ('referencia',        'Referencia (envío a otra IPS)'),
        ('contrareferencia',  'Contrareferencia (respuesta de regreso)'),
        ('interconsulta',     'Interconsulta interna'),
    ]
    PRIORIDAD_CHOICES = [
        ('inmediata', 'Inmediata (< 1 hora)'),
        ('urgente',   'Urgente (< 6 horas)'),
        ('prioritaria', 'Prioritaria (< 24 horas)'),
        ('no_urgente', 'No urgente (programada)'),
    ]
    ESTADO_CHOICES = [
        ('generada',  'Generada'),
        ('enviada',   'Enviada / en tránsito'),
        ('aceptada',  'Aceptada por IPS receptora'),
        ('rechazada', 'Rechazada por IPS receptora'),
        ('respondida', 'Respondida (contrareferencia recibida)'),
        ('anulada',   'Anulada'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default='referencia')
    paciente = models.ForeignKey('pacientes.Paciente', on_delete=models.PROTECT, related_name='referencias')
    ingreso = models.ForeignKey(Ingreso, on_delete=models.SET_NULL, null=True, blank=True, related_name='referencias')

    institucion_origen = models.CharField(max_length=300, blank=True)
    codigo_habilitacion_origen = models.CharField(max_length=20, blank=True)
    institucion_destino = models.CharField(max_length=300)
    codigo_habilitacion_destino = models.CharField(max_length=20, blank=True)
    servicio_destino = models.CharField(max_length=200, blank=True, help_text='Especialidad o servicio al que se refiere')

    diagnostico_cie10 = models.CharField(max_length=10, blank=True)
    descripcion_diagnostico = models.CharField(max_length=300, blank=True)
    motivo_referencia = models.TextField(help_text='Motivo clínico de la referencia')
    resumen_clinico = models.TextField(blank=True, help_text='Resumen del caso, tratamiento recibido')
    examenes_adjuntos = models.TextField(blank=True, help_text='Lista de exámenes que acompañan al paciente')
    medicamentos_actuales = models.TextField(blank=True)

    prioridad = models.CharField(max_length=15, choices=PRIORIDAD_CHOICES, default='urgente')
    estado = models.CharField(max_length=15, choices=ESTADO_CHOICES, default='generada')

    medico_remitente = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='referencias_generadas')
    numero_autorizacion = models.CharField(max_length=60, blank=True)
    requiere_ambulancia = models.BooleanField(default=False)
    tipo_transporte = models.CharField(max_length=50, blank=True)

    respuesta_diagnostico = models.TextField(blank=True)
    respuesta_tratamiento = models.TextField(blank=True)
    respuesta_recomendaciones = models.TextField(blank=True)
    medico_responde = models.CharField(max_length=200, blank=True)
    fecha_respuesta = models.DateTimeField(null=True, blank=True)
    motivo_rechazo = models.TextField(blank=True)

    fecha_referencia = models.DateTimeField(auto_now_add=True)
    creado_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='referencias_creadas')

    class Meta:
        ordering = ['-fecha_referencia']
        verbose_name = 'Referencia / Contrareferencia'
        verbose_name_plural = 'Referencias / Contrareferencias'

    def __str__(self):
        return f'{self.get_tipo_display()} — {self.paciente} → {self.institucion_destino}'


# ═══════════════════════════════════════════════════════════════════════════════
# REHABILITACIÓN Y TERAPIAS
# ═══════════════════════════════════════════════════════════════════════════════
class PlanRehabilitacion(models.Model):
    TIPO_TERAPIA_CHOICES = [
        ('fisioterapia',    'Fisioterapia'),
        ('ocupacional',     'Terapia ocupacional'),
        ('fonoaudiologia',  'Fonoaudiología / Terapia del lenguaje'),
        ('psicologia',      'Psicología clínica'),
        ('nutricion',       'Nutrición y dietética'),
        ('trabajo_social',  'Trabajo social'),
    ]
    ESTADO_CHOICES = [
        ('activo',     'Activo'),
        ('completado', 'Completado'),
        ('suspendido', 'Suspendido'),
        ('cancelado',  'Cancelado'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    paciente = models.ForeignKey('pacientes.Paciente', on_delete=models.PROTECT, related_name='planes_rehabilitacion')
    ingreso = models.ForeignKey(Ingreso, on_delete=models.SET_NULL, null=True, blank=True, related_name='planes_rehabilitacion')
    tipo_terapia = models.CharField(max_length=20, choices=TIPO_TERAPIA_CHOICES)
    diagnostico_cie10 = models.CharField(max_length=10, blank=True)
    descripcion_diagnostico = models.CharField(max_length=300, blank=True)
    objetivo_general = models.TextField(help_text='Objetivo terapéutico principal')
    objetivos_especificos = models.TextField(blank=True)
    numero_sesiones_prescritas = models.PositiveIntegerField(default=10)
    frecuencia_semanal = models.PositiveSmallIntegerField(default=3, help_text='Sesiones por semana')
    terapeuta = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='planes_asignados')
    medico_prescriptor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='planes_prescritos')
    estado = models.CharField(max_length=15, choices=ESTADO_CHOICES, default='activo')
    fecha_inicio = models.DateField()
    fecha_fin_estimada = models.DateField(null=True, blank=True)
    observaciones = models.TextField(blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-creado_en']
        verbose_name = 'Plan de rehabilitación'

    def __str__(self):
        return f'{self.get_tipo_terapia_display()} — {self.paciente}'


class SesionRehabilitacion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan = models.ForeignKey(PlanRehabilitacion, on_delete=models.CASCADE, related_name='sesiones')
    numero_sesion = models.PositiveIntegerField()
    fecha_hora = models.DateTimeField()
    duracion_minutos = models.PositiveIntegerField(default=45)
    actividades_realizadas = models.TextField(help_text='Descripción de las actividades terapéuticas realizadas')
    escala_funcional = models.CharField(max_length=200, blank=True, help_text='Escala de evaluación funcional utilizada y puntaje')
    evolucion = models.TextField(help_text='Evolución del paciente en esta sesión')
    proximos_objetivos = models.TextField(blank=True)
    asistio = models.BooleanField(default=True)
    motivo_inasistencia = models.CharField(max_length=200, blank=True)
    terapeuta = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='sesiones_realizadas')
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['numero_sesion']
        verbose_name = 'Sesión de rehabilitación'

    def __str__(self):
        return f'Sesión {self.numero_sesion} — {self.plan}'


# ═══════════════════════════════════════════════════════════════════════════════
# ODONTOLOGÍA
# ═══════════════════════════════════════════════════════════════════════════════
class HistoriaOdontologica(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    paciente = models.OneToOneField('pacientes.Paciente', on_delete=models.CASCADE, related_name='historia_odontologica')
    antecedentes_sistemicos = models.TextField(blank=True, help_text='Enfermedades sistémicas relevantes para odontología')
    antecedentes_dentales = models.TextField(blank=True)
    alergias = models.TextField(blank=True)
    medicamentos_actuales = models.TextField(blank=True)
    habitos = models.TextField(blank=True, help_text='Tabaquismo, bruxismo, etc.')
    motivo_consulta = models.TextField(blank=True)
    higiene_oral = models.CharField(max_length=15, choices=[('buena', 'Buena'), ('regular', 'Regular'), ('mala', 'Mala')], blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Historia odontológica'

    def __str__(self):
        return f'HO — {self.paciente}'


class ProcedimientoOdontologico(models.Model):
    """Procedimiento o diagnóstico por diente en odontograma."""
    CARA_CHOICES = [
        ('oclusal',    'Oclusal/Incisal'),
        ('mesial',     'Mesial'),
        ('distal',     'Distal'),
        ('vestibular', 'Vestibular/Labial'),
        ('lingual',    'Lingual/Palatino'),
        ('total',      'Diente completo'),
    ]
    ESTADO_CHOICES = [
        ('diagnosticado',  'Diagnosticado'),
        ('en_tratamiento', 'En tratamiento'),
        ('completado',     'Completado'),
        ('referido',       'Referido a especialista'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    historia = models.ForeignKey(HistoriaOdontologica, on_delete=models.CASCADE, related_name='procedimientos')
    numero_diente = models.PositiveSmallIntegerField(help_text='Número FDI: 11-18, 21-28, 31-38, 41-48')
    cara = models.CharField(max_length=15, choices=CARA_CHOICES, default='total')
    codigo_cie10_o = models.CharField(max_length=10, blank=True, help_text='Diagnóstico odontológico')
    descripcion_diagnostico = models.CharField(max_length=300, blank=True)
    cups = models.CharField(max_length=10, blank=True)
    descripcion_tratamiento = models.CharField(max_length=300, blank=True)
    material_utilizado = models.CharField(max_length=200, blank=True)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='diagnosticado')
    odontologo = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='procedimientos_odontologicos')
    observaciones = models.TextField(blank=True)
    fecha = models.DateField(auto_now_add=True)
    valor_cobrado = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        ordering = ['numero_diente', 'cara']
        verbose_name = 'Procedimiento odontológico'

    def __str__(self):
        return f'Diente {self.numero_diente} ({self.cara}) — {self.descripcion_tratamiento or self.descripcion_diagnostico}'


# ═══════════════════════════════════════════════════════════════════════════════
# TELEMEDICINA  (Res. 2654/2019 MinSalud)
# ═══════════════════════════════════════════════════════════════════════════════
class SesionTelemedicina(models.Model):
    TIPO_CHOICES = [
        ('teleconsulta',      'Teleconsulta (primera vez)'),
        ('telecontrol',       'Telecontrol (seguimiento)'),
        ('teleinterconsulta', 'Teleinterconsulta'),
        ('telemonitoreo',     'Telemonitoreo crónico'),
        ('telediagnostico',   'Telediagnóstico'),
    ]
    PLATAFORMA_CHOICES = [
        ('zoom',     'Zoom'),
        ('meet',     'Google Meet'),
        ('teams',    'Microsoft Teams'),
        ('jitsi',    'Jitsi / HaluMedic'),
        ('whatsapp', 'WhatsApp Video'),
        ('otra',     'Otra'),
    ]
    ESTADO_CHOICES = [
        ('programada', 'Programada'),
        ('en_curso',   'En curso'),
        ('completada', 'Completada'),
        ('cancelada',  'Cancelada'),
        ('no_asistio', 'No asistió'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    paciente = models.ForeignKey('pacientes.Paciente', on_delete=models.PROTECT, related_name='sesiones_telemedicina')
    medico = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='sesiones_telemedicina')
    tipo = models.CharField(max_length=25, choices=TIPO_CHOICES, default='teleconsulta')
    cups = models.CharField(max_length=10, blank=True, help_text='CUPS del servicio de telemedicina')
    plataforma = models.CharField(max_length=15, choices=PLATAFORMA_CHOICES, default='jitsi')
    link_reunion = models.URLField(blank=True)
    codigo_sala = models.CharField(max_length=100, blank=True)
    fecha_programada = models.DateTimeField()
    duracion_estimada_min = models.PositiveIntegerField(default=20)
    motivo_consulta = models.TextField(blank=True)
    diagnostico_cie10 = models.CharField(max_length=10, blank=True)
    notas_clinicas = models.TextField(blank=True, help_text='Anamnesis, examen físico virtual, plan')
    formula_medica = models.TextField(blank=True)
    incapacidad_dias = models.PositiveIntegerField(null=True, blank=True)
    estado = models.CharField(max_length=15, choices=ESTADO_CHOICES, default='programada')
    consentimiento_firmado = models.BooleanField(default=False, help_text='Paciente aceptó términos telemedicina')
    duracion_real_min = models.PositiveIntegerField(null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-fecha_programada']
        verbose_name = 'Sesión telemedicina'
        verbose_name_plural = 'Sesiones telemedicina'

    def __str__(self):
        return f'{self.get_tipo_display()} — {self.paciente} — {self.fecha_programada:%Y-%m-%d %H:%M}'


# ═══════════════════════════════════════════════════════════════════════════════
# UCI / CUIDADOS INTENSIVOS
# ═══════════════════════════════════════════════════════════════════════════════
class CamaUCI(models.Model):
    TIPO_CHOICES = [
        ('uci_adulto', 'UCI Adulto'),
        ('uci_neo',    'UCI Neonatal'),
        ('uci_ped',    'UCI Pediátrica'),
        ('ucc',        'Unidad Coronaria (UCC)'),
        ('ucin',       'UCIN'),
        ('intermedia', 'Cuidados intermedios'),
    ]
    ESTADO_CHOICES = [
        ('libre',         'Libre'),
        ('ocupada',       'Ocupada'),
        ('mantenimiento', 'En mantenimiento'),
        ('reservada',     'Reservada'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    numero_cama = models.CharField(max_length=10)
    tipo = models.CharField(max_length=15, choices=TIPO_CHOICES, default='uci_adulto')
    estado = models.CharField(max_length=15, choices=ESTADO_CHOICES, default='libre')
    ubicacion = models.CharField(max_length=100, blank=True, help_text='Piso, ala, box')
    tiene_ventilador = models.BooleanField(default=True)
    tiene_monitor = models.BooleanField(default=True)
    observaciones = models.TextField(blank=True)

    class Meta:
        ordering = ['numero_cama']
        verbose_name = 'Cama UCI'
        verbose_name_plural = 'Camas UCI'

    def __str__(self):
        return f'Cama {self.numero_cama} ({self.get_tipo_display()}) — {self.get_estado_display()}'


class Quirofano(models.Model):
    TIPO_CHOICES = [
        ('general',    'Quirófano General'),
        ('cardiaco',   'Cirugía Cardíaca'),
        ('laparos',    'Laparoscopía'),
        ('traumato',   'Traumatología'),
        ('oftalmo',    'Oftalmología'),
        ('endoscopia', 'Endoscopía'),
        ('urologia',   'Urología'),
        ('otro',       'Otro'),
    ]
    ESTADO_CHOICES = [
        ('disponible',   'Disponible'),
        ('en_uso',       'En uso'),
        ('limpieza',     'En limpieza'),
        ('mantenimiento','En mantenimiento'),
    ]

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nombre       = models.CharField(max_length=50, help_text='Ej: Quirófano 1, Sala CX-A')
    tipo         = models.CharField(max_length=15, choices=TIPO_CHOICES, default='general')
    estado       = models.CharField(max_length=15, choices=ESTADO_CHOICES, default='disponible')
    ubicacion    = models.CharField(max_length=100, blank=True, help_text='Piso, ala, bloque')
    numero       = models.PositiveIntegerField(null=True, blank=True, help_text='Número identificador')
    capacidad_personal = models.PositiveIntegerField(default=5)
    tiene_rx     = models.BooleanField(default=False, help_text='Rayos X intraoperatorio')
    tiene_laparos = models.BooleanField(default=False, help_text='Torre de laparoscopía')
    tiene_robot  = models.BooleanField(default=False, help_text='Sistema robótico')
    observaciones = models.TextField(blank=True)
    activo       = models.BooleanField(default=True)
    creado_en    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['nombre']
        verbose_name = 'Quirófano'
        verbose_name_plural = 'Quirófanos'

    def __str__(self):
        return f'{self.nombre} ({self.get_tipo_display()})'


class AdmisionUCI(models.Model):
    MOTIVO_INGRESO_CHOICES = [
        ('respiratorio',   'Falla respiratoria'),
        ('cardiaco',       'Falla cardíaca/cardiopatía'),
        ('sepsis',         'Sepsis/choque séptico'),
        ('neurologico',    'Evento neurológico'),
        ('trauma',         'Politraumatismo'),
        ('postquirurgico', 'Postoperatorio'),
        ('metabolico',     'Trastorno metabólico'),
        ('renal',          'Falla renal'),
        ('otro',           'Otro'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ingreso = models.ForeignKey(Ingreso, on_delete=models.SET_NULL, null=True, blank=True, related_name='admisiones_uci')
    paciente = models.ForeignKey('pacientes.Paciente', on_delete=models.PROTECT, related_name='admisiones_uci')
    cama = models.ForeignKey(CamaUCI, on_delete=models.SET_NULL, null=True, blank=True, related_name='admisiones')
    diagnostico_ingreso_uci = models.CharField(max_length=10, blank=True, help_text='CIE-10')
    descripcion_diagnostico = models.CharField(max_length=300, blank=True)
    motivo_ingreso = models.CharField(max_length=20, choices=MOTIVO_INGRESO_CHOICES, default='otro')
    apache_ii_score = models.PositiveSmallIntegerField(null=True, blank=True, help_text='Score APACHE II (0-71)')
    sofa_score = models.PositiveSmallIntegerField(null=True, blank=True, help_text='Score SOFA')
    ventilacion_mecanica = models.BooleanField(default=False)
    modo_ventilacion = models.CharField(max_length=50, blank=True, help_text='VCV, PCV, PSV, SIMV, etc.')
    drogas_vasoactivas = models.BooleanField(default=False)
    dialisis = models.BooleanField(default=False)
    fecha_ingreso_uci = models.DateTimeField()
    fecha_egreso_uci = models.DateTimeField(null=True, blank=True)
    motivo_egreso = models.CharField(max_length=200, blank=True)
    dias_uci = models.PositiveIntegerField(null=True, blank=True)
    medico_responsable = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='admisiones_uci')
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha_ingreso_uci']
        verbose_name = 'Admisión UCI'
        verbose_name_plural = 'Admisiones UCI'

    def __str__(self):
        return f'UCI — {self.paciente} — {self.fecha_ingreso_uci:%Y-%m-%d}'

    def save(self, *args, **kwargs):
        if self.fecha_egreso_uci and self.fecha_ingreso_uci:
            delta = self.fecha_egreso_uci - self.fecha_ingreso_uci
            self.dias_uci = delta.days
        super().save(*args, **kwargs)


class MonitoreoUCI(models.Model):
    """Registro horario de parámetros vitales y ventilatorios en UCI."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    admision = models.ForeignKey(AdmisionUCI, on_delete=models.CASCADE, related_name='monitoreos')
    fecha_hora = models.DateTimeField()
    tension_arterial_sistolica = models.PositiveSmallIntegerField(null=True, blank=True)
    tension_arterial_diastolica = models.PositiveSmallIntegerField(null=True, blank=True)
    presion_arterial_media = models.PositiveSmallIntegerField(null=True, blank=True)
    frecuencia_cardiaca = models.PositiveSmallIntegerField(null=True, blank=True)
    spo2 = models.PositiveSmallIntegerField(null=True, blank=True)
    temperatura = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    frecuencia_resp = models.PositiveSmallIntegerField(null=True, blank=True)
    fio2 = models.PositiveSmallIntegerField(null=True, blank=True, help_text='FiO2 %')
    peep = models.PositiveSmallIntegerField(null=True, blank=True, help_text='PEEP cmH2O')
    volumen_tidal = models.PositiveSmallIntegerField(null=True, blank=True, help_text='VT ml')
    presion_plateau = models.PositiveSmallIntegerField(null=True, blank=True)
    etco2 = models.PositiveSmallIntegerField(null=True, blank=True)
    norepinefrina_dosis = models.DecimalField(max_digits=6, decimal_places=3, null=True, blank=True)
    dopamina_dosis = models.DecimalField(max_digits=6, decimal_places=3, null=True, blank=True)
    entradas_ml = models.PositiveIntegerField(null=True, blank=True)
    salidas_ml = models.PositiveIntegerField(null=True, blank=True)
    diuresis_ml_hora = models.PositiveIntegerField(null=True, blank=True)
    glasgow = models.PositiveSmallIntegerField(null=True, blank=True)
    observaciones = models.TextField(blank=True)
    registrado_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='monitoreos_uci')

    class Meta:
        ordering = ['-fecha_hora']
        verbose_name = 'Monitoreo UCI'

    def __str__(self):
        return f'Monitor UCI — {self.admision.paciente} — {self.fecha_hora:%Y-%m-%d %H:%M}'


# ═══════════════════════════════════════════════════════════════════════════════
# BANCO DE SANGRE Y HEMODERIVADOS
# ═══════════════════════════════════════════════════════════════════════════════
class UnidadHemoderivado(models.Model):
    TIPO_CHOICES = [
        ('globulos_rojos',  'Glóbulos rojos empaquetados'),
        ('plasma',          'Plasma fresco congelado'),
        ('plaquetas',       'Concentrado de plaquetas'),
        ('crioprecipitado', 'Crioprecipitado'),
        ('sangre_total',    'Sangre total'),
        ('albumina',        'Albúmina'),
        ('inmunoglobulina', 'Inmunoglobulina'),
    ]
    GRUPO_CHOICES = [('A', 'A'), ('B', 'B'), ('AB', 'AB'), ('O', 'O')]
    RH_CHOICES = [('+', 'RH+'), ('-', 'RH-')]
    ESTADO_CHOICES = [
        ('disponible',  'Disponible'),
        ('reservada',   'Reservada'),
        ('transfundida', 'Transfundida'),
        ('vencida',     'Vencida'),
        ('descartada',  'Descartada'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    grupo_sanguineo = models.CharField(max_length=2, choices=GRUPO_CHOICES)
    rh = models.CharField(max_length=1, choices=RH_CHOICES)
    numero_unidad = models.CharField(max_length=30, unique=True)
    banco_origen = models.CharField(max_length=200, blank=True)
    fecha_donacion = models.DateField(null=True, blank=True)
    fecha_vencimiento = models.DateField()
    volumen_ml = models.PositiveIntegerField()
    estado = models.CharField(max_length=15, choices=ESTADO_CHOICES, default='disponible')
    pruebas_serologicas = models.JSONField(default=dict, blank=True, help_text='{VIH, HepB, HepC, Chagas, Sifilis: neg/pos}')
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['fecha_vencimiento']
        verbose_name = 'Unidad hemoderivado'

    def __str__(self):
        return f'{self.get_tipo_display()} {self.grupo_sanguineo}{self.rh} — {self.numero_unidad}'


class SolicitudHemoderivado(models.Model):
    ESTADO_CHOICES = [
        ('solicitada',   'Solicitada'),
        ('en_reserva',   'En reserva'),
        ('transfundida', 'Transfundida'),
        ('cancelada',    'Cancelada'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    paciente = models.ForeignKey('pacientes.Paciente', on_delete=models.PROTECT, related_name='solicitudes_hemoderivados')
    ingreso = models.ForeignKey(Ingreso, on_delete=models.SET_NULL, null=True, blank=True, related_name='solicitudes_hemoderivados')
    tipo_solicitado = models.CharField(max_length=20, choices=UnidadHemoderivado.TIPO_CHOICES)
    cantidad_unidades = models.PositiveIntegerField(default=1)
    grupo_requerido = models.CharField(max_length=2, choices=UnidadHemoderivado.GRUPO_CHOICES, blank=True)
    rh_requerido = models.CharField(max_length=1, choices=UnidadHemoderivado.RH_CHOICES, blank=True)
    indicacion_clinica = models.TextField()
    urgente = models.BooleanField(default=False)
    medico_solicitante = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='solicitudes_hemoderivados')
    unidades_asignadas = models.ManyToManyField(UnidadHemoderivado, blank=True, related_name='solicitudes')
    estado = models.CharField(max_length=15, choices=ESTADO_CHOICES, default='solicitada')
    reaccion_transfusional = models.TextField(blank=True)
    fecha_solicitud = models.DateTimeField(auto_now_add=True)
    fecha_transfusion = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-fecha_solicitud']
        verbose_name = 'Solicitud hemoderivado'

    def __str__(self):
        return f'{self.get_tipo_solicitado_display()} x{self.cantidad_unidades} — {self.paciente}'


# ── Liquidación de Cirugías (ISS/SOAT) ────────────────────────────────────────

# Artículo 77 ISS 2001 — Derechos de sala quirófano
# Tabla escalonada en bandas de 10 UVR; >450 UVR → UVR × $1.410
# Fuente: Acuerdo 256/2001, ejemplo verificado: banda 111-120 = $153.075 → $1.276/UVR
def _sala_iss2001(uvr_dec):
    from decimal import Decimal
    uvr = int(uvr_dec)
    if uvr <= 0:
        return Decimal('0')
    if uvr > 450:
        return (Decimal(str(uvr)) * Decimal('1410')).quantize(Decimal('1'))
    banda = ((uvr + 9) // 10) * 10   # redondea al techo del rango
    return (Decimal(str(banda)) * Decimal('1276')).quantize(Decimal('1'))


# Artículo 85 ISS 2001 — Material de sutura y curación
# Tabla ≤170 UVR; >170 UVR = por consumo (no liquidable automáticamente)
def _mat_iss2001(uvr_dec):
    from decimal import Decimal
    uvr = int(uvr_dec)
    if uvr <= 0 or uvr > 170:
        return Decimal('0')
    banda = ((uvr + 9) // 10) * 10
    return (Decimal(str(banda)) * Decimal('505')).quantize(Decimal('1'))


TABLA_PCT_LIQUIDACION = {
    'bilateral': {
        'ISS_2001': {'cirujano':[100,75,None],'anestesiologo':[100,75,None],'ayudante':[100,75,None],'quirofano':[100,75,None],'materiales':[100,75,None]},
        'ISS_2004': {'cirujano':[100,75,None],'anestesiologo':[100,75,None],'ayudante':[100,75,None],'quirofano':[100,75,None],'materiales':[100,75,None]},
        'SOAT':     {'cirujano':[100,75,None],'anestesiologo':[100,75,None],'ayudante':[100,75,None],'quirofano':[100,50,None],'materiales':[100,75,None]},
    },
    'misma_via': {
        'ISS_2001': {'cirujano':[100,60,None],'anestesiologo':[100,60,None],'ayudante':[100,60,None],'quirofano':[100,50,None],'materiales':[100,50,None]},
        'ISS_2004': {'cirujano':[100,55,55],'anestesiologo':[100,55,55],'ayudante':[100,55,55],'quirofano':[100,55,55],'materiales':[100,50,None]},
        'SOAT':     {'cirujano':[100,50,50],'anestesiologo':[100,50,50],'ayudante':[100,50,50],'quirofano':[100,None,None],'materiales':[100,None,None]},
    },
    'diferente_via': {
        'ISS_2001': {'cirujano':[100,75,75],'anestesiologo':[100,75,75],'ayudante':[100,75,75],'quirofano':[100,50,50],'materiales':[100,50,50]},
        'ISS_2004': {'cirujano':[100,65,65],'anestesiologo':[100,65,65],'ayudante':[100,65,65],'quirofano':[100,65,65],'materiales':[100,50,None]},
        'SOAT':     {'cirujano':[100,75,75],'anestesiologo':[100,75,75],'ayudante':[100,75,75],'quirofano':[100,50,50],'materiales':[100,75,75]},
    },
    'multiple_misma_a': {
        'ISS_2001': {'cirujano':[100,60,None],'anestesiologo':[100,None,None],'ayudante':[100,None,None],'quirofano':[100,50,None],'materiales':[100,50,None]},
        'ISS_2004': {'cirujano':[100,40,40],'anestesiologo':[100,40,40],'ayudante':[100,40,40],'quirofano':[100,40,40],'materiales':[100,50,50]},
        'SOAT':     {'cirujano':[100,50,50],'anestesiologo':[100,75,75],'ayudante':[100,None,None],'quirofano':[100,50,None],'materiales':[100,None,None]},
    },
    'multiple_misma_b': {
        'ISS_2001': {'cirujano':[100,60,None],'anestesiologo':[75,None,None],'ayudante':[50,None,None],'quirofano':[100,50,None],'materiales':[100,50,None]},
        'ISS_2004': {'cirujano':[100,40,40],'anestesiologo':[100,40,40],'ayudante':[100,40,40],'quirofano':[100,40,40],'materiales':[100,50,50]},
        'SOAT':     {'cirujano':[100,50,50],'anestesiologo':[75,75,75],'ayudante':[50,None,None],'quirofano':[50,50,None],'materiales':[None,None,None]},
    },
    'multiple_diferente_a': {
        'ISS_2001': {'cirujano':[100,60,None],'anestesiologo':[100,None,None],'ayudante':[100,None,None],'quirofano':[100,50,None],'materiales':[100,50,None]},
        'ISS_2004': {'cirujano':[100,40,40],'anestesiologo':[100,40,40],'ayudante':[100,40,40],'quirofano':[100,40,40],'materiales':[100,50,50]},
        'SOAT':     {'cirujano':[100,50,50],'anestesiologo':[100,75,75],'ayudante':[100,None,None],'quirofano':[100,50,None],'materiales':[100,75,75]},
    },
    'multiple_diferente_b': {
        'ISS_2001': {'cirujano':[100,60,None],'anestesiologo':[75,None,None],'ayudante':[50,None,None],'quirofano':[100,50,None],'materiales':[100,50,None]},
        'ISS_2004': {'cirujano':[100,40,40],'anestesiologo':[100,40,40],'ayudante':[100,40,40],'quirofano':[100,40,40],'materiales':[100,50,50]},
        'SOAT':     {'cirujano':[100,50,50],'anestesiologo':[75,75,75],'ayudante':[50,None,None],'quirofano':[50,50,None],'materiales':[75,75,75]},
    },
}


class LiquidacionCirugia(models.Model):
    TARIFARIO_CHOICES = [
        ('ISS_2001', 'ISS 2001'),
        ('ISS_2004', 'ISS 2004'),
        ('SOAT',     'SOAT'),
    ]
    TIPO_CHOICES = [
        ('bilateral',          'Bilateral'),
        ('misma_via',          'Mismo especialista – Misma v\xeda'),
        ('diferente_via',      'Mismo especialista – Diferente v\xeda'),
        ('multiple_misma_a',   'M\xfaltiple especialista – Misma v\xeda (Cirujano A)'),
        ('multiple_misma_b',   'M\xfaltiple especialista – Misma v\xeda (Cirujano B)'),
        ('multiple_diferente_a','M\xfaltiple especialista – Diferente v\xeda (Cirujano A)'),
        ('multiple_diferente_b','M\xfaltiple especialista – Diferente v\xeda (Cirujano B)'),
    ]
    ESTADO_CHOICES = [('borrador','Borrador'),('finalizada','Finalizada'),('facturada','Facturada')]

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    descripcion_qx   = models.OneToOneField('DescripcionQuirurgica', on_delete=models.CASCADE,
                                             related_name='liquidacion', null=True, blank=True)
    ingreso          = models.ForeignKey(Ingreso, on_delete=models.SET_NULL, null=True, blank=True,
                                          related_name='liquidaciones_cx')
    tipo_tarifario   = models.CharField(max_length=10, choices=TARIFARIO_CHOICES, default='ISS_2001')
    tipo_liquidacion = models.CharField(max_length=25, choices=TIPO_CHOICES, default='misma_via')
    estado           = models.CharField(max_length=15, choices=ESTADO_CHOICES, default='borrador')
    observaciones    = models.TextField(blank=True)
    total_cirujano      = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_anestesiologo = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_ayudante      = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_quirofano     = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_materiales    = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_general       = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    creado_en        = models.DateTimeField(auto_now_add=True)
    actualizado_en   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-creado_en']
        verbose_name = 'Liquidaci\xf3n de cirug\xeda'
        verbose_name_plural = 'Liquidaciones de cirug\xeda'

    def calcular_totales(self):
        from decimal import Decimal
        tots = {'cirujano':Decimal(0),'anestesiologo':Decimal(0),'ayudante':Decimal(0),'quirofano':Decimal(0),'materiales':Decimal(0)}
        for p in self.procedimientos.all():
            tots['cirujano']      += p.valor_cirujano
            tots['anestesiologo'] += p.valor_anestesiologo
            tots['ayudante']      += p.valor_ayudante
            tots['quirofano']     += p.valor_quirofano
            tots['materiales']    += p.valor_materiales
        self.total_cirujano      = tots['cirujano']
        self.total_anestesiologo = tots['anestesiologo']
        self.total_ayudante      = tots['ayudante']
        self.total_quirofano     = tots['quirofano']
        self.total_materiales    = tots['materiales']
        self.total_general       = sum(tots.values())
        self.save(update_fields=['total_cirujano','total_anestesiologo','total_ayudante',
                                  'total_quirofano','total_materiales','total_general','actualizado_en'])


class ProcedimientoLiquidacion(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    liquidacion  = models.ForeignKey(LiquidacionCirugia, on_delete=models.CASCADE, related_name='procedimientos')
    orden        = models.PositiveSmallIntegerField(help_text='1=mayor UVR, 2, 3...')
    cups         = models.CharField(max_length=15)
    descripcion  = models.CharField(max_length=300, blank=True)
    valor_base   = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    pct_cirujano      = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    pct_anestesiologo = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    pct_ayudante      = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    pct_quirofano     = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    pct_materiales    = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    valor_cirujano      = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    valor_anestesiologo = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    valor_ayudante      = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    valor_quirofano     = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    valor_materiales    = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    subtotal            = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        ordering = ['orden']
        constraints = [
            models.UniqueConstraint(fields=['liquidacion', 'orden'], name='unique_liquidacion_orden')
        ]

    def aplicar_porcentajes(self):
        from decimal import Decimal
        uvr = Decimal(str(self.valor_base))   # valor_base almacena PUNTOS UVR
        tar = self.liquidacion.tipo_tarifario

        # Base por servicio según tarifario (ISS 2001 multipliers per UVR point)
        if tar == 'ISS_2001':
            b_cir   = (uvr * Decimal('1270')).quantize(Decimal('1'))
            b_anest = (uvr * Decimal('960')).quantize(Decimal('1'))
            b_ayud  = (uvr * Decimal('360')).quantize(Decimal('1'))
            b_sala  = _sala_iss2001(uvr)
            b_mat   = _mat_iss2001(uvr)
        elif tar == 'ISS_2004':
            # ISS 2004 Acuerdo 312: factor único UVR-S = $100 integral (incluye todo)
            b_cir   = (uvr * Decimal('100')).quantize(Decimal('1'))
            b_anest = (uvr * Decimal('80')).quantize(Decimal('1'))
            b_ayud  = (uvr * Decimal('28')).quantize(Decimal('1'))
            b_sala  = (uvr * Decimal('100')).quantize(Decimal('1'))
            b_mat   = Decimal('0')   # ISS 2004 incluye materiales en tarifa integral
        else:  # SOAT — usa mismos multiplicadores que ISS 2001
            b_cir   = (uvr * Decimal('1270')).quantize(Decimal('1'))
            b_anest = (uvr * Decimal('960')).quantize(Decimal('1'))
            b_ayud  = (uvr * Decimal('360')).quantize(Decimal('1'))
            b_sala  = _sala_iss2001(uvr)
            b_mat   = _mat_iss2001(uvr)

        # Aplicar porcentajes de la tabla de liquidación (múltiples procedimientos)
        tabla = TABLA_PCT_LIQUIDACION.get(self.liquidacion.tipo_liquidacion, {})
        idx   = self.orden - 1

        def aplicar(servicio, base):
            lista = tabla.get(tar, {}).get(servicio, [100])
            val   = lista[idx] if idx < len(lista) else None
            p     = Decimal(str(val)) if val is not None else Decimal('0')
            return p, (base * p / 100).quantize(Decimal('1'))

        self.pct_cirujano,      self.valor_cirujano      = aplicar('cirujano',      b_cir)
        self.pct_anestesiologo, self.valor_anestesiologo = aplicar('anestesiologo', b_anest)
        self.pct_ayudante,      self.valor_ayudante      = aplicar('ayudante',      b_ayud)
        self.pct_quirofano,     self.valor_quirofano     = aplicar('quirofano',     b_sala)
        self.pct_materiales,    self.valor_materiales    = aplicar('materiales',    b_mat)
        self.subtotal = (self.valor_cirujano + self.valor_anestesiologo +
                         self.valor_ayudante + self.valor_quirofano + self.valor_materiales)
