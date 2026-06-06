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
