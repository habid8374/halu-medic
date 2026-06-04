"""
Cliente para la API de Factus (PT habilitado DIAN Colombia)
Documentación: https://developers.factus.com.co

Flujo:
  1. Autenticación OAuth2 → access_token
  2. POST /v1/bills/validate → envía JSON → Factus genera XML → valida DIAN
  3. Respuesta incluye CUFE, QR, PDF base64
  4. Celery reintenta en caso de timeout DIAN
"""
import httpx
import logging
from decouple import config
from django.core.cache import cache

logger = logging.getLogger(__name__)

FACTUS_BASE_URL    = config('FACTUS_BASE_URL', default='https://api-sandbox.factus.com.co')
FACTUS_CLIENT_ID   = config('FACTUS_CLIENT_ID', default='')
FACTUS_CLIENT_SECRET = config('FACTUS_CLIENT_SECRET', default='')
FACTUS_USERNAME    = config('FACTUS_USERNAME', default='')
FACTUS_PASSWORD    = config('FACTUS_PASSWORD', default='')

TOKEN_CACHE_KEY    = 'factus_access_token'
TOKEN_TTL_SECONDS  = 3500  # ~58 min (token dura 1 hora)


class FactusAPIError(Exception):
    def __init__(self, message, status_code=None, errors=None):
        super().__init__(message)
        self.status_code = status_code
        self.errors = errors or []


class FactusClient:
    """Cliente HTTP para la API de Factus."""

    def __init__(self):
        self.base_url = FACTUS_BASE_URL.rstrip('/')
        self._client = httpx.Client(timeout=30)

    # ── Autenticación ────────────────────────────────────────────────────────

    def _obtener_token(self) -> str:
        """Obtiene el access_token, usando caché para no reautenticar en cada llamada."""
        token = cache.get(TOKEN_CACHE_KEY)
        if token:
            return token

        response = self._client.post(
            f'{self.base_url}/oauth/token',
            data={
                'grant_type': 'password',
                'client_id': FACTUS_CLIENT_ID,
                'client_secret': FACTUS_CLIENT_SECRET,
                'username': FACTUS_USERNAME,
                'password': FACTUS_PASSWORD,
            }
        )
        if response.status_code != 200:
            raise FactusAPIError(
                f'Error autenticando con Factus: {response.text}',
                status_code=response.status_code
            )

        data = response.json()
        token = data['access_token']
        cache.set(TOKEN_CACHE_KEY, token, TOKEN_TTL_SECONDS)
        return token

    def _headers(self) -> dict:
        return {
            'Authorization': f'Bearer {self._obtener_token()}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }

    # ── Facturas ─────────────────────────────────────────────────────────────

    def crear_factura(self, payload: dict) -> dict:
        """
        Crea y valida una factura electrónica ante la DIAN.
        payload: estructura JSON según documentación Factus /v1/bills/validate
        Retorna: dict con cufe, qr, pdf_base64, numero, estado
        """
        response = self._client.post(
            f'{self.base_url}/v1/bills/validate',
            json=payload,
            headers=self._headers(),
        )
        data = response.json()

        if response.status_code not in (200, 201):
            raise FactusAPIError(
                f'Error creando factura: {data.get("message", response.text)}',
                status_code=response.status_code,
                errors=data.get('errors', [])
            )

        logger.info(f'Factura creada exitosamente: {data.get("data", {}).get("number")}')
        return data.get('data', data)

    def consultar_factura(self, numero: str) -> dict:
        """Consulta el estado de una factura por su número."""
        response = self._client.get(
            f'{self.base_url}/v1/bills/{numero}',
            headers=self._headers(),
        )
        if response.status_code != 200:
            raise FactusAPIError(f'Factura {numero} no encontrada', status_code=response.status_code)
        return response.json().get('data', {})

    def crear_nota_credito(self, payload: dict) -> dict:
        """Emite una nota crédito para anular o ajustar una factura."""
        response = self._client.post(
            f'{self.base_url}/v1/credit-notes/validate',
            json=payload,
            headers=self._headers(),
        )
        data = response.json()
        if response.status_code not in (200, 201):
            raise FactusAPIError(
                f'Error creando nota crédito: {data.get("message")}',
                status_code=response.status_code,
                errors=data.get('errors', [])
            )
        return data.get('data', data)

    def listar_facturas(self, page: int = 1, per_page: int = 25) -> dict:
        """Lista facturas con paginación."""
        response = self._client.get(
            f'{self.base_url}/v1/bills',
            params={'page': page, 'per_page': per_page},
            headers=self._headers(),
        )
        return response.json()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self._client.close()


# ── Helpers de payload ────────────────────────────────────────────────────────

def construir_payload_consulta(factura_obj) -> dict:
    """
    Construye el JSON para Factus a partir de un objeto Factura de Halu Medic.
    Incluye CUCON cuando la consulta está bajo convenio EPS (Res. 948/2026).
    """
    consulta = factura_obj.consulta
    convenio = factura_obj.convenio  # puede ser None si es particular

    items = []
    for proc in consulta.procedimientos.all():
        items.append({
            'code_reference': proc.cups,
            'name': proc.descripcion,
            'quantity': 1,
            'discount_rate': 0,
            'price': float(proc.valor_facturar),
            'tax_rate': '0.00',  # Servicios de salud exentos IVA
            'unit_measure_id': 70,  # Unidad de servicio
            'standard_code_id': 1,
        })

    payload = {
        'numbering_range_id': factura_obj.rango_numeracion_id,
        'reference_code': str(factura_obj.id),
        'observation': factura_obj.observaciones or '',
        'payment_method_code': '10',  # Efectivo por defecto
        'customer': {
            'identification': consulta.paciente.numero_identificacion,
            'dv': '',
            'company': '',
            'trade_name': '',
            'names': consulta.paciente.primer_nombre,
            'address': consulta.paciente.direccion or 'Sin dirección',
            'email': consulta.paciente.email or '',
            'phone': consulta.paciente.telefono or '',
            'legal_organization_id': '2',  # Persona natural
            'tribute_id': '21',  # No responsable de IVA
            'identification_document_id': _codigo_tipo_id(consulta.paciente.tipo_identificacion),
            'municipality_id': consulta.paciente.municipio_codigo or '5001',
        },
        'items': items,
    }

    # CUCON obligatorio cuando hay convenio (Res. 948/2026)
    if convenio and convenio.cucon:
        payload['cucon'] = convenio.cucon

    return payload


def _codigo_tipo_id(tipo: str) -> str:
    """Mapeo de tipos de identificación Halu → códigos Factus."""
    mapeo = {
        'CC': '3', 'CE': '5', 'TI': '7', 'RC': '8',
        'PA': '4', 'NIT': '6', 'MS': '11', 'AS': '12',
    }
    return mapeo.get(tipo, '3')
