"""
Cliente Factus — Factura Electrónica Sector Salud
Tipo de operación: SS-CUFE (Factura con aporte)
Documentación: https://developers.factus.com.co/facturas/tipos-de-factura/ss-cufe/

Flujo SS-CUFE:
  1. Paciente paga copago/cuota moderadora → SS-RECAUDO (factura al paciente)
  2. IPS/consultorio factura a la EPS → SS-CUFE (descuenta los recaudos previos)

Tipos de operación Factus Salud:
  SS-CUFE      → Factura con aporte (consultorio → EPS, descontando copagos ya cobrados)
  SS-SinAporte → Factura sin aporte (particular o cuando no hay copago)
  SS-Recaudo   → Recaudo del copago/cuota moderadora al paciente
  SS-Reporte   → Cuando la EPS recibe los ingresos directamente
"""
from .factus_client import FactusClient, FactusAPIError
import logging

logger = logging.getLogger(__name__)


# ── Códigos de operación ──────────────────────────────────────────────────────
class TipoOperacionSalud:
    SS_CUFE       = 'SS-CUFE'        # Factura con aporte → a EPS
    SS_SIN_APORTE = 'SS-SinAporte'   # Sin aporte → particular
    SS_RECAUDO    = 'SS-Recaudo'     # Recaudo copago → al paciente
    SS_REPORTE    = 'SS-Reporte'     # Reporte → EPS recibe ingresos


# ── Modalidades de pago sector salud ─────────────────────────────────────────
class ModalidadPago:
    POR_EVENTO           = '1'   # Pago por evento (consulta individual)
    GLOBAL_PROSPECTIVO   = '2'   # Pago global prospectivo (capitación)
    POR_CASO             = '3'   # Pago individual por caso
    POR_CAPITACION       = '4'   # Pago por capitación
    OTRA                 = '5'   # Otra modalidad


class FactusSaludClient(FactusClient):
    """
    Extiende FactusClient con métodos específicos para sector salud.
    """

    def crear_factura_salud(self, payload: dict) -> dict:
        """
        Crea una factura electrónica sector salud (SS-CUFE o SS-SinAporte).
        Endpoint: POST /v1/health-bills/validate (o /v1/bills/validate con health_data)
        """
        import httpx
        response = self._client.post(
            f'{self.base_url}/v1/bills/validate',
            json=payload,
            headers=self._headers(),
        )
        data = response.json()
        if response.status_code not in (200, 201):
            raise FactusAPIError(
                f'Error factura salud: {data.get("message", response.text)}',
                status_code=response.status_code,
                errors=data.get('errors', [])
            )
        logger.info(f'Factura salud emitida: {data.get("data", {}).get("number")}')
        return data.get('data', data)

    def crear_recaudo(self, payload: dict) -> dict:
        """
        Crea una factura SS-Recaudo (cobro de copago/cuota moderadora al paciente).
        Esta factura se emite primero; su CUFE se referencia luego en el SS-CUFE.
        """
        response = self._client.post(
            f'{self.base_url}/v1/bills/validate',
            json=payload,
            headers=self._headers(),
        )
        data = response.json()
        if response.status_code not in (200, 201):
            raise FactusAPIError(
                f'Error SS-Recaudo: {data.get("message")}',
                status_code=response.status_code,
                errors=data.get('errors', [])
            )
        return data.get('data', data)


# ── Constructores de payload ──────────────────────────────────────────────────

