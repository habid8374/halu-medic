"""
Modelos del módulo Facturación
Factura electrónica + integración Factus + tareas Celery
"""
from django.db import models
from django.conf import settings
import uuid


class EstadoFactura(models.TextChoices):
    BORRADOR    = 'borrador',    'Borrador'
    ENVIADA     = 'enviada',     'Enviada a Factus'
    VALIDADA    = 'validada',    'Validada por DIAN'
    ERROR       = 'error',       'Error de validación'
    ANULADA     = 'anulada',     'Anulada (nota crédito)'


class Factura(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    consulta    = models.ForeignKey('consultas.Consulta', on_delete=models.PROTECT,
                                     null=True, blank=True,
                                     related_name='facturas')
    historia    = models.ForeignKey('historia.HistoriaClinica', on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name='facturas',
                                     help_text='HC origen si se factura directamente desde HC')
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


class FacturaPGP(models.Model):
    """Factura por Pago Global Prospectivo / Capitación."""

    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    convenio            = models.ForeignKey('tarifas.ConvenioEPS', on_delete=models.PROTECT,
                                             related_name='facturas_pgp')

    # Período del contrato
    periodo_desde       = models.DateField()
    periodo_hasta       = models.DateField()
    descripcion_contrato = models.TextField(
        help_text='Ej: Contrato PGP que comprende el mes de mayo del 1 al 31 de mayo de 2026'
    )
    numero_contrato_eps  = models.CharField(max_length=100, blank=True,
        help_text='Número de contrato en el sistema de la EPS (diferente al CUCON)')

    # Valor global
    valor_total         = models.DecimalField(max_digits=14, decimal_places=2)

    # Factus / DIAN
    numero_factus       = models.CharField(max_length=50, blank=True)
    cufe                = models.CharField(max_length=200, blank=True)
    qr_url              = models.TextField(blank=True)
    pdf_base64          = models.TextField(blank=True)
    xml_base64          = models.TextField(blank=True)
    rango_numeracion_id = models.IntegerField(null=True, blank=True)

    # RIPS
    rips_json           = models.JSONField(null=True, blank=True)
    cuv                 = models.CharField(max_length=100, blank=True)

    estado              = models.CharField(max_length=20, choices=EstadoFactura.choices,
                                            default=EstadoFactura.BORRADOR)
    errores_dian        = models.JSONField(default=list, blank=True)
    observaciones       = models.TextField(blank=True)

    creado_en           = models.DateTimeField(auto_now_add=True)
    actualizado_en      = models.DateTimeField(auto_now=True)
    fecha_validacion    = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-creado_en']
        indexes = [
            models.Index(fields=['estado']),
            models.Index(fields=['numero_factus']),
        ]

    def __str__(self):
        return f'PGP {self.numero_factus or self.id} — {self.convenio}'


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


# ════════════════════════════════════════════════════════════════════════════
#  PREFACTURA — Preliquidación / Cuenta de cobro interna
# ════════════════════════════════════════════════════════════════════════════

class EstadoPrefactura(models.TextChoices):
    BORRADOR   = 'borrador',   'Borrador — en construcción'
    EN_REVISION = 'en_revision', 'En revisión por auditor'
    APROBADA   = 'aprobada',   'Aprobada — lista para facturar'
    FACTURADA  = 'facturada',  'Facturada — FEV emitida'
    ANULADA    = 'anulada',    'Anulada'


class Prefactura(models.Model):
    """
    Preliquidación interna de un episodio (ingreso hospitalario, CX o consulta).
    Consolida todos los servicios, insumos y medicamentos consumidos para que
    el auditor/facturador los revise, ajuste y apruebe antes de emitir la FEV.

    Flujo:
      1. Se crea al abrir el proceso de facturación de un ingreso/episodio.
      2. El sistema auto-carga ítems desde HC, órdenes, medicamentos, ayudas y CX.
      3. El facturador agrega manualmente insumos, implantes, material especial.
      4. El auditor revisa: marca no-facturables, ajusta cantidades, aprueba.
      5. Con estado=aprobada se genera la Factura (FEV) definitiva.
    """
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    numero_prefactura = models.PositiveIntegerField(editable=False)

    # Origen del episodio (al menos uno debe estar presente)
    ingreso         = models.ForeignKey('historia.Ingreso', on_delete=models.SET_NULL,
                                         null=True, blank=True, related_name='prefacturas')
    historia        = models.ForeignKey('historia.HistoriaClinica', on_delete=models.SET_NULL,
                                         null=True, blank=True, related_name='prefacturas')
    paciente        = models.ForeignKey('pacientes.Paciente', on_delete=models.PROTECT,
                                         related_name='prefacturas')
    convenio        = models.ForeignKey('tarifas.ConvenioEPS', on_delete=models.SET_NULL,
                                         null=True, blank=True,
                                         help_text='EPS / convenio al que se factura')

    # Período de prestación del servicio
    fecha_inicio    = models.DateField(help_text='Inicio del período de atención')
    fecha_fin       = models.DateField(help_text='Fin del período / fecha de egreso')

    # Totales calculados
    subtotal_eps    = models.DecimalField(max_digits=14, decimal_places=2, default=0,
                                           help_text='Total a cargo de la EPS/convenio')
    subtotal_paciente = models.DecimalField(max_digits=14, decimal_places=2, default=0,
                                             help_text='Copago / cuota moderadora a cargo del paciente')
    subtotal_no_facturable = models.DecimalField(max_digits=14, decimal_places=2, default=0,
                                                  help_text='Valor de ítems excluidos o no facturables')
    total           = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    estado          = models.CharField(max_length=15, choices=EstadoPrefactura.choices,
                                        default=EstadoPrefactura.BORRADOR)

    # Factura generada (se llena al aprobar y emitir)
    factura         = models.OneToOneField(Factura, on_delete=models.SET_NULL,
                                            null=True, blank=True, related_name='prefactura')

    # Trazabilidad
    creado_por      = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                         null=True, blank=True, related_name='prefacturas_creadas')
    revisado_por    = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                         null=True, blank=True, related_name='prefacturas_revisadas')
    observaciones   = models.TextField(blank=True)
    creado_en       = models.DateTimeField(auto_now_add=True)
    actualizado_en  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-creado_en']
        verbose_name = 'Prefactura'
        verbose_name_plural = 'Prefacturas'
        indexes = [models.Index(fields=['numero_prefactura'])]

    def save(self, *args, **kwargs):
        if not self.numero_prefactura:
            ultimo = Prefactura.objects.order_by('-numero_prefactura').first()
            self.numero_prefactura = (ultimo.numero_prefactura + 1) if ultimo else 1
        super().save(*args, **kwargs)

    def recalcular_totales(self):
        """Recalcula los subtotales desde los ítems."""
        items = self.items.all()
        self.subtotal_eps       = sum(i.valor_total for i in items if i.destino == 'eps')
        self.subtotal_paciente  = sum(i.valor_total for i in items if i.destino == 'paciente')
        self.subtotal_no_facturable = sum(i.valor_total for i in items if i.destino == 'no_facturable')
        self.total = self.subtotal_eps + self.subtotal_paciente
        self.save(update_fields=['subtotal_eps', 'subtotal_paciente',
                                  'subtotal_no_facturable', 'total'])

    def __str__(self):
        return f'PRE-{str(self.numero_prefactura).zfill(5)} — {self.paciente}'


