"""
Modelos del módulo Facturación
Factura electrónica + integración Factus + tareas Celery
"""
from django.db import models
import uuid


class EstadoFactura(models.TextChoices):
    BORRADOR    = 'borrador',    'Borrador'
    ENVIADA     = 'enviada',     'Enviada a Factus'
    VALIDADA    = 'validada',    'Validada por DIAN'
    ERROR       = 'error',       'Error de validación'
    ANULADA     = 'anulada',     'Anulada (nota crédito)'


class Factura(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    consulta    = models.OneToOneField('consultas.Consulta', on_delete=models.PROTECT,
                                        related_name='factura')
    convenio    = models.ForeignKey('tarifas.ConvenioEPS', on_delete=models.SET_NULL,
                                     null=True, blank=True)

    # Datos Factus / DIAN
    numero_factus        = models.CharField(max_length=50, blank=True, help_text='Ej: SETP990000001')
    cufe                 = models.CharField(max_length=100, blank=True, help_text='Código Único FEV')
    qr_url               = models.URLField(blank=True)
    pdf_base64           = models.TextField(blank=True)
    rango_numeracion_id  = models.IntegerField(null=True, blank=True)

    # RIPS
    rips_json            = models.JSONField(null=True, blank=True, help_text='RIPS generado Res. 948/2026')
    cuv                  = models.CharField(max_length=100, blank=True, help_text='Código Único de Validación MUV')
    rips_enviado_mув     = models.BooleanField(default=False)

    # Financiero
    subtotal             = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    descuento            = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    iva                  = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total                = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    valor_copago         = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    estado               = models.CharField(max_length=20, choices=EstadoFactura.choices,
                                             default=EstadoFactura.BORRADOR)
    observaciones        = models.TextField(blank=True)
    errores_dian         = models.JSONField(default=list, blank=True)

    # Auditoría
    creado_en            = models.DateTimeField(auto_now_add=True)
    actualizado_en       = models.DateTimeField(auto_now=True)
    fecha_validacion     = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-creado_en']
        indexes = [
            models.Index(fields=['estado']),
            models.Index(fields=['numero_factus']),
            models.Index(fields=['cufe']),
        ]

    def __str__(self):
        return f'Factura {self.numero_factus or self.id} — {self.estado}'
