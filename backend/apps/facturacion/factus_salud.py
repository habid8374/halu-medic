"""
Cliente Factus — Factura Electrónica Sector Salud
Documentación: https://developers.factus.com.co/facturas/tipos-de-factura/ss-cufe/

Campos SS-CUFE según documentación oficial Factus:
  health_coverage_code       → código cobertura (01-06)
  health_modality_code       → modalidad pago (01-05)
  health_document_type       → tipo doc paciente (código Factus)
  health_document_number     → nro identificación paciente
  health_first_name          → primer nombre paciente
  health_other_names         → segundo nombre
  health_last_name           → primer apellido
  health_other_last_name     → segundo apellido
  health_billing_period_start_date / _start_time
  health_billing_period_end_date / _end_time
  health_authorization_number → nro autorización EPS
  health_contract_number      → nro contrato EPS
  health_policy_number        → nro póliza
  health_copay               → valor copago
  health_moderation_fee      → valor cuota moderadora
  health_recovery_fee        → cuota de recuperación
  health_volunteer_payments  → pagos voluntarios
  health_provider_code       → código prestador (10 dígitos SISPRO)

Tipos de operación:
  operation_type_id = 22  → SS-CUFE      (IPS → EPS con convenio)
  operation_type_id = 23  → SS-SinAporte (particular)
  operation_type_id = 24  → SS-Recaudo   (copago al paciente)
  operation_type_id = 25  → SS-Reporte   (EPS recibe ingresos)
"""
from .factus_client import FactusClient, FactusAPIError
import logging

logger = logging.getLogger(__name__)


class OpSalud:
    SS_CUFE       = 22
    SS_SIN_APORTE = 23
    SS_RECAUDO    = 24
    SS_REPORTE    = 25


class CoberturaSalud:
    """Códigos cobertura según catálogo Factus / MinSalud."""
    CONTRIBUTIVO = '01'
    SUBSIDIADO   = '02'
    VINCULADO    = '03'
    ARL          = '04'
    PARTICULAR   = '05'
    SOAT         = '06'

    @classmethod
    def desde_regimen(cls, regimen: str) -> str:
        return {
            'C': cls.CONTRIBUTIVO,
            'S': cls.SUBSIDIADO,
            'V': cls.VINCULADO,
            'A': cls.ARL,
            'P': cls.PARTICULAR,
            'T': cls.SOAT,
        }.get(regimen, cls.PARTICULAR)


class ModalidadPago:
    """Códigos modalidad de pago según catálogo Factus."""
    POR_EVENTO         = '01'
    GLOBAL_PROSPECTIVO = '02'
    POR_CASO           = '03'
    CAPITACION         = '04'
    OTRA               = '05'


# Mapeo tipo doc → ID Factus
_DOC_ID = {
    'CC': '3', 'CE': '5', 'TI': '7', 'RC': '8',
    'PA': '4', 'NIT': '6', 'MS': '11', 'AS': '12',
}


class FactusSaludClient(FactusClient):
    """Extiende FactusClient con métodos para sector salud."""

    def crear_factura_salud(self, payload: dict) -> dict:
        """POST /v1/bills/validate con campos health_* para SS-CUFE."""
        response = self._client.post(
            f'{self.base_url}/v1/bills/validate',
            json=payload,
            headers=self._headers(),
        )
        data = response.json()
        if response.status_code not in (200, 201):
            raise FactusAPIError(
                f'Error SS-CUFE: {data.get("message", response.text)}',
                status_code=response.status_code,
                errors=data.get('errors', [])
            )
        logger.info(f'Factura salud OK: {data.get("data", {}).get("number")}')
        return data.get('data', data)


def _items_desde_consulta(factura_obj) -> list:
    """Construye los items de la factura desde la consulta."""
    consulta = factura_obj.consulta
    items = []

    if consulta.valor_consulta and float(consulta.valor_consulta) > 0:
        items.append({
            'code_reference': consulta.cups_principal,
            'name': consulta.descripcion_cups or f'Consulta médica {consulta.cups_principal}',
            'quantity': 1,
            'discount_rate': '0.00',
            'price': float(consulta.valor_consulta),
            'tax_rate': '0.00',       # Servicios salud exentos IVA Art. 476 ET
            'unit_measure_id': 70,    # Unidad servicio médico
            'standard_code_id': 1,
        })

    for proc in consulta.procedimientos.all():
        items.append({
            'code_reference': proc.cups,
            'name': proc.descripcion,
            'quantity': int(proc.cantidad),
            'discount_rate': '0.00',
            'price': float(proc.valor_facturar),
            'tax_rate': '0.00',
            'unit_measure_id': 70,
            'standard_code_id': 1,
        })

    return items


