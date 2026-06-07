"""Módulo Contabilidad básica IPS"""
from django.db import models
from django.contrib.auth import get_user_model
import uuid

User = get_user_model()


class CuentaContable(models.Model):
    TIPO_CHOICES = [
        ('activo', 'Activo'),
        ('pasivo', 'Pasivo'),
        ('patrimonio', 'Patrimonio'),
        ('ingreso', 'Ingreso'),
        ('gasto', 'Gasto'),
        ('costo', 'Costo'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    codigo = models.CharField(max_length=20, unique=True)
    nombre = models.CharField(max_length=200)
    tipo = models.CharField(max_length=15, choices=TIPO_CHOICES)
    cuenta_padre = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='subcuentas',
    )
    naturaleza = models.CharField(
        max_length=7,
        choices=[('debito', 'Débito'), ('credito', 'Crédito')],
    )
    activa = models.BooleanField(default=True)

    class Meta:
        ordering = ['codigo']
        verbose_name = 'Cuenta contable'

    def __str__(self):
        return f'{self.codigo} — {self.nombre}'


class AsientoContable(models.Model):
    TIPO_CHOICES = [
        ('ingreso', 'Ingreso'),
        ('egreso', 'Egreso'),
        ('traslado', 'Traslado'),
        ('ajuste', 'Ajuste'),
        ('apertura', 'Apertura'),
        ('cierre', 'Cierre'),
    ]
    ESTADO_CHOICES = [
        ('borrador', 'Borrador'),
        ('aprobado', 'Aprobado'),
        ('anulado', 'Anulado'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    numero = models.PositiveIntegerField(editable=False)
    tipo = models.CharField(max_length=15, choices=TIPO_CHOICES)
    fecha = models.DateField()
    descripcion = models.CharField(max_length=300)
    referencia = models.CharField(max_length=100, blank=True, help_text='Nro. factura, recibo, etc.')
    estado = models.CharField(max_length=10, choices=ESTADO_CHOICES, default='borrador')
    creado_por = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='asientos_contables',
    )
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha', '-numero']
        verbose_name = 'Asiento contable'

    def save(self, *args, **kwargs):
        if not self.numero:
            ultimo = AsientoContable.objects.order_by('-numero').first()
            self.numero = (ultimo.numero + 1) if ultimo else 1
        super().save(*args, **kwargs)

    def __str__(self):
        return f'Asiento {self.numero} — {self.descripcion}'


class LineaAsiento(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    asiento = models.ForeignKey(AsientoContable, on_delete=models.CASCADE, related_name='lineas')
    cuenta = models.ForeignKey(CuentaContable, on_delete=models.PROTECT, related_name='lineas')
    descripcion = models.CharField(max_length=200, blank=True)
    debito = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    credito = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        verbose_name = 'Línea asiento'

    def __str__(self):
        return f'{self.cuenta} D:{self.debito} C:{self.credito}'


class PresupuestoAnual(models.Model):
    ESTADO_CHOICES = [
        ('borrador', 'Borrador'),
        ('aprobado', 'Aprobado'),
        ('ejecutando', 'Ejecutando'),
        ('cerrado', 'Cerrado'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ano = models.PositiveSmallIntegerField()
    nombre = models.CharField(max_length=200)
    total_ingresos_presupuestados = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    total_gastos_presupuestados = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    estado = models.CharField(max_length=15, choices=ESTADO_CHOICES, default='borrador')
    aprobado_por = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='presupuestos_aprobados',
    )
    observaciones = models.TextField(blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-ano']
        verbose_name = 'Presupuesto anual'

    def __str__(self):
        return f'Presupuesto {self.ano} — {self.nombre}'
