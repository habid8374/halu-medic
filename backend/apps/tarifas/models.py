"""
Modelos del módulo Tarifas
Incluye: TipoTarifa, ConvenioEPS (con CUCON), TarifaProcedimiento
Alineado con Resolución 948 de 2026 — CUCON obligatorio en FEV bajo convenio
"""
from django.db import models
import uuid
import hashlib


class TipoTarifa(models.TextChoices):
    SOAT        = 'SOAT',        'SOAT'
    ISS_2001    = 'ISS_2001',    'ISS 2001'
    ISS_2004    = 'ISS_2004',    'ISS 2004'
    PARTICULAR  = 'PARTICULAR',  'Particular'
    CONVENIO    = 'CONVENIO',    'Convenio EPS'
    MANUAL      = 'MANUAL',      'Manual interno'


class ConvenioEPS(models.Model):
    """
    Contrato entre el consultorio y una EPS/aseguradora.
    El CUCON (SHA-256 64 chars) es obligatorio en toda FEV bajo este convenio
    según Resolución 948 de 2026 del MinSalud.
    """
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    aseguradora  = models.ForeignKey(
        'pacientes.Aseguradora', on_delete=models.PROTECT, related_name='convenios'
    )
    numero_contrato = models.CharField(max_length=100, help_text='Número del contrato con la EPS')
    vigencia_desde  = models.DateField()
    vigencia_hasta  = models.DateField()

    # CUCON — Código Único de Contrato (Res. 948/2026)
    # Hash SHA-256 de 64 caracteres generado por el SIIFA del MinSalud
    cucon = models.CharField(
        max_length=64,
        unique=True,
        help_text='Código Único de Contrato SHA-256 (Res. 948/2026). Obligatorio en FEV.'
    )

    tipo_tarifa  = models.CharField(max_length=20, choices=TipoTarifa.choices, default=TipoTarifa.CONVENIO)
    porcentaje_copago = models.DecimalField(max_digits=5, decimal_places=2, default=0,
                                             help_text='% copago a cargo del paciente')
    valor_cuota_moderadora = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    activo       = models.BooleanField(default=True)
    observaciones = models.TextField(blank=True)
    creado_en    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-vigencia_desde']
        verbose_name = 'Convenio EPS'
        verbose_name_plural = 'Convenios EPS'

    def __str__(self):
        return f'{self.aseguradora.nombre} — Contrato {self.numero_contrato}'

    def validar_cucon(self) -> bool:
        """Verifica que el CUCON tenga exactamente 64 caracteres hexadecimales (SHA-256)."""
        import re
        return bool(re.match(r'^[a-f0-9]{64}$', self.cucon.lower()))


class TarifaProcedimiento(models.Model):
    """Valor pactado por código CUPS bajo un convenio específico."""
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    convenio    = models.ForeignKey(ConvenioEPS, on_delete=models.CASCADE, related_name='tarifas',
                                    null=True, blank=True)
    tipo_tarifa = models.CharField(max_length=20, choices=TipoTarifa.choices)
    cups        = models.CharField(max_length=10, help_text='Código CUPS del procedimiento')
    descripcion = models.CharField(max_length=300)
    valor       = models.DecimalField(max_digits=14, decimal_places=2)
    vigente_desde = models.DateField()
    vigente_hasta = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ['cups']
        unique_together = ['convenio', 'cups', 'vigente_desde']

    def __str__(self):
        return f'CUPS {self.cups} — ${self.valor:,.0f}'


