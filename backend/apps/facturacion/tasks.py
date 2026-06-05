"""
Tareas Celery — Facturación Sector Salud
  emitir_factura: genera RIPS → llama Factus SS-CUFE/SS-SinAporte → guarda CUFE
  reenviar_facturas_pendientes: reintento automático cada 10 min
"""
from celery import shared_task
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def emitir_factura(self, factura_id: str):
    """
    Emite una factura SS-CUFE o SS-SinAporte según el convenio del paciente.
    Flujo:
      1. Generar RIPS JSON (Res. 948/2026)
      2. Validar RIPS
      3. Construir payload Factus (auto-detecta SS-CUFE vs SS-SinAporte)
      4. POST /v1/bills/validate → Factus → DIAN
      5. Guardar CUFE, número FEV, PDF base64
      6. Cerrar consulta
    """
    from apps.facturacion.models import Factura, EstadoFactura
    from apps.facturacion.factus_client import FactusAPIError
    from apps.facturacion.factus_salud import FactusSaludClient, construir_payload_auto
    from apps.rips.generador import GeneradorRIPS

    try:
        factura = Factura.objects.select_related(
            'consulta__paciente',
            'consulta__medico',
            'convenio__aseguradora',
        ).prefetch_related(
            'consulta__procedimientos',
            'consulta__medicamentos',
        ).get(id=factura_id)

        # Idempotencia: si ya tiene CUFE la factura fue enviada exitosamente
        if factura.cufe and factura.estado == EstadoFactura.VALIDADA:
            logger.info(f'Factura {factura_id} ya validada (CUFE={factura.cufe[:20]}...). Ignorando reintento.')
            return {'status': 'ya_validada', 'cufe': factura.cufe, 'numero': factura.numero_factus}

        # 1. Enviar a Factus (Factus asigna el número de FEV)
        payload = construir_payload_auto(factura)

        with FactusSaludClient() as client:
            resultado = client.crear_factura_salud(payload)

        # 2. Guardar resultado completo de Factus
        factura.numero_factus    = resultado.get('number', '')
        factura.cufe             = resultado.get('cufe', '')
        factura.qr_url           = resultado.get('qr', '')
        factura.pdf_base64       = resultado.get('pdf_base_64', '') or resultado.get('qr_image', '')
        factura.xml_base64       = resultado.get('xml_base_64', '')
        factura.estado           = EstadoFactura.VALIDADA if not resultado.get('errors') else EstadoFactura.ERROR
        factura.fecha_validacion = timezone.now()
        factura.errores_dian     = resultado.get('errors', [])
        factura.save()

        # 3. Generar RIPS con el numFactura real (para reportar al MUV MinSalud)
        if factura.numero_factus:
            try:
                gen  = GeneradorRIPS(factura)
                rips = gen.generar()
                factura.rips_json = rips
                factura.save(update_fields=['rips_json'])
            except Exception as e_rips:
                logger.warning(f'[Factura {factura_id}] RIPS generación: {e_rips}')

        # 4. Cerrar consulta
        factura.consulta.estado = 'facturada'
        factura.consulta.save(update_fields=['estado'])

        tipo_op = 'SS-CUFE' if factura.convenio else 'SS-SinAporte'
        logger.info(f'Factura {tipo_op} emitida: {factura.numero_factus} CUFE:{factura.cufe[:20]}...')

        return {
            'status': 'ok',
            'tipo':   tipo_op,
            'numero': factura.numero_factus,
            'cufe':   factura.cufe,
        }

    except Factura.DoesNotExist:
        logger.error(f'Factura {factura_id} no encontrada')
        return {'status': 'error', 'mensaje': 'Factura no encontrada'}

    except Exception as exc:
        logger.warning(f'[Factura {factura_id}] Intento {self.request.retries + 1}: {exc}')
        try:
            from apps.facturacion.models import Factura, EstadoFactura
            Factura.objects.filter(id=factura_id).update(
                estado=EstadoFactura.ERROR,
                errores_dian=[str(exc)]
            )
        except Exception:
            pass
        raise self.retry(exc=exc)


@shared_task
def reenviar_facturas_pendientes():
    """Celery Beat — cada 10 min reintenta facturas con error."""
    from apps.facturacion.models import Factura, EstadoFactura
    from datetime import timedelta

    hace_10  = timezone.now() - timedelta(minutes=10)
    hace_24h = timezone.now() - timedelta(hours=24)

    pendientes = Factura.objects.filter(
        estado=EstadoFactura.ERROR,
        creado_en__gte=hace_24h,
        actualizado_en__lte=hace_10,
    ).values_list('id', flat=True)[:50]

    for fid in pendientes:
        emitir_factura.delay(str(fid))
        logger.info(f'Reintentando: {fid}')

    return f'{len(pendientes)} facturas reenviadas'
