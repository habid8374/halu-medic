"""
Modelos del módulo Consultas
Registro clínico con CUPS, diagnósticos CIE-10, procedimientos y medicamentos
Es el origen del RIPS y la Factura Electrónica
"""
from django.db import models
from django.contrib.auth import get_user_model
import uuid

User = get_user_model()


class Consulta(models.Model):
    """
    Registro de la atención médica. Es la fuente primaria para:
    - Generar la Factura Electrónica (FEV) vía Factus
    - Generar el RIPS JSON (Res. 948/2026)
    """
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cita        = models.OneToOneField('citas.Cita', on_delete=models.PROTECT,
                                        related_name='consulta', null=True, blank=True)
    paciente    = models.ForeignKey('pacientes.Paciente', on_delete=models.PROTECT,
                                     related_name='consultas')
    medico      = models.ForeignKey('citas.Medico', on_delete=models.PROTECT,
                                     related_name='consultas')
    convenio    = models.ForeignKey('tarifas.ConvenioEPS', on_delete=models.SET_NULL,
                                     null=True, blank=True)

    fecha_atencion = models.DateTimeField()

    # CUPS principal de la consulta
    cups_principal  = models.CharField(max_length=10, help_text='Código CUPS de la consulta')
    descripcion_cups = models.CharField(max_length=300, blank=True)

    # Diagnósticos CIE-10
    diagnostico_principal     = models.CharField(max_length=10, help_text='CIE-10')
    diagnostico_relacionado_1 = models.CharField(max_length=10, blank=True)
    diagnostico_relacionado_2 = models.CharField(max_length=10, blank=True)
    diagnostico_relacionado_3 = models.CharField(max_length=10, blank=True)

    TIPO_DIAGNOSTICO = [
        ('1', 'Impresión diagnóstica'),
        ('2', 'Confirmado nuevo'),
        ('3', 'Confirmado repetido'),
    ]
    tipo_diagnostico = models.CharField(max_length=1, choices=TIPO_DIAGNOSTICO, default='1')

    # Campos clínicos
    motivo_consulta   = models.TextField(blank=True)
    enfermedad_actual = models.TextField(blank=True)
    examen_fisico     = models.TextField(blank=True)
    plan_tratamiento  = models.TextField(blank=True)
    observaciones     = models.TextField(blank=True)

    # Autorización EPS
    numero_autorizacion = models.CharField(max_length=50, blank=True)

    # Campos RIPS (Res. 948/2026)
    modalidad        = models.CharField(max_length=3, default='01',
                                         help_text='Modalidad grupo servicio (RIPS)')
    grupo_servicio   = models.CharField(max_length=3, default='01',
                                         help_text='Grupo de servicios (RIPS)')
    codigo_servicio  = models.CharField(max_length=5, default='1')
    finalidad        = models.CharField(max_length=3, default='13',
                                         help_text='Finalidad tecnología en salud')
    causa_atencion   = models.CharField(max_length=3, default='26',
                                         help_text='Causa motivo atención')

    # Valores financieros
    valor_consulta   = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    valor_copago     = models.DecimalField(max_digits=14, decimal_places=2, default=0,
                                            help_text='Valor copago o cuota moderadora a cargo del paciente')

    # Estado
    ESTADOS = [
        ('abierta',    'Abierta'),
        ('cerrada',    'Cerrada'),
        ('facturada',  'Facturada'),
        ('anulada',    'Anulada'),
    ]
    estado = models.CharField(max_length=15, choices=ESTADOS, default='abierta')

    creado_por     = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    creado_en      = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-fecha_atencion']
        indexes = [
            models.Index(fields=['paciente', 'fecha_atencion']),
            models.Index(fields=['medico', 'fecha_atencion']),
            models.Index(fields=['estado']),
        ]

    def __str__(self):
        return f'Consulta {self.paciente} — {self.fecha_atencion:%d/%m/%Y} — {self.cups_principal}'

    @property
    def valor_total(self):
        total = self.valor_consulta
        for proc in self.procedimientos.all():
            total += proc.valor_facturar
        return total


class Procedimiento(models.Model):
    """Procedimientos adicionales realizados durante la consulta."""
    id        = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    consulta  = models.ForeignKey(Consulta, on_delete=models.CASCADE, related_name='procedimientos')
    cups      = models.CharField(max_length=10, help_text='Código CUPS')
    descripcion = models.CharField(max_length=300)
    valor_facturar = models.DecimalField(max_digits=14, decimal_places=2)

    # Campos RIPS
    ambito           = models.CharField(max_length=2, default='1',
                                         help_text='1=Ambulatorio, 2=Hospitalario, 3=Urgencias')
    finalidad        = models.CharField(max_length=3, default='01')
    personal_atiende = models.CharField(max_length=3, default='01',
                                         help_text='01=Médico especialista, 02=Médico general...')
    via_diagnostica  = models.CharField(max_length=2, default='1')
    grupo            = models.CharField(max_length=2, default='1')

    cantidad  = models.PositiveIntegerField(default=1)
    orden     = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ['orden']

    def __str__(self):
        return f'CUPS {self.cups} — {self.descripcion} — ${self.valor_facturar:,.0f}'


class Medicamento(models.Model):
    """Medicamentos dispensados o administrados durante la consulta."""
    id        = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    consulta  = models.ForeignKey(Consulta, on_delete=models.CASCADE, related_name='medicamentos')
    nombre    = models.CharField(max_length=200)
    cum       = models.CharField(max_length=20, blank=True, help_text='Código Único de Medicamento')

    TIPO_CHOICES = [('1', 'Medicamento'), ('2', 'Dispositivo médico')]
    tipo      = models.CharField(max_length=1, choices=TIPO_CHOICES, default='1')

    concentracion      = models.CharField(max_length=50, blank=True)
    unidad_medida      = models.CharField(max_length=20, blank=True)
    forma_farmaceutica = models.CharField(max_length=50, blank=True)
    unidades           = models.PositiveIntegerField(default=1)
    valor_unitario     = models.DecimalField(max_digits=14, decimal_places=2)
    fecha              = models.DateTimeField()

    @property
    def valor_total(self):
        return self.unidades * self.valor_unitario

    def __str__(self):
        return f'{self.nombre} x{self.unidades}'
