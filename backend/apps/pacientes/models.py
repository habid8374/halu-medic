"""
Modelos del módulo Pacientes
Incluye: Paciente, Aseguradora, EpsConvenio
Alineado con Resolución 948/2026 (CUCON en convenios EPS)
"""
from django.db import models
import uuid


class TipoIdentificacion(models.TextChoices):
    CC  = 'CC',  'Cédula de ciudadanía'
    CE  = 'CE',  'Cédula de extranjería'
    TI  = 'TI',  'Tarjeta de identidad'
    RC  = 'RC',  'Registro civil'
    PA  = 'PA',  'Pasaporte'
    MS  = 'MS',  'Menor sin identificación'
    AS  = 'AS',  'Adulto sin identificación'
    NIT = 'NIT', 'NIT'


class RegimenAfiliacion(models.TextChoices):
    CONTRIBUTIVO = 'C', 'Contributivo'
    SUBSIDIADO   = 'S', 'Subsidiado'
    VINCULADO    = 'V', 'Vinculado'
    PARTICULAR   = 'P', 'Particular'
    ARP          = 'A', 'ARP / ARL'
    SOAT         = 'T', 'SOAT'
    OTRO         = 'O', 'Otro'


class Aseguradora(models.Model):
    """EPS, medicina prepagada, ARL, aseguradora SOAT"""
    id        = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nombre    = models.CharField(max_length=200)
    nit       = models.CharField(max_length=20)
    codigo    = models.CharField(max_length=10, help_text='Código RIPS MinSalud')
    tipo      = models.CharField(max_length=20, choices=[
        ('EPS', 'EPS'), ('PREPAGADA', 'Medicina prepagada'),
        ('ARL', 'ARL'), ('SOAT', 'SOAT'), ('OTRO', 'Otro'),
    ])
    regimen   = models.CharField(
        max_length=1,
        choices=RegimenAfiliacion.choices,
        blank=True,
        help_text='Régimen de afiliación (C=Contributivo, S=Subsidiado, …). '
                  'Permite que una misma EPS tenga dos entradas con distinto régimen.',
    )
    tarifario = models.ForeignKey(
        'tarifas.ManualTarifario',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='aseguradoras',
        help_text='Tarifario base para facturar a esta aseguradora',
    )
    porcentaje_ajuste = models.DecimalField(
        max_digits=6, decimal_places=2, default=0,
        help_text='% contractual adicional sobre el tarifario. Ej: 35 = +35%',
    )
    activa    = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['nombre', 'regimen']
        unique_together = [('nit', 'regimen')]

    def __str__(self):
        regimen_label = dict(RegimenAfiliacion.choices).get(self.regimen, '')
        sufijo = f' ({regimen_label})' if regimen_label else ''
        return f'{self.nombre}{sufijo} — {self.nit}'


class Paciente(models.Model):
    id                 = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tipo_identificacion = models.CharField(max_length=5, choices=TipoIdentificacion.choices)
    numero_identificacion = models.CharField(max_length=30)
    primer_nombre      = models.CharField(max_length=80)
    segundo_nombre     = models.CharField(max_length=80, blank=True)
    primer_apellido    = models.CharField(max_length=80)
    segundo_apellido   = models.CharField(max_length=80, blank=True)
    fecha_nacimiento   = models.DateField()
    sexo               = models.CharField(max_length=1, choices=[('M', 'Masculino'), ('F', 'Femenino'), ('I', 'Indeterminado')])
    email              = models.EmailField(blank=True)
    telefono           = models.CharField(max_length=20, blank=True)
    direccion          = models.CharField(max_length=200, blank=True)
    municipio_codigo   = models.CharField(max_length=10, blank=True, help_text='Código DANE')

    # Aseguramiento
    regimen            = models.CharField(max_length=1, choices=RegimenAfiliacion.choices, default=RegimenAfiliacion.PARTICULAR)
    aseguradora        = models.ForeignKey(Aseguradora, null=True, blank=True, on_delete=models.SET_NULL, related_name='pacientes')
    tarifa             = models.ForeignKey(
        'tarifas.ManualTarifario',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='pacientes',
        help_text='Tarifa asignada a este paciente. Si está vacío, se usa la predeterminada del consultorio.'
    )
    numero_poliza      = models.CharField(max_length=50, blank=True)

    activo             = models.BooleanField(default=True)
    creado_en          = models.DateTimeField(auto_now_add=True)
    actualizado_en     = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['tipo_identificacion', 'numero_identificacion']
        ordering = ['primer_apellido', 'primer_nombre']

    def __str__(self):
        return f'{self.primer_apellido} {self.primer_nombre} — {self.tipo_identificacion} {self.numero_identificacion}'

    @property
    def nombre_completo(self):
        partes = [self.primer_nombre, self.segundo_nombre, self.primer_apellido, self.segundo_apellido]
        return ' '.join(p for p in partes if p)
