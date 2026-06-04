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
    rips_enviado_muv     = models.BooleanField(default=False)

    # XML DIAN
    xml_base64           = models.TextField(blank=True, help_text='XML enviado a la DIAN en base64')

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


class FacturaHelper:
    """
    Métodos de utilidad para procesar la respuesta JSON de Factus.

    Factus devuelve en /v1/bills/validate:
    {
      "data": {
        "number":       "SETP990000127",      → número FEV
        "cufe":         "44e260a76e...",       → CUFE DIAN (96 chars)
        "qr":           "https://catalogo-vpfe-hab.dian.gov.co/...", → URL QR DIAN
        "qr_image":     "<base64 PNG del QR>", → imagen QR
        "pdf_base_64":  "<base64 PDF>",        → PDF representación gráfica
        "xml_base_64":  "<base64 XML>",        → XML enviado a DIAN
        "url_logo":     "https://...",         → logo del emisor en Factus
        "company": {
          "nit":        "900123456",
          "name":       "Consultorio Médico...",
          "trade_name": "...",
          "address":    "...",
          "phone":      "...",
          "email":      "..."
        },
        "customer": { ... },                   → datos del adquirente (EPS o paciente)
        "items": [ ... ],                      → servicios facturados
        "total": "175000.00",
        "subtotal": "175000.00",
        "taxes": "0.00",
        "discounts": "0.00",
        "errors": [],                          → vacío si validó OK
        "created_at": "2026-06-04T10:35:00Z"
      }
    }

    Campos SS-CUFE adicionales en la respuesta:
      health_coverage_code, health_modality_code,
      health_document_number, health_billing_period_start_date, ...
      (los mismos que enviamos, devueltos como confirmación)
    """

    @staticmethod
    def guardar_desde_factus(factura: 'Factura', resultado: dict) -> None:
        """Mapea la respuesta de Factus a los campos del modelo Factura."""
        from django.utils import timezone
        factura.numero_factus    = resultado.get('number', '')
        factura.cufe             = resultado.get('cufe', '')
        factura.qr_url           = resultado.get('qr', '')
        factura.pdf_base64       = resultado.get('pdf_base_64', '') or resultado.get('qr_image', '')
        factura.xml_base64       = resultado.get('xml_base_64', '')
        factura.errores_dian     = resultado.get('errors', [])
        factura.fecha_validacion = timezone.now()
        from apps.facturacion.models import EstadoFactura
        factura.estado = EstadoFactura.VALIDADA if not resultado.get('errors') else EstadoFactura.ERROR