def construir_payload_ss_cufe(factura_obj) -> dict:
    """
    Payload completo SS-CUFE para Factus.
    El cliente (adquirente) es la EPS. El paciente va en los campos health_*.
    """
    consulta = factura_obj.consulta
    paciente = consulta.paciente
    convenio = factura_obj.convenio
    eps      = convenio.aseguradora

    payload = {
        # ── Identificación del documento ──────────────────────────────────────
        'operation_type_id': OpSalud.SS_CUFE,
        'numbering_range_id': factura_obj.rango_numeracion_id,
        'reference_code': str(factura_obj.id),
        'observation': factura_obj.observaciones or '',
        'payment_method_code': '10',  # Efectivo (crédito con EPS → código '1')

        # ── Adquirente = EPS ──────────────────────────────────────────────────
        'customer': {
            'identification': eps.nit.split('-')[0].strip(),
            'dv': eps.nit.split('-')[1].strip() if '-' in eps.nit else '',
            'company': eps.nombre,
            'trade_name': eps.nombre,
            'names': eps.nombre,
            'address': 'Colombia',
            'email': '',
            'phone': '',
            'legal_organization_id': '1',  # Persona jurídica
            'tribute_id': '9',             # No responsable
            'identification_document_id': '6',  # NIT
            'municipality_id': '5001',
        },

        # ── Items (servicios prestados) ───────────────────────────────────────
        'items': _items_desde_consulta(factura_obj),

        # ── Campos sector salud SS-CUFE ───────────────────────────────────────
        # Cobertura y modalidad
        'health_coverage_code': CoberturaSalud.desde_regimen(paciente.regimen),
        'health_modality_code': ModalidadPago.POR_EVENTO,
        'health_provider_code': _codigo_prestador(),

        # Datos del paciente beneficiario
        'health_document_type': _DOC_ID.get(paciente.tipo_identificacion, '3'),
        'health_document_number': paciente.numero_identificacion,
        'health_first_name': paciente.primer_nombre,
        'health_other_names': paciente.segundo_nombre or '',
        'health_last_name': paciente.primer_apellido,
        'health_other_last_name': paciente.segundo_apellido or '',

        # Período de facturación
        'health_billing_period_start_date': consulta.fecha_atencion.strftime('%Y-%m-%d'),
        'health_billing_period_start_time': consulta.fecha_atencion.strftime('%H:%M:%S'),
        'health_billing_period_end_date': consulta.fecha_atencion.strftime('%Y-%m-%d'),
        'health_billing_period_end_time': consulta.fecha_atencion.strftime('%H:%M:%S'),

        # Contrato y autorización
        'health_contract_number': convenio.numero_contrato,
        'health_policy_number': paciente.numero_poliza or '',
        'health_authorization_number': consulta.numero_autorizacion or '',

        # CUCON — Res. 948/2026 (obligatorio en convenios)
        'health_cucon': convenio.cucon or '',

        # Valores de aporte del paciente (se descuentan del valor a cobrar a EPS)
        'health_copay': float(factura_obj.valor_copago)
            if paciente.regimen in ('S',) else 0,
        'health_moderation_fee': float(factura_obj.valor_copago)
            if paciente.regimen in ('C',) else 0,
        'health_recovery_fee': float(factura_obj.valor_copago)
            if paciente.regimen in ('V',) else 0,
        'health_volunteer_payments': 0,
    }

    return payload


