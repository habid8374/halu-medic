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
from django.core.cache import cache
from django.db import connection

logger = logging.getLogger(__name__)

TOKEN_TTL_SECONDS  = 3500  # ~58 min (token dura 1 hora)


class FactusAPIError(Exception):
    def __init__(self, message, status_code=None, errors=None):
        super().__init__(message)
        self.status_code = status_code
        self.errors = errors or []


def _consultorio_actual():
    """
    Devuelve el Consultorio (tenant) activo según el schema de la conexión.
    En multi-tenant cada operación Factus ocurre dentro del schema del consultorio.
    """
    return getattr(connection, 'tenant', None)


class FactusClient:
    """
    Cliente HTTP para la API de Factus.

    Multi-tenant: las credenciales se toman del Consultorio actual
    (cada prestador tiene su propia cuenta Factus habilitada ante la DIAN).
    El token se cachea por consultorio para no mezclar sesiones.
    """

    def __init__(self, consultorio=None):
        self.consultorio = consultorio or _consultorio_actual()
        self._creds = self._resolver_credenciales()
        self.base_url = self._creds['base_url'].rstrip('/')
        self._client = httpx.Client(timeout=30)

    def _resolver_credenciales(self) -> dict:
        """Lee las credenciales Factus del consultorio (o del entorno en dev)."""
        if self.consultorio and hasattr(self.consultorio, 'credenciales_factus'):
            return self.consultorio.credenciales_factus()
        # Fallback puro a entorno (desarrollo single-tenant)
        from decouple import config
        return {
            'base_url':      config('FACTUS_BASE_URL', default='https://api-sandbox.factus.com.co'),
            'client_id':     config('FACTUS_CLIENT_ID', default=''),
            'client_secret': config('FACTUS_CLIENT_SECRET', default=''),
            'username':      config('FACTUS_USERNAME', default=''),
            'password':      config('FACTUS_PASSWORD', default=''),
        }

    @property
    def _token_cache_key(self) -> str:
        """Clave de caché única por consultorio (evita mezclar tokens entre tenants)."""
        schema = getattr(self.consultorio, 'schema_name', None) or self._creds.get('client_id', 'default')
        return f'factus_access_token::{schema}'

    # ── Autenticación ────────────────────────────────────────────────────────

    def _obtener_token(self) -> str:
        """Obtiene el access_token, usando caché para no reautenticar en cada llamada."""
        token = cache.get(self._token_cache_key)
        if token:
            return token

        if not self._creds['client_id']:
            raise FactusAPIError(
                'El consultorio no tiene credenciales Factus configuradas. '
                'Configúralas en Configuración → Facturación electrónica.'
            )

        response = self._client.post(
            f'{self.base_url}/oauth/token',
            data={
                'grant_type': 'password',
                'client_id': self._creds['client_id'],
                'client_secret': self._creds['client_secret'],
                'username': self._creds['username'],
                'password': self._creds['password'],
            }
        )
        if response.status_code != 200:
            raise FactusAPIError(
                f'Error autenticando con Factus: {response.text}',
                status_code=response.status_code
            )

        data = response.json()
        token = data['access_token']
        cache.set(self._token_cache_key, token, TOKEN_TTL_SECONDS)
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

    _tenant = getattr(connection, 'tenant', None)
    _rango = factura_obj.rango_numeracion_id or (
        getattr(_tenant, 'factus_rango_numeracion_id', None) if _tenant else None
    )
    _leyenda = getattr(_tenant, 'factura_leyenda', '') if _tenant else ''

    payload = {
        'numbering_range_id': _rango,
        'reference_code': str(factura_obj.id),
        'observation': factura_obj.observaciones or _leyenda,
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
