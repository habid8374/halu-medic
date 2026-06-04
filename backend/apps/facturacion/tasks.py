"""
Tareas Celery del módulo Facturación
- emitir_factura: llama a Factus API y actualiza la Factura
- reenviar_factura_pendiente: reintento automático ante fallo DIAN
"""
from celery import shared_task
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def emitir_factura(self, factura_id: str):
    """
    Emite una factura electrónica ante la DIAN vía Factus API.
    Se reintenta hasta 3 veces con 60s de espera entre intentos.
    """
    from backend.apps.facturacion.models import Factura, EstadoFactura
    from backend.apps.facturacion.factus_client import FactusClient, FactusAPIError, construir_payload_consulta
    from backend.apps.rips.generador import GeneradorRIPS

    try:
        factura = Factura.objects.select_related(
            'consulta__paciente',
            'consulta__medico',
            'consulta__procedimientos',
            'convenio',
        ).get(id=factura_id)

        # 1. Generar y validar RIPS
        gen = GeneradorRIPS(factura)
        rips = gen.generar()
        errores_rips = gen.validar(rips)
        if errores_rips:
            logger.error(f'[Factura {factura_id}] RIPS inválido: {errores_rips}')
            factura.estado = EstadoFactura.ERROR
            factura.errores_dian = errores_rips
            factura.save()
            return {'status': 'error', 'errores': errores_rips}

        factura.rips_json = rips
        factura.save(update_fields=['rips_json'])

        # 2. Construir payload Factus y emitir
        payload = construir_payload_consulta(factura)

        with FactusClient() as client:
            resultado = client.crear_factura(payload)

        # 3. Guardar resultado DIAN
        factura.numero_factus    = resultado.get('number', '')
        factura.cufe             = resultado.get('cufe', '')
        factura.qr_url           = resultado.get('qr', '')
        factura.pdf_base64       = resultado.get('qr_image', '')
        factura.estado           = EstadoFactura.VALIDADA
        factura.fecha_validacion = timezone.now()
        factura.errores_dian     = resultado.get('errors', [])
        factura.save()

        # 4. Cerrar la consulta
        factura.consulta.estado = 'facturada'
        factura.consulta.save(update_fields=['estado'])

        logger.info(f'Factura emitida OK: {factura.numero_factus} — CUFE: {factura.cufe[:20]}...')
        return {
            'status': 'ok',
            'numero': factura.numero_factus,
            'cufe': factura.cufe,
        }

    except Factura.DoesNotExist:
        logger.error(f'Factura {factura_id} no encontrada')
        return {'status': 'error', 'mensaje': 'Factura no encontrada'}

    except Exception as exc:
        logger.warning(f'[Factura {factura_id}] Error intento {self.request.retries + 1}: {exc}')
        # Actualizar estado a error temporalmente
        try:
            Factura.objects.filter(id=factura_id).update(
                estado=EstadoFactura.ERROR,
                errores_dian=[str(exc)]
            )
        except Exception:
            pass
        # Reintentar
        raise self.retry(exc=exc)


@shared_task
def reenviar_facturas_pendientes():
    """
    Tarea periódica (cada 10 min vía Celery Beat) para reintentar
    facturas que fallaron por timeout DIAN u otros errores transitorios.
    """
    from backend.apps.facturacion.models import Factura, EstadoFactura
    from django.utils import timezone
    from datetime import timedelta

    hace_10_min = timezone.now() - timedelta(minutes=10)
    pendientes = Factura.objects.filter(
        estado=EstadoFactura.ERROR,
        creado_en__gte=timezone.now() - timedelta(hours=24),
        actualizado_en__lte=hace_10_min,
    ).values_list('id', flat=True)[:50]

    for factura_id in pendientes:
        emitir_factura.delay(str(factura_id))
        logger.info(f'Reintentando factura: {factura_id}')

    return f'{len(pendientes)} facturas reenviadas'
