"""
FHIR R4 endpoints — Interoperabilidad RDA/IHCE (MinSalud Colombia)
Perfiles: https://simplifier.net/ColombiaFHIR
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


def _fhir_response(resource_type: str, data: dict):
    """Wrapper estándar FHIR R4."""
    return Response(data, content_type='application/fhir+json')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def fhir_patient(request, paciente_id):
    """
    GET /api/fhir/r4/Patient/{id}
    FHIR R4 Patient resource — perfil Colombia MinSalud
    """
    from apps.pacientes.models import Paciente
    try:
        p = Paciente.objects.get(id=paciente_id)
    except Paciente.DoesNotExist:
        return Response({'resourceType': 'OperationOutcome',
                         'issue': [{'severity': 'error', 'code': 'not-found',
                                    'diagnostics': 'Paciente no encontrado'}]}, status=404)

    TIPO_DOC_MAP = {
        'CC': 'national',
        'CE': 'PPN',
        'PA': 'PPN',
        'RC': 'MR',
        'TI': 'MR',
        'MS': 'MR',
        'AS': 'MR',
        'NU': 'MR',
    }

    resource = {
        'resourceType': 'Patient',
        'id': str(p.id),
        'meta': {
            'profile': ['https://minsalud.gov.co/fhir/StructureDefinition/ColPatient']
        },
        'identifier': [{
            'use': 'official',
            'type': {
                'coding': [{
                    'system': 'http://terminology.hl7.org/CodeSystem/v2-0203',
                    'code': TIPO_DOC_MAP.get(p.tipo_identificacion, 'MR'),
                }],
                'text': p.tipo_identificacion,
            },
            'system': 'https://www.registraduria.gov.co',
            'value': p.numero_identificacion,
        }],
        'name': [{
            'use': 'official',
            'family': f'{p.primer_apellido} {p.segundo_apellido or ""}'.strip(),
            'given': [p.primer_nombre, p.segundo_nombre or ''],
        }],
        'telecom': [
            {'system': 'phone', 'value': p.telefono, 'use': 'mobile'} if p.telefono else None,
            {'system': 'email', 'value': p.email} if p.email else None,
        ],
        'gender': {'M': 'male', 'F': 'female', 'I': 'other'}.get(p.sexo, 'unknown'),
        'birthDate': p.fecha_nacimiento.strftime('%Y-%m-%d') if p.fecha_nacimiento else None,
        'address': [{
            'use': 'home',
            'text': p.direccion or '',
            'postalCode': p.municipio_codigo or '',
            'country': 'CO',
        }],
    }
    # Limpiar nulls
    resource['telecom'] = [t for t in resource['telecom'] if t]
    return _fhir_response('Patient', resource)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def fhir_encounter(request, consulta_id):
    """
    GET /api/fhir/r4/Encounter/{id}
    FHIR R4 Encounter resource — mapa desde Consulta
    """
    from apps.consultas.models import Consulta
    try:
        c = Consulta.objects.select_related('paciente', 'medico__usuario').get(id=consulta_id)
    except Consulta.DoesNotExist:
        return Response({'resourceType': 'OperationOutcome',
                         'issue': [{'severity': 'error', 'code': 'not-found',
                                    'diagnostics': 'Consulta no encontrada'}]}, status=404)

    STATUS_MAP = {'abierta': 'in-progress', 'cerrada': 'finished',
                  'facturada': 'finished', 'anulada': 'cancelled'}

    resource = {
        'resourceType': 'Encounter',
        'id': str(c.id),
        'meta': {
            'profile': ['https://minsalud.gov.co/fhir/StructureDefinition/ColEncounter']
        },
        'status': STATUS_MAP.get(c.estado, 'unknown'),
        'class': {
            'system': 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            'code': 'AMB',
            'display': 'Ambulatorio',
        },
        'subject': {'reference': f'Patient/{c.paciente.id}'},
        'period': {'start': c.fecha_atencion.isoformat()},
        'reasonCode': [{
            'coding': [{
                'system': 'https://www.minsalud.gov.co/cups',
                'code': c.cups_principal,
                'display': c.descripcion_cups,
            }]
        }],
        'diagnosis': [
            {
                'condition': {
                    'reference': f'Condition/{c.diagnostico_principal}',
                    'display': c.diagnostico_principal,
                },
                'use': {
                    'coding': [{
                        'system': 'http://terminology.hl7.org/CodeSystem/diagnosis-role',
                        'code': 'AD',
                        'display': 'Admission diagnosis',
                    }]
                },
                'rank': 1,
            }
        ],
    }

    if c.medico and c.medico.usuario:
        resource['participant'] = [{
            'type': [{'coding': [{'system': 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
                                  'code': 'ATND'}]}],
            'individual': {'display': c.medico.usuario.get_full_name()},
        }]

    return _fhir_response('Encounter', resource)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def fhir_medication_request(request, orden_id):
    """
    GET /api/fhir/r4/MedicationRequest/{id}
    FHIR R4 MedicationRequest — desde OrdenMedica tipo medicamento
    """
    from apps.consultas.models import OrdenMedica
    try:
        o = OrdenMedica.objects.select_related('consulta__paciente').get(id=orden_id, tipo='medicamento')
    except OrdenMedica.DoesNotExist:
        return Response({'resourceType': 'OperationOutcome',
                         'issue': [{'severity': 'error', 'code': 'not-found',
                                    'diagnostics': 'Orden no encontrada'}]}, status=404)

    STATUS_MAP = {'pendiente': 'active', 'ejecutada': 'completed', 'cancelada': 'cancelled'}

    resource = {
        'resourceType': 'MedicationRequest',
        'id': str(o.id),
        'status': STATUS_MAP.get(o.estado, 'active'),
        'intent': 'order',
        'medicationCodeableConcept': {
            'coding': [{'system': 'https://www.invima.gov.co/cum', 'code': o.cum}] if o.cum else [],
            'text': o.descripcion,
        },
        'subject': {'reference': f'Patient/{o.consulta.paciente.id}'},
        'encounter': {'reference': f'Encounter/{o.consulta.id}'},
        'authoredOn': o.creado_en.isoformat(),
        'dosageInstruction': [{
            'text': f'{o.dosis} — {o.frecuencia} — {o.duracion}',
            'route': {'text': o.via_admin},
        }] if o.dosis else [],
        'reasonCode': [{'coding': [{'system': 'http://hl7.org/fhir/sid/icd-10',
                                    'code': o.cie10}]}] if o.cie10 else [],
        'note': [{'text': o.indicacion}] if o.indicacion else [],
    }
    return _fhir_response('MedicationRequest', resource)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def fhir_service_request(request, orden_id):
    """
    GET /api/fhir/r4/ServiceRequest/{id}
    FHIR R4 ServiceRequest — desde OrdenMedica tipo lab/imagen/procedimiento
    """
    from apps.consultas.models import OrdenMedica
    try:
        o = OrdenMedica.objects.select_related('consulta__paciente').get(id=orden_id)
    except OrdenMedica.DoesNotExist:
        return Response({'resourceType': 'OperationOutcome',
                         'issue': [{'severity': 'error', 'code': 'not-found',
                                    'diagnostics': 'Orden no encontrada'}]}, status=404)

    CATEGORY_MAP = {
        'lab': {'code': '108252007', 'display': 'Servicio de laboratorio'},
        'imagen': {'code': '363679005', 'display': 'Imagen diagnóstica'},
        'interconsulta': {'code': '306206005', 'display': 'Remisión/Interconsulta'},
        'procedimiento': {'code': '387713003', 'display': 'Procedimiento quirúrgico'},
    }
    STATUS_MAP = {'pendiente': 'active', 'ejecutada': 'completed', 'cancelada': 'revoked'}
    cat = CATEGORY_MAP.get(o.tipo, {'code': 'other', 'display': o.get_tipo_display()})

    resource = {
        'resourceType': 'ServiceRequest',
        'id': str(o.id),
        'status': STATUS_MAP.get(o.estado, 'active'),
        'intent': 'order',
        'category': [{'coding': [{'system': 'http://snomed.info/sct',
                                  'code': cat['code'], 'display': cat['display']}]}],
        'code': {
            'coding': [{'system': 'https://www.minsalud.gov.co/cups',
                        'code': o.cups}] if o.cups else [],
            'text': o.descripcion,
        },
        'subject': {'reference': f'Patient/{o.consulta.paciente.id}'},
        'encounter': {'reference': f'Encounter/{o.consulta.id}'},
        'authoredOn': o.creado_en.isoformat(),
        'reasonCode': [{'coding': [{'system': 'http://hl7.org/fhir/sid/icd-10',
                                    'code': o.cie10}]}] if o.cie10 else [],
        'note': [{'text': o.indicacion}] if o.indicacion else [],
        'quantityQuantity': {'value': o.cantidad},
        'occurrenceTiming': {
            'repeat': {'duration': o.vigencia_dias, 'durationUnit': 'd'}
        },
    }
    return _fhir_response('ServiceRequest', resource)