def construir_payload_ss_sin_aporte(factura_obj) -> dict:
    """
    Payload SS-SinAporte — para pacientes particulares (sin convenio EPS).
    El adquirente es el propio paciente.
    """
    consulta = factura_obj.consulta
    paciente = consulta.paciente

    return {
        'operation_type_id': OpSalud.SS_SIN_APORTE,
        'numbering_range_id': factura_obj.rango_numeracion_id,
        'reference_code': str(factura_obj.id),
        'observation': factura_obj.observaciones or '',
        'payment_method_code': '10',

        'customer': {
            'identification': paciente.numero_identificacion,
            'dv': '',
            'company': '',
            'trade_name': '',
            'names': paciente.primer_nombre,
            'address': paciente.direccion or 'Colombia',
            'email': paciente.email or '',
            'phone': paciente.telefono or '',
            'legal_organization_id': '2',
            'tribute_id': '21',
            'identification_document_id': _DOC_ID.get(paciente.tipo_identificacion, '3'),
            'municipality_id': paciente.municipio_codigo or '5001',
        },

        'items': _items_desde_consulta(factura_obj),

        # Campos salud SS-SinAporte
        'health_coverage_code': CoberturaSalud.PARTICULAR,
        'health_modality_code': ModalidadPago.POR_EVENTO,
        'health_provider_code': _codigo_prestador(),
        'health_document_type': _DOC_ID.get(paciente.tipo_identificacion, '3'),
        'health_document_number': paciente.numero_identificacion,
        'health_first_name': paciente.primer_nombre,
        'health_other_names': paciente.segundo_nombre or '',
        'health_last_name': paciente.primer_apellido,
        'health_other_last_name': paciente.segundo_apellido or '',
        'health_billing_period_start_date': consulta.fecha_atencion.strftime('%Y-%m-%d'),
        'health_billing_period_start_time': consulta.fecha_atencion.strftime('%H:%M:%S'),
        'health_billing_period_end_date': consulta.fecha_atencion.strftime('%Y-%m-%d'),
        'health_billing_period_end_time': consulta.fecha_atencion.strftime('%H:%M:%S'),
        'health_contract_number': '',
        'health_policy_number': paciente.numero_poliza or '',
        'health_authorization_number': consulta.numero_autorizacion or '',
        'health_cucon': '',
        'health_copay': 0,
        'health_moderation_fee': 0,
        'health_recovery_fee': 0,
        'health_volunteer_payments': float(factura_obj.valor_copago) if factura_obj.valor_copago else 0,
    }


def construir_payload_ss_recaudo(consulta_obj, valor: float) -> dict:
    """
    Payload SS-Recaudo — cobro de copago/cuota moderadora al paciente.
    Se emite ANTES del SS-CUFE. Su CUFE se referencia como prepago.
    """
    paciente = consulta_obj.paciente
    concepto = {
        'C': 'Cuota Moderadora',
        'S': 'Copago',
        'V': 'Cuota de Recuperación',
    }.get(paciente.regimen, 'Pago voluntario')

    return {
        'operation_type_id': OpSalud.SS_RECAUDO,
        'reference_code': f'rec-{consulta_obj.id}',
        'observation': concepto,
        'payment_method_code': '10',
        'customer': {
            'identification': paciente.numero_identificacion,
            'dv': '',
            'names': paciente.primer_nombre,
            'address': paciente.direccion or 'Colombia',
            'email': paciente.email or '',
            'phone': paciente.telefono or '',
            'legal_organization_id': '2',
            'tribute_id': '21',
            'identification_document_id': _DOC_ID.get(paciente.tipo_identificacion, '3'),
            'municipality_id': paciente.municipio_codigo or '5001',
        },
        'items': [{
            'code_reference': consulta_obj.cups_principal,
            'name': concepto,
            'quantity': 1,
            'discount_rate': '0.00',
            'price': valor,
            'tax_rate': '0.00',
            'unit_measure_id': 70,
            'standard_code_id': 1,
        }],
        'health_coverage_code': CoberturaSalud.desde_regimen(paciente.regimen),
        'health_modality_code': ModalidadPago.POR_EVENTO,
        'health_provider_code': _codigo_prestador(),
        'health_document_type': _DOC_ID.get(paciente.tipo_identificacion, '3'),
        'health_document_number': paciente.numero_identificacion,
        'health_first_name': paciente.primer_nombre,
        'health_last_name': paciente.primer_apellido,
        'health_billing_period_start_date': consulta_obj.fecha_atencion.strftime('%Y-%m-%d'),
        'health_billing_period_start_time': consulta_obj.fecha_atencion.strftime('%H:%M:%S'),
        'health_billing_period_end_date': consulta_obj.fecha_atencion.strftime('%Y-%m-%d'),
        'health_billing_period_end_time': consulta_obj.fecha_atencion.strftime('%H:%M:%S'),
    }


def seleccionar_operacion(factura_obj) -> int:
    """Determina el operation_type_id correcto."""
    if factura_obj.convenio and factura_obj.convenio.activo:
        return OpSalud.SS_CUFE
    return OpSalud.SS_SIN_APORTE


def construir_payload_auto(factura_obj) -> dict:
    """Selecciona y construye el payload correcto automáticamente."""
    op = seleccionar_operacion(factura_obj)
    if op == OpSalud.SS_CUFE:
        return construir_payload_ss_cufe(factura_obj)
    return construir_payload_ss_sin_aporte(factura_obj)


def _codigo_prestador() -> str:
    from django.conf import settings
    return getattr(settings, 'CODIGO_PRESTADOR_RIPS', '0000000000')
