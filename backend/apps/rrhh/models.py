"""Módulo Recursos Humanos — Contratos, Turnos, Nómina"""
from django.db import models
from django.contrib.auth import get_user_model
import uuid

User = get_user_model()


class Cargo(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nombre = models.CharField(max_length=200)
    departamento = models.CharField(max_length=100, blank=True)
    nivel = models.CharField(max_length=50, blank=True, help_text='Asistencial, Administrativo, Directivo')
    requiere_tarjeta_prof = models.BooleanField(default=False)
    activo = models.BooleanField(default=True)

    class Meta:
        ordering = ['nombre']
        verbose_name = 'Cargo'

    def __str__(self):
        return self.nombre


class ContratoEmpleado(models.Model):
    TIPO_CHOICES = [
        ('termino_fijo', 'Término fijo'),
        ('termino_indefinido', 'Término indefinido'),
        ('obra_labor', 'Obra o labor'),
        ('prestacion_servicios', 'Prestación de servicios'),
        ('aprendizaje', 'Contrato de aprendizaje'),
    ]
    ESTADO_CHOICES = [
        ('activo', 'Activo'),
        ('vencido', 'Vencido'),
        ('terminado', 'Terminado'),
        ('suspendido', 'Suspendido'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empleado = models.ForeignKey(User, on_delete=models.CASCADE, related_name='contratos')
    cargo = models.ForeignKey(Cargo, on_delete=models.SET_NULL, null=True, blank=True)
    tipo = models.CharField(max_length=25, choices=TIPO_CHOICES)
    salario_basico = models.DecimalField(max_digits=14, decimal_places=2)
    auxilio_transporte = models.BooleanField(default=True)
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField(null=True, blank=True)
    estado = models.CharField(max_length=15, choices=ESTADO_CHOICES, default='activo')
    numero_contrato = models.CharField(max_length=50, blank=True)
    jornada_horas_semana = models.PositiveSmallIntegerField(default=44)
    eps = models.CharField(max_length=200, blank=True)
    arl = models.CharField(max_length=200, blank=True)
    pension = models.CharField(max_length=200, blank=True)
    caja_compensacion = models.CharField(max_length=200, blank=True)
    observaciones = models.TextField(blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha_inicio']
        verbose_name = 'Contrato empleado'

    def __str__(self):
        return f'{self.empleado} — {self.get_tipo_display()}'


class Turno(models.Model):
    TIPO_CHOICES = [
        ('manana', 'Mañana'),
        ('tarde', 'Tarde'),
        ('noche', 'Noche'),
        ('rotativo', 'Rotativo'),
        ('descanso', 'Descanso'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empleado = models.ForeignKey(User, on_delete=models.CASCADE, related_name='turnos')
    fecha = models.DateField()
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    hora_inicio = models.TimeField(null=True, blank=True)
    hora_fin = models.TimeField(null=True, blank=True)
    servicio = models.CharField(max_length=100, blank=True)
    horas_extras = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    novedad = models.CharField(max_length=200, blank=True, help_text='Incapacidad, calamidad, permiso, etc.')

    class Meta:
        ordering = ['-fecha']
        verbose_name = 'Turno'
        unique_together = [['empleado', 'fecha']]

    def __str__(self):
        return f'{self.empleado} — {self.fecha} ({self.get_tipo_display()})'


class LiquidacionNomina(models.Model):
    ESTADO_CHOICES = [
        ('borrador', 'Borrador'),
        ('aprobada', 'Aprobada'),
        ('pagada', 'Pagada'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empleado = models.ForeignKey(User, on_delete=models.CASCADE, related_name='liquidaciones')
    contrato = models.ForeignKey(ContratoEmpleado, on_delete=models.SET_NULL, null=True, blank=True)
    periodo_inicio = models.DateField()
    periodo_fin = models.DateField()
    salario_basico = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    auxilio_transporte = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    horas_extras_diurnas = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    horas_extras_nocturnas = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    otros_devengados = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_devengado = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    descuento_salud = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    descuento_pension = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    descuento_fondo_solidaridad = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    otros_descuentos = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_descuentos = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    neto_pagar = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    estado = models.CharField(max_length=15, choices=ESTADO_CHOICES, default='borrador')
    observaciones = models.TextField(blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-periodo_fin']
        verbose_name = 'Liquidación nómina'

    def save(self, *args, **kwargs):
        self.total_devengado = (
            self.salario_basico + self.auxilio_transporte +
            self.horas_extras_diurnas + self.horas_extras_nocturnas + self.otros_devengados
        )
        self.total_descuentos = (
            self.descuento_salud + self.descuento_pension +
            self.descuento_fondo_solidaridad + self.otros_descuentos
        )
        self.neto_pagar = self.total_devengado - self.total_descuentos
        super().save(*args, **kwargs)

    def __str__(self):
        return f'Nómina {self.empleado} {self.periodo_inicio}—{self.periodo_fin}'


class Incapacidad(models.Model):
    TIPO_CHOICES = [
        ('enfermedad_general', 'Enfermedad general'),
        ('accidente_trabajo', 'Accidente de trabajo'),
        ('enfermedad_profesional', 'Enfermedad profesional'),
        ('maternidad', 'Maternidad/Paternidad'),
        ('licencia', 'Licencia'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empleado = models.ForeignKey(User, on_delete=models.CASCADE, related_name='incapacidades')
    tipo = models.CharField(max_length=25, choices=TIPO_CHOICES)
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField()
    dias = models.PositiveIntegerField()
    diagnostico_cie10 = models.CharField(max_length=10, blank=True)
    medico_expide = models.CharField(max_length=200, blank=True)
    entidad_paga = models.CharField(
        max_length=15,
        choices=[('eps', 'EPS'), ('arl', 'ARL'), ('empleador', 'Empleador')],
        default='eps',
    )
    observaciones = models.TextField(blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha_inicio']
        verbose_name = 'Incapacidad'

    def save(self, *args, **kwargs):
        self.dias = (self.fecha_fin - self.fecha_inicio).days + 1
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.empleado} — {self.get_tipo_display()} {self.fecha_inicio}'
