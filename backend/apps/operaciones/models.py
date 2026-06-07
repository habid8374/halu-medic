"""Módulo Operaciones — Esterilización, Mantenimiento Biomédico, Nutrición Hospitalaria"""
from django.db import models
from django.contrib.auth import get_user_model
import uuid

User = get_user_model()


# ── ESTERILIZACIÓN ─────────────────────────────────────────────────────────────

class EquipoEsterilizable(models.Model):
    TIPO_CHOICES = [
        ('instrumental', 'Instrumental quirúrgico'),
        ('endoscopia', 'Endoscopio'),
        ('textil', 'Textil/Ropa quirúrgica'),
        ('contenedor', 'Contenedor/Caja'),
        ('otro', 'Otro'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    codigo = models.CharField(max_length=30, unique=True)
    nombre = models.CharField(max_length=200)
    tipo = models.CharField(max_length=15, choices=TIPO_CHOICES)
    servicio_propietario = models.CharField(max_length=100, blank=True)
    cantidad_unidades = models.PositiveIntegerField(default=1)
    material = models.CharField(max_length=100, blank=True, help_text='Acero inox, silicona, etc.')
    activo = models.BooleanField(default=True)

    class Meta:
        ordering = ['nombre']
        verbose_name = 'Equipo esterilizable'

    def __str__(self):
        return f'{self.codigo} — {self.nombre}'


class CicloEsterilizacion(models.Model):
    METODO_CHOICES = [
        ('autoclave_vapor', 'Autoclave a vapor (134°C)'),
        ('autoclave_ETO', 'Óxido de etileno (ETO)'),
        ('plasma_peroxido', 'Plasma de peróxido de hidrógeno'),
        ('glutaraldehido', 'Glutaraldehído 2%'),
        ('calor_seco', 'Calor seco (horno Pasteur)'),
        ('otro', 'Otro'),
    ]
    RESULTADO_CHOICES = [
        ('aprobado', 'Aprobado'),
        ('rechazado', 'Rechazado — reprocesar'),
        ('en_proceso', 'En proceso'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    numero_ciclo = models.PositiveIntegerField(editable=False)
    equipos = models.ManyToManyField(EquipoEsterilizable, related_name='ciclos')
    metodo = models.CharField(max_length=25, choices=METODO_CHOICES)
    equipo_autoclave = models.CharField(max_length=100, blank=True, help_text='Nombre/serial del autoclave')
    temperatura_programada = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    presion_programada = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    tiempo_ciclo_min = models.PositiveIntegerField(null=True, blank=True)
    fecha_hora_inicio = models.DateTimeField()
    fecha_hora_fin = models.DateTimeField(null=True, blank=True)
    resultado = models.CharField(max_length=15, choices=RESULTADO_CHOICES, default='en_proceso')
    indicador_biologico = models.CharField(
        max_length=15,
        choices=[('positivo', 'Positivo'), ('negativo', 'Negativo'), ('pendiente', 'Pendiente')],
        default='pendiente',
    )
    indicador_quimico = models.CharField(
        max_length=15,
        choices=[('aprobado', 'Aprobado'), ('fallido', 'Fallido')],
        default='aprobado',
    )
    lote_esterilizacion = models.CharField(max_length=30, blank=True)
    operador = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='ciclos_esterilizacion',
    )
    observaciones = models.TextField(blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha_hora_inicio']
        verbose_name = 'Ciclo de esterilización'

    def save(self, *args, **kwargs):
        if not self.numero_ciclo:
            ultimo = CicloEsterilizacion.objects.order_by('-numero_ciclo').first()
            self.numero_ciclo = (ultimo.numero_ciclo + 1) if ultimo else 1
        super().save(*args, **kwargs)

    def __str__(self):
        return f'Ciclo {self.numero_ciclo} — {self.get_metodo_display()} — {self.resultado}'


# ── MANTENIMIENTO BIOMÉDICO ────────────────────────────────────────────────────

class EquipoBiomedico(models.Model):
    TIPO_CHOICES = [
        ('diagnostico', 'Diagnóstico'),
        ('terapeutico', 'Terapéutico'),
        ('apoyo', 'Apoyo vital'),
        ('laboratorio', 'Laboratorio'),
        ('imagenologia', 'Imagenología'),
        ('rehabilitacion', 'Rehabilitación'),
        ('otro', 'Otro'),
    ]
    ESTADO_CHOICES = [
        ('operativo', 'Operativo'),
        ('en_mantenimiento', 'En mantenimiento'),
        ('fuera_servicio', 'Fuera de servicio'),
        ('dado_baja', 'Dado de baja'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    codigo_inventario = models.CharField(max_length=30, unique=True)
    nombre = models.CharField(max_length=200)
    marca = models.CharField(max_length=100, blank=True)
    modelo = models.CharField(max_length=100, blank=True)
    serial = models.CharField(max_length=100, blank=True)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    servicio = models.CharField(max_length=100, blank=True)
    ubicacion = models.CharField(max_length=200, blank=True)
    fecha_adquisicion = models.DateField(null=True, blank=True)
    valor_adquisicion = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    vida_util_anos = models.PositiveSmallIntegerField(null=True, blank=True)
    registro_invima = models.CharField(max_length=50, blank=True)
    proveedor = models.CharField(max_length=200, blank=True)
    contacto_proveedor = models.CharField(max_length=200, blank=True)
    frecuencia_mant_preventivo_meses = models.PositiveSmallIntegerField(default=6)
    ultimo_mantenimiento = models.DateField(null=True, blank=True)
    proximo_mantenimiento = models.DateField(null=True, blank=True)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='operativo')
    observaciones = models.TextField(blank=True)

    class Meta:
        ordering = ['nombre']
        verbose_name = 'Equipo biomédico'

    def __str__(self):
        return f'{self.codigo_inventario} — {self.nombre} ({self.marca})'


class OrdenMantenimiento(models.Model):
    TIPO_CHOICES = [
        ('preventivo', 'Preventivo'),
        ('correctivo', 'Correctivo'),
        ('calibracion', 'Calibración'),
        ('instalacion', 'Instalación'),
    ]
    ESTADO_CHOICES = [
        ('abierta', 'Abierta'),
        ('en_proceso', 'En proceso'),
        ('completada', 'Completada'),
        ('cancelada', 'Cancelada'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    numero_orden = models.PositiveIntegerField(editable=False)
    equipo = models.ForeignKey(EquipoBiomedico, on_delete=models.CASCADE, related_name='ordenes_mantenimiento')
    tipo = models.CharField(max_length=15, choices=TIPO_CHOICES)
    descripcion_falla = models.TextField(blank=True)
    actividades_realizadas = models.TextField(blank=True)
    repuestos_utilizados = models.TextField(blank=True)
    tecnico = models.CharField(max_length=200, blank=True)
    empresa_externa = models.CharField(max_length=200, blank=True)
    costo = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    fecha_solicitud = models.DateTimeField(auto_now_add=True)
    fecha_inicio = models.DateTimeField(null=True, blank=True)
    fecha_fin = models.DateTimeField(null=True, blank=True)
    equipo_operativo_post = models.BooleanField(default=True)
    estado = models.CharField(max_length=15, choices=ESTADO_CHOICES, default='abierta')
    solicitado_por = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='ordenes_mant_solicitadas',
    )

    class Meta:
        ordering = ['-fecha_solicitud']
        verbose_name = 'Orden de mantenimiento'

    def save(self, *args, **kwargs):
        if not self.numero_orden:
            ultimo = OrdenMantenimiento.objects.order_by('-numero_orden').first()
            self.numero_orden = (ultimo.numero_orden + 1) if ultimo else 1
        super().save(*args, **kwargs)

    def __str__(self):
        return f'OT-{str(self.numero_orden).zfill(5)} — {self.equipo.nombre}'


# ── NUTRICIÓN HOSPITALARIA ─────────────────────────────────────────────────────

class DietaTerapeutica(models.Model):
    TIPO_CHOICES = [
        ('normal', 'Normal/Libre'),
        ('blanda', 'Blanda'),
        ('liquida', 'Líquida'),
        ('licuada', 'Licuada'),
        ('hipocalorica', 'Hipocalórica'),
        ('hipercalorica', 'Hipercalórica'),
        ('hiposodica', 'Hiposódica'),
        ('diabetica', 'Diabética'),
        ('renal', 'Renal'),
        ('hepatica', 'Hepática'),
        ('npo', 'NPO — Nada por vía oral'),
        ('otro', 'Otra'),
    ]
    VIA_CHOICES = [
        ('oral', 'Oral'),
        ('sonda_ng', 'Sonda nasogástrica'),
        ('sonda_peg', 'Sonda PEG/yeyunal'),
        ('parenteral', 'Nutrición parenteral'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ingreso = models.ForeignKey('historia.Ingreso', on_delete=models.CASCADE, related_name='dietas')
    paciente = models.ForeignKey('pacientes.Paciente', on_delete=models.PROTECT, related_name='dietas')
    tipo_dieta = models.CharField(max_length=20, choices=TIPO_CHOICES)
    via_administracion = models.CharField(max_length=15, choices=VIA_CHOICES, default='oral')
    calorias_dia = models.PositiveIntegerField(null=True, blank=True, help_text='Kcal/día prescritas')
    proteinas_g = models.DecimalField(max_digits=6, decimal_places=1, null=True, blank=True)
    restricciones = models.TextField(blank=True, help_text='Alimentos restringidos, alergias alimentarias')
    suplementos = models.TextField(blank=True)
    observaciones = models.TextField(blank=True)
    medico_prescriptor = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='dietas_prescritas',
    )
    nutricionista = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='dietas_asignadas',
    )
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField(null=True, blank=True)
    activa = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-creado_en']
        verbose_name = 'Dieta terapéutica'

    def __str__(self):
        return f'{self.get_tipo_dieta_display()} — {self.paciente}'
