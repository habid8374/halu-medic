"""
Webhook de Factus — recibe notificaciones asíncronas del estado DIAN.

Factus envía un POST a esta URL cuando la DIAN valida o rechaza una factura.
Configurar en el panel Factus: Settings → Webhooks → URL de notificación.

Payload esperado de Factus:
{
  "event": "bill.validated" | "bill.rejected",
  "data": {
    "number": "SETP990000127",
    "cufe":   "44e260a76e...",
    "status": "validated" | "rejected",
    "errors": [],
    "pdf_base_64": "...",
    "xml_base_64": "...",
    "qr": "https://..."
  }
}
"""
import hashlib
import hmac
import logging
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone

from apps.facturacion.models import Factura, EstadoFactura

logger = logging.getLogger(__name__)


@method_decorator(csrf_exempt, name='dispatch')
class FactusWebhookView(APIView):
    """
    POST /api/facturacion/webhook/factus/
    Recibe notificaciones de Factus sobre el estado de facturas ante la DIAN.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        # Verificar firma HMAC si está configurada
        secret = getattr(settings, 'FACTUS_WEBHOOK_SECRET', '')
        if secret:
            signature = request.headers.get('X-Factus-Signature', '')
            expected  = hmac.new(secret.encode(), request.body, hashlib.sha256).hexdigest()
            if not hmac.compare_digest(signature, expected):
                logger.warning('[Factus Webhook] Firma inválida — solicitud rechazada')
                return Response({'error': 'Firma inválida'}, status=status.HTTP_401_UNAUTHORIZED)

        payload = request.data
        event   = payload.get('event', '')
        data    = payload.get('data', {})
        numero  = data.get('number', '')

        if not numero:
            return Response({'error': 'number requerido'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            factura = Factura.objects.get(numero_factus=numero)
        except Factura.DoesNotExist:
            logger.warning(f'[Factus Webhook] Factura {numero} no encontrada en BD')
            return Response({'ok': True})  # 200 para que Factus no reintente

        if event == 'bill.validated':
            factura.cufe             = data.get('cufe', factura.cufe)
            factura.qr_url           = data.get('qr', factura.qr_url)
            factura.pdf_base64       = data.get('pdf_base_64', factura.pdf_base64)
            factura.xml_base64       = data.get('xml_base_64', factura.xml_base64)
            factura.estado           = EstadoFactura.VALIDADA
            factura.fecha_validacion = timezone.now()
            factura.errores_dian     = []
            factura.save(update_fields=[
                'cufe', 'qr_url', 'pdf_base64', 'xml_base64',
                'estado', 'fecha_validacion', 'errores_dian',
            ])
            # Cerrar consulta
            try:
                factura.consulta.estado = 'facturada'
                factura.consulta.save(update_fields=['estado'])
            except Exception:
                pass
            logger.info(f'[Factus Webhook] Factura {numero} validada — CUFE {factura.cufe[:20]}...')

        elif event == 'bill.rejected':
            factura.estado       = EstadoFactura.ERROR
            factura.errores_dian = data.get('errors', [])
            factura.save(update_fields=['estado', 'errores_dian'])
            logger.error(f'[Factus Webhook] Factura {numero} rechazada: {factura.errores_dian}')

        else:
            logger.info(f'[Factus Webhook] Evento desconocido: {event}')

        return Response({'ok': True})
