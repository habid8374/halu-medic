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