def construir_payload_ss_cufe(factura_obj) -> dict:
    """
    Construye el JSON para Factus — operación SS-CUFE.
    Se usa cuando el consultorio factura a una EPS por servicios prestados.
    Incluye los recaudos (copagos) previamente cobrados al paciente.

    Estructura clave:
    {
      "operation_type": "SS-CUFE",
      "health_data": {
        "user": { datos del paciente beneficiario },
        "coverage": { datos de cobertura EPS },
        "billing_period": { fecha inicio/fin del periodo },
        "payments": [ recaudos a descontar ]
      },
      ...campos estándar de factura...
    }
    """
    consulta = factura_obj.consulta
    paciente = consulta.paciente
    convenio = factura_obj.convenio

    # ── Período de facturación ────────────────────────────────────────────────
    fecha_ini = consulta.fecha_atencion
    fecha_fin = consulta.fecha_atencion

    # ── Items (procedimientos y consulta) ────────────────────────────────────
    items = []

    # Consulta principal
    if consulta.valor_consulta and consulta.valor_consulta > 0:
        items.append({
            'code_reference': consulta.cups_principal,
            'name': consulta.descripcion_cups or f'Consulta {consulta.cups_principal}',
            'quantity': 1,
            'discount_rate': '0.00',
            'price': float(consulta.valor_consulta),
            'tax_rate': '0.00',       # Servicios salud exentos IVA (Art. 476 ET)
            'unit_measure_id': 70,    # Unidad de servicio médico
            'standard_code_id': 1,
            'is_excluded': True,      # Excluido de IVA sector salud
        })

    # Procedimientos adicionales
    for proc in consulta.procedimientos.all():
        items.append({
            'code_reference': proc.cups,
            'name': proc.descripcion,
            'quantity': proc.cantidad,
            'discount_rate': '0.00',
            'price': float(proc.valor_facturar),
            'tax_rate': '0.00',
            'unit_measure_id': 70,
            'standard_code_id': 1,
            'is_excluded': True,
        })

    # ── Recaudos (copagos ya cobrados al paciente — se descuentan del total) ──
    pagos_anticipados = []
    if factura_obj.valor_copago and factura_obj.valor_copago > 0:
        pagos_anticipados.append({
            'amount': float(factura_obj.valor_copago),
            'concept': _concepto_recaudo_label(paciente.regimen),
            # Si existe el CUFE del recaudo previo, se referencia aquí
            'prepaid_cufe': getattr(factura_obj, 'cufe_recaudo', '') or '',
        })

    # ── Payload principal ────────────────────────────────────────────────────
    payload = {
        # Tipo de operación sector salud
        'operation_type_id': 22,  # 22 = SS-CUFE en Factus
        'numbering_range_id': factura_obj.rango_numeracion_id,
        'reference_code': str(factura_obj.id),
        'observation': factura_obj.observaciones or '',
        'payment_method_code': '10',

        # Cliente = EPS (entidad que paga)
        'customer': _customer_eps(convenio) if convenio else _customer_particular(paciente),

        # Items
        'items': items,

        # Datos sector salud (extensión MinSalud)
        'health': {
            # Usuario beneficiario (el paciente que recibió el servicio)
            'user': {
                'type_document_identification_id': _id_tipo_doc(paciente.tipo_identificacion),
                'identification': paciente.numero_identificacion,
                'first_name': paciente.primer_nombre,
                'other_names': paciente.segundo_nombre or '',
                'last_name': paciente.primer_apellido,
                'other_last_name': paciente.segundo_apellido or '',
            },
            # Período de facturación
            'billing_period': {
                'start_date': fecha_ini.strftime('%Y-%m-%d'),
                'start_time': fecha_ini.strftime('%H:%M:%S'),
                'end_date': fecha_fin.strftime('%Y-%m-%d'),
                'end_time': fecha_fin.strftime('%H:%M:%S'),
            },
            # Modalidad de pago
            'payment_modality_code': ModalidadPago.POR_EVENTO,
            # Número de autorización EPS (si existe)
            'authorization_number': consulta.numero_autorizacion or '',
            # Contrato — CUCON obligatorio (Res. 948/2026)
            'contract_number': convenio.numero_contrato if convenio else '',
            'cucon': convenio.cucon if convenio else '',
            # Pagos anticipados (copagos a descontar)
            'prepaid_payments': pagos_anticipados,
            # Cobertura
            'coverage_type': _tipo_cobertura(paciente.regimen),
        },
    }

    return payload


def construir_payload_ss_sin_aporte(factura_obj) -> dict:
    """
    Payload SS-SinAporte — para consultas de pacientes particulares
    o cuando no hay copago ni convenio EPS.
    """
    consulta = factura_obj.consulta
    paciente = consulta.paciente

    items = []
    if consulta.valor_consulta and consulta.valor_consulta > 0:
        items.append({
            'code_reference': consulta.cups_principal,
            'name': consulta.descripcion_cups or f'Consulta {consulta.cups_principal}',
            'quantity': 1,
            'discount_rate': '0.00',
            'price': float(consulta.valor_consulta),
            'tax_rate': '0.00',
            'unit_measure_id': 70,
            'standard_code_id': 1,
            'is_excluded': True,
        })
    for proc in consulta.procedimientos.all():
        items.append({
            'code_reference': proc.cups,
            'name': proc.descripcion,
            'quantity': proc.cantidad,
            'discount_rate': '0.00',
            'price': float(proc.valor_facturar),
            'tax_rate': '0.00',
            'unit_measure_id': 70,
            'standard_code_id': 1,
            'is_excluded': True,
        })

    return {
        'operation_type_id': 23,   # 23 = SS-SinAporte en Factus
        'numbering_range_id': factura_obj.rango_numeracion_id,
        'reference_code': str(factura_obj.id),
        'observation': factura_obj.observaciones or '',
        'payment_method_code': '10',
        'customer': _customer_particular(paciente),
        'items': items,
        'health': {
            'user': {
                'type_document_identification_id': _id_tipo_doc(paciente.tipo_identificacion),
                'identification': paciente.numero_identificacion,
                'first_name': paciente.primer_nombre,
                'other_names': paciente.segundo_nombre or '',
                'last_name': paciente.primer_apellido,
                'other_last_name': paciente.segundo_apellido or '',
            },
            'billing_period': {
                'start_date': consulta.fecha_atencion.strftime('%Y-%m-%d'),
                'start_time': consulta.fecha_atencion.strftime('%H:%M:%S'),
                'end_date': consulta.fecha_atencion.strftime('%Y-%m-%d'),
                'end_time': consulta.fecha_atencion.strftime('%H:%M:%S'),
            },
            'payment_modality_code': ModalidadPago.POR_EVENTO,
            'authorization_number': consulta.numero_autorizacion or '',
            'coverage_type': '05',  # Particular
        },
    }


