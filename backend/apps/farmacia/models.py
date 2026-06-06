"""Módulo Farmacia y Dispensación"""
from django.db import models
from django.contrib.auth import get_user_model
import uuid

User = get_user_model()


class MedicamentoFarmacia(models.Model):
    """Catálogo interno de medicamentos de la IPS con inventario."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nombre_generico = models.CharField(max_length=200)
    nombre_comercial = models.CharField(max_length=200, blank=True)
    cum = models.CharField(max_length=20, blank=True, help_text='Código único de medicamentos INVIMA')
    forma_farmaceutica = models.CharField(max_length=100, blank=True, help_text='Tableta, solución, ampolla, etc.')
    concentracion = models.CharField(max_length=100, blank=True, help_text='ej: 500mg, 10mg/ml')
    via_administracion = models.CharField(max_length=50, blank=True)
    clase_riesgo = models.CharField(max_length=10, blank=True, help_text='A, B, C, D, X (categoría embarazo)')
    requiere_formula = models.BooleanField(default=False)
    medicamento_alto_riesgo = models.BooleanField(default=False, help_text='Insulina, anticoagulantes, etc.')
    activo = models.BooleanField(default=True)
    stock_minimo = models.PositiveIntegerField(default=10, help_text='Alerta de stock bajo')
    stock_actual = models.IntegerField(default=0)
    unidad_medida = models.CharField(max_length=20, default='und', help_text='und, ml, mg, g')
    precio_unitario = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    ubicacion_bodega = models.CharField(max_length=100, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['nombre_generico']
        verbose_name = 'Medicamento farmacia'
        verbose_name_plural = 'Medicamentos farmacia'

    def __str__(self):
        return f'{self.nombre_generico} {self.concentracion}'

    @property
    def stock_bajo(self):
        return self.stock_actual <= self.stock_minimo


class LoteInventario(models.Model):
    """Lote de medicamento con fecha de vencimiento y trazabilidad."""
    ESTADO_CHOICES = [
        ('disponible', 'Disponible'),
        ('agotado',    'Agotado'),
        ('vencido',    'Vencido'),
        ('retirado',   'Retirado del mercado'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    medicamento = models.ForeignKey(MedicamentoFarmacia, on_delete=models.CASCADE, related_name='lotes')
    numero_lote = models.CharField(max_length=50)
    fecha_vencimiento = models.DateField()
    cantidad_inicial = models.PositiveIntegerField()
    cantidad_actual = models.IntegerField(default=0)
    precio_compra = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    proveedor = models.CharField(max_length=200, blank=True)
    registro_invima = models.CharField(max_length=50, blank=True)
    estado = models.CharField(max_length=15, choices=ESTADO_CHOICES, default='disponible')
    fecha_ingreso = models.DateField(auto_now_add=True)
    ingresado_por = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='lotes_ingresados'
    )

    class Meta:
        ordering = ['fecha_vencimiento']
        verbose_name = 'Lote inventario'

    def __str__(self):
        return f'{self.medicamento.nombre_generico} — Lote {self.numero_lote}'


class MovimientoInventario(models.Model):
    """Entrada o salida de stock con trazabilidad completa."""
    TIPO_CHOICES = [
        ('entrada',    'Entrada (compra/donación)'),
        ('salida',     'Salida (dispensación)'),
        ('ajuste_pos', 'Ajuste positivo'),
        ('ajuste_neg', 'Ajuste negativo'),
        ('devolucion', 'Devolución paciente'),
        ('vencimiento', 'Baja por vencimiento'),
        ('traslado',   'Traslado entre servicios'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    medicamento = models.ForeignKey(MedicamentoFarmacia, on_delete=models.CASCADE, related_name='movimientos')
    lote = models.ForeignKey(LoteInventario, on_delete=models.SET_NULL, null=True, blank=True)
    tipo = models.CharField(max_length=15, choices=TIPO_CHOICES)
    cantidad = models.IntegerField(help_text='Positivo=entrada, negativo=salida')
    stock_resultante = models.IntegerField()
    motivo = models.CharField(max_length=300, blank=True)
    referencia = models.CharField(max_length=100, blank=True, help_text='Nro. orden compra, dispensación, etc.')
    usuario = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='movimientos_inventario'
    )
    fecha_hora = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha_hora']
        verbose_name = 'Movimiento inventario'


class DispensacionMedicamento(models.Model):
    """Dispensación de medicamentos a un paciente hospitalizado o ambulatorio."""
    ESTADO_CHOICES = [
        ('pendiente',  'Pendiente'),
        ('dispensado', 'Dispensado'),
        ('devuelto',   'Devuelto'),
        ('cancelado',  'Cancelado'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    paciente = models.ForeignKey('pacientes.Paciente', on_delete=models.PROTECT, related_name='dispensaciones')
    ingreso = models.ForeignKey('historia.Ingreso', on_delete=models.SET_NULL, null=True, blank=True, related_name='dispensaciones')
    medicamento = models.ForeignKey(MedicamentoFarmacia, on_delete=models.PROTECT, related_name='dispensaciones')
    lote = models.ForeignKey(LoteInventario, on_delete=models.SET_NULL, null=True, blank=True)
    cantidad = models.PositiveIntegerField()
    dosis = models.CharField(max_length=50, blank=True)
    frecuencia = models.CharField(max_length=50, blank=True)
    via_administracion = models.CharField(max_length=50, blank=True)
    duracion_dias = models.PositiveIntegerField(null=True, blank=True)
    medico_prescriptor = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='prescripciones_dispensadas'
    )
    dispensado_por = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='dispensaciones_realizadas'
    )
    estado = models.CharField(max_length=15, choices=ESTADO_CHOICES, default='pendiente')
    observaciones = models.TextField(blank=True)
    fecha_prescripcion = models.DateTimeField(auto_now_add=True)
    fecha_dispensacion = models.DateTimeField(null=True, blank=True)
    valor_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        ordering = ['-fecha_prescripcion']
        verbose_name = 'Dispensación medicamento'

    def __str__(self):
        return f'{self.medicamento.nombre_generico} x{self.cantidad} — {self.paciente}'

    def save(self, *args, **kwargs):
        self.valor_total = self.cantidad * self.medicamento.precio_unitario
        super().save(*args, **kwargs)