class ItemPrefactura(models.Model):
    """
    Ítem individual dentro de una prefactura.
    Puede venir auto-generado desde un módulo clínico (procedimiento, medicamento,
    hospitalización, CX, ayuda diagnóstica) o agregado manualmente por el facturador.

    destino:
      eps           → se factura a la EPS/convenio (va en la FEV)
      paciente      → copago / cuota moderadora / no cubierto (FEV al paciente)
      no_facturable → excluido del cobro (insumo incluido en UVR, sin soporte, duplicado)
    """
    TIPO_CHOICES = [
        ('consulta',         'Consulta / Evolución'),
        ('hospitalizacion',  'Día de hospitalización'),
        ('procedimiento',    'Procedimiento quirúrgico / diagnóstico'),
        ('anestesia',        'Anestesia'),
        ('medicamento',      'Medicamento'),
        ('insumo_facturable','Insumo facturable (implante, osteosíntesis, contraste)'),
        ('insumo_no_incluidoUVR', 'Insumo no incluido en UVR'),
        ('ayuda_diagnostica','Ayuda diagnóstica'),
        ('derechos_sala',    'Derechos de sala quirúrgica'),
        ('hoteleria',        'Hotelería / Habitación'),
        ('otro',             'Otro'),
    ]
    DESTINO_CHOICES = [
        ('eps',            'A cobrar a EPS/convenio'),
        ('paciente',       'A cobrar al paciente (copago/cuota)'),
        ('no_facturable',  'No facturable / excluir'),
    ]

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    prefactura      = models.ForeignKey(Prefactura, on_delete=models.CASCADE,
                                         related_name='items')
    tipo            = models.CharField(max_length=25, choices=TIPO_CHOICES)
    descripcion     = models.CharField(max_length=400, help_text='Nombre del servicio o insumo')
    cups            = models.CharField(max_length=10, blank=True, help_text='CUPS si aplica')
    cum             = models.CharField(max_length=20, blank=True, help_text='CUM si es medicamento')

    cantidad        = models.DecimalField(max_digits=10, decimal_places=3, default=1)
    valor_unitario  = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    descuento       = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    valor_total     = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    destino         = models.CharField(max_length=15, choices=DESTINO_CHOICES, default='eps')

    # Justificación de exclusión
    motivo_exclusion = models.CharField(max_length=300, blank=True,
                                         help_text='Por qué no es facturable (incluido en UVR, sin soporte, etc.)')

    # Origen: referencia al objeto clínico que generó este ítem
    origen_tipo     = models.CharField(max_length=30, blank=True,
                                        help_text='Ej: OrdenHC, MedicamentoHC, AyudaDiagnostica, ProgramacionCx')
    origen_id       = models.CharField(max_length=40, blank=True,
                                        help_text='UUID del objeto origen')

    # ¿Fue agregado manualmente o auto-generado?
    es_manual       = models.BooleanField(default=False,
                                           help_text='True si el facturador lo agregó manualmente')

    # CIE-10 del servicio (para RIPS)
    cie10           = models.CharField(max_length=10, blank=True)

    fecha_servicio  = models.DateField(null=True, blank=True)
    creado_en       = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['tipo', 'creado_en']
        verbose_name = 'Ítem de prefactura'
        verbose_name_plural = 'Ítems de prefactura'

    def save(self, *args, **kwargs):
        self.valor_total = (self.cantidad * self.valor_unitario) - self.descuento
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.get_tipo_display()} — {self.descripcion[:50]}'