def construir_payload_ss_recaudo(consulta_obj, valor_copago: float, concepto: str) -> dict:
    """
    Payload SS-Recaudo — cobro del copago/cuota moderadora al paciente.
    Esta factura se emite al paciente ANTES de la SS-CUFE a la EPS.
    Su CUFE se guarda y se referencia en el campo prepaid_cufe del SS-CUFE.
    """
    paciente = consulta_obj.paciente
    return {
        'operation_type_id': 24,   # 24 = SS-Recaudo en Factus
        'reference_code': f'rec-{consulta_obj.id}',
        'observation': f'Recaudo {concepto} — {consulta_obj.cups_principal}',
        'payment_method_code': '10',
        'customer': _customer_particular(paciente),
        'items': [{
            'code_reference': consulta_obj.cups_principal,
            'name': concepto,
            'quantity': 1,
            'discount_rate': '0.00',
            'price': valor_copago,
            'tax_rate': '0.00',
            'unit_measure_id': 70,
            'standard_code_id': 1,
            'is_excluded': True,
        }],
        'health': {
            'user': {
                'type_document_identification_id': _id_tipo_doc(paciente.tipo_identificacion),
                'identification': paciente.numero_identificacion,
                'first_name': paciente.primer_nombre,
                'last_name': paciente.primer_apellido,
            },
            'payment_modality_code': ModalidadPago.POR_EVENTO,
        },
    }


# ── Helpers privados ──────────────────────────────────────────────────────────

def _customer_eps(convenio) -> dict:
    """Cliente = EPS (la entidad que paga la factura SS-CUFE)."""
    eps = convenio.aseguradora
    return {
        'identification': eps.nit.replace('-', '').split(' ')[0],
        'dv': '',
        'company': eps.nombre,
        'trade_name': eps.nombre,
        'names': eps.nombre,
        'address': 'Colombia',
        'email': '',
        'phone': '',
        'legal_organization_id': '1',   # Persona jurídica
        'tribute_id': '9',              # No responsable
        'identification_document_id': '6',  # NIT
        'municipality_id': '5001',
    }


def _customer_particular(paciente) -> dict:
    """Cliente = paciente (para SS-SinAporte y SS-Recaudo)."""
    return {
        'identification': paciente.numero_identificacion,
        'dv': '',
        'company': '',
        'trade_name': '',
        'names': paciente.primer_nombre,
        'address': paciente.direccion or 'Colombia',
        'email': paciente.email or '',
        'phone': paciente.telefono or '',
        'legal_organization_id': '2',   # Persona natural
        'tribute_id': '21',             # No responsable IVA
        'identification_document_id': _id_tipo_doc(paciente.tipo_identificacion),
        'municipality_id': paciente.municipio_codigo or '5001',
    }


def _id_tipo_doc(tipo: str) -> str:
    """Mapeo tipo identificación → código Factus."""
    return {
        'CC': '3', 'CE': '5', 'TI': '7', 'RC': '8',
        'PA': '4', 'NIT': '6', 'MS': '11', 'AS': '12',
    }.get(tipo, '3')


def _tipo_cobertura(regimen: str) -> str:
    """Mapeo régimen → código cobertura sector salud."""
    return {
        'C': '01',  # Contributivo
        'S': '02',  # Subsidiado
        'V': '03',  # Vinculado
        'A': '04',  # ARL
        'P': '05',  # Particular
        'T': '06',  # SOAT
    }.get(regimen, '05')


def _concepto_recaudo_label(regimen: str) -> str:
    """Concepto del recaudo según régimen."""
    return {
        'C': 'Cuota Moderadora',
        'S': 'Copago',
        'P': 'Pago voluntario particular',
    }.get(regimen, 'Cuota de recuperación o Pagos compartidos en planes voluntarios de salud')


def seleccionar_tipo_operacion(factura_obj) -> str:
    """
    Determina qué tipo de operación SS usar según el contexto de la factura.
    Regla:
      - Tiene convenio EPS activo → SS-CUFE (factura a la EPS)
      - Sin convenio (particular)  → SS-SinAporte
    """
    if factura_obj.convenio and factura_obj.convenio.activo:
        return TipoOperacionSalud.SS_CUFE
    return TipoOperacionSalud.SS_SIN_APORTE