class ManualTarifario(models.Model):
    """Manual tarifario del consultorio (SOAT, ISS, Particular, Prepagada, etc.)."""
    id                 = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nombre             = models.CharField(max_length=200, help_text='Ej: SOAT 2026, ISS, Particular')
    tipo               = models.CharField(max_length=20, choices=TipoTarifa.choices, default=TipoTarifa.MANUAL)
    porcentaje_ajuste  = models.DecimalField(max_digits=6, decimal_places=2, default=0,
                                              help_text='% sobre valor base. 30 = +30%, -10 = -10%')
    es_predeterminado  = models.BooleanField(default=False,
                                              help_text='Tarifa usada cuando el paciente no tiene una asignada')
    activo             = models.BooleanField(default=True)
    vigente_desde      = models.DateField(null=True, blank=True)
    vigente_hasta      = models.DateField(null=True, blank=True)
    observaciones      = models.TextField(blank=True)
    creado_en          = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['nombre']
        verbose_name = 'Manual tarifario'
        verbose_name_plural = 'Manuales tarifarios'

    def __str__(self):
        return f'{self.nombre} ({self.get_tipo_display()})'

    def save(self, *args, **kwargs):
        # Solo un tarifario predeterminado a la vez
        if self.es_predeterminado:
            ManualTarifario.objects.exclude(pk=self.pk).update(es_predeterminado=False)
        super().save(*args, **kwargs)


class ItemTarifario(models.Model):
    """Valor de un código CUPS dentro de un manual tarifario."""
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    manual      = models.ForeignKey(ManualTarifario, on_delete=models.CASCADE, related_name='items')
    cups        = models.CharField(max_length=15, help_text='Código CUPS (o código paquete, ej: 876122-1)')
    descripcion = models.CharField(max_length=400, blank=True, help_text='Descripción del procedimiento o paquete')
    valor_base  = models.DecimalField(max_digits=14, decimal_places=2, help_text='Valor base del manual')
    es_paquete  = models.BooleanField(default=False,
                                       help_text='True si este ítem es un paquete tarifario con sufijo')
    cups_rips   = models.CharField(max_length=10, blank=True,
                                    help_text='Código CUPS base para RIPS (sin sufijo). Auto-calculado.')

    class Meta:
        ordering = ['cups']
        unique_together = [['manual', 'cups']]
        verbose_name = 'Ítem tarifario'
        verbose_name_plural = 'Ítems tarifarios'

    def save(self, *args, **kwargs):
        if self.es_paquete:
            if not self.cups_rips:
                import re
                self.cups_rips = re.sub(r'-\d+$', '', self.cups)[:10]
        else:
            self.cups_rips = ''
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.cups} — ${self.valor_base:,.0f}'

    @property
    def valor_final(self):
        """Valor aplicando el porcentaje de ajuste del manual."""
        from decimal import Decimal
        factor = 1 + self.manual.porcentaje_ajuste / Decimal('100')
        return round(self.valor_base * factor, 0)


class TarifaMedicamento(models.Model):
    """
    Tarifa de un medicamento CUM dentro de un manual tarifario.
    Usada para facturar medicamentos cuando la IPS los dispensa.
    """
    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    manual              = models.ForeignKey(ManualTarifario, on_delete=models.CASCADE,
                                             related_name='medicamentos')
    cum                 = models.CharField(max_length=20, help_text='Código Único de Medicamento')
    principio_activo    = models.CharField(max_length=400)
    concentracion       = models.CharField(max_length=150, blank=True)
    forma_farmaceutica  = models.CharField(max_length=150, blank=True)
    valor_base          = models.DecimalField(max_digits=14, decimal_places=2,
                                               help_text='Valor unitario base del medicamento')
    valor_dispensacion  = models.DecimalField(max_digits=14, decimal_places=2, default=0,
                                               help_text='Valor de dispensación (Res.948/2026)')
    vigente             = models.BooleanField(default=True)

    class Meta:
        ordering = ['principio_activo']
        unique_together = [['manual', 'cum']]
        verbose_name = 'Tarifa medicamento'
        verbose_name_plural = 'Tarifas medicamentos'

    def __str__(self):
        return f'{self.cum} — {self.principio_activo} (${self.valor_base:,.0f})'

    @property
    def valor_final(self):
        from decimal import Decimal
        factor = 1 + self.manual.porcentaje_ajuste / Decimal('100')
        return round(self.valor_base * factor, 0)
