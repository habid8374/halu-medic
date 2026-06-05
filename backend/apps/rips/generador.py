"""
Generador de RIPS JSON — Resolución 948 de 2026 (MinSalud)

Estructura raíz (transacción):
{
  "numDocumentoIdObligado": "NIT del prestador sin dígito verificación",
  "numFactura": "SETP000000001",
  "tipoNota": null,           // null | "NC" | "ND"
  "numNota": null,
  "cucon": "SHA-256 64 chars" // OBLIGATORIO Res.948 — vacío si es particular
}

Cada usuario lleva sus servicios anidados directamente (no bajo "servicios"):
  usuarios[].consultas, .procedimientos, .urgencias,
             .hospitalizacion, .recienNacidos, .medicamentos, .otrosServicios

Campos médico OBLIGATORIOS en cada servicio (Res.948):
  tipoDocumentoIdentificacionMedico / numDocumentoIdentificacionMedico

vrDispensacion en medicamentos OBLIGATORIO desde 1-julio-2026.
"""
import json
import logging

logger = logging.getLogger(__name__)

PAIS_COLOMBIA = '170'


def _nit_prestador() -> str:
    from django.db import connection
    from django.conf import settings
    tenant = getattr(connection, 'tenant', None)
    if tenant and getattr(tenant, 'nit', ''):
        return tenant.nit.split('-')[0].strip()
    return getattr(settings, 'NIT_PRESTADOR', '')


def _codigo_prestador() -> str:
    from django.db import connection
    from django.conf import settings
    tenant = getattr(connection, 'tenant', None)
    if tenant and getattr(tenant, 'codigo_prestador', ''):
        return tenant.codigo_prestador
    return getattr(settings, 'CODIGO_PRESTADOR_RIPS', '')


def _municipio_5dig(codigo: str) -> str:
    """DIVIPOLA 5 dígitos. Barranquilla por defecto."""
    if not codigo:
        return '08001'
    c = str(codigo).strip()
    if len(c) == 6:
        return c[0:2] + c[3:]
    return c[:5] if len(c) > 5 else c


def _fmt_fecha(dt) -> str:
    if not dt:
        return ''
    return dt.strftime('%Y-%m-%d %H:%M')


def _tipo_usuario(regimen: str) -> str:
    return {
        'C': '01',  # Contributivo
        'S': '02',  # Subsidiado
        'V': '03',  # Vinculado/PPNA
        'P': '04',  # Particular
        'A': '06',  # ARL
        'T': '07',  # SOAT
        'O': '09',  # Otro
    }.get(regimen, '04')


def _concepto_recaudo(regimen: str) -> str:
    return {
        'C': '02',
        'S': '03',
        'P': '04',
        'A': '06',
        'T': '07',
    }.get(regimen, '04')


def _doc_medico(medico) -> tuple:
    """Retorna (tipo_doc, num_doc) del médico para campos RIPS obligatorios."""
    if medico:
        return (
            getattr(medico, 'tipo_identificacion', 'CC') or 'CC',
            getattr(medico, 'numero_identificacion', '') or '',
        )
    return ('CC', '')


def _cups_rips_data(cups_code: str, fallback: dict) -> dict:
    try:
        from apps.catalogos.models import CodigoCUPS
        cups = CodigoCUPS.objects.get(codigo=cups_code)
        return {
            'modalidad':       cups.modalidad_rips or fallback.get('modalidad', '01'),
            'grupo_servicios': cups.grupo_servicios_rips or fallback.get('grupo_servicios', '01'),
            'cod_servicio':    cups.cod_servicio_rips or fallback.get('cod_servicio', '1'),
            'finalidad':       cups.finalidad_rips or fallback.get('finalidad', '44'),
            'via_ingreso':     cups.via_ingreso_rips or fallback.get('via_ingreso', '02'),
        }
    except Exception:
        return {
            'modalidad':       fallback.get('modalidad', '01'),
            'grupo_servicios': fallback.get('grupo_servicios', '01'),
            'cod_servicio':    fallback.get('cod_servicio', '1'),
            'finalidad':       fallback.get('finalidad', '44'),
            'via_ingreso':     fallback.get('via_ingreso', '02'),
        }


class GeneradorRIPS:
    """
    Genera el JSON de RIPS conforme a la Resolución 948 de 2026.

    Uso:
        gen = GeneradorRIPS(factura)
        rips_dict = gen.generar()
        rips_str  = gen.exportar_json(rips_dict)
    """

    def __init__(self, factura):
        self.factura  = factura
        self.consulta = factura.consulta
        self.paciente = self.consulta.paciente
        self.medico   = self.consulta.medico
        self.convenio = factura.convenio

    def generar(self) -> dict:
        cucon = ''
        if self.convenio and getattr(self.convenio, 'cucon', ''):
            cucon = self.convenio.cucon

        return {
            'numDocumentoIdObligado': _nit_prestador(),
            'numFactura':             self.factura.numero_factus or '',
            'tipoNota':               None,
            'numNota':                None,
            'cucon':                  cucon,  # obligatorio Res.948 (vacío si particular)
            'usuarios':               [self._usuario()],
        }

    # ── Usuario ──────────────────────────────────────────────────────────────

    def _usuario(self) -> dict:
        p = self.paciente
        return {
            'tipoDocumentoIdentificacion':  p.tipo_identificacion,
            'numDocumentoIdentificacion':   p.numero_identificacion,
            'tipoUsuario':                  _tipo_usuario(p.regimen),
            'fechaNacimiento':              p.fecha_nacimiento.strftime('%Y-%m-%d'),
            'codSexo':                      p.sexo,
            'codPaisResidencia':            PAIS_COLOMBIA,
            'codMunicipioResidencia':       _municipio_5dig(p.municipio_codigo),
            'codZonaTerritorialResidencia': '01',
            'incapacidad':                  'NO',
            'consecutivo':                  1,
            'codPaisOrigen':                PAIS_COLOMBIA,
            # servicios anidados directamente en el usuario (no bajo "servicios")
            'consultas':       self._consultas(),
            'procedimientos':  self._procedimientos(),
            'urgencias':       [],
            'hospitalizacion': [],
            'recienNacidos':   [],
            'medicamentos':    self._medicamentos(),
            'otrosServicios':  [],
        }

    # ── Consultas ─────────────────────────────────────────────────────────────

    def _consultas(self) -> list:
        if not self.consulta.cups_principal or not float(self.consulta.valor_consulta or 0):
            return []
        tipo_doc_med, num_doc_med = _doc_medico(self.medico)
        rips = _cups_rips_data(self.consulta.cups_principal, {
            'modalidad':       self.consulta.modalidad,
            'grupo_servicios': self.consulta.grupo_servicio,
            'cod_servicio':    self.consulta.codigo_servicio,
            'finalidad':       self.consulta.finalidad,
        })
        return [{
            'codPrestador':                      _codigo_prestador(),
            'fechaInicioAtencion':               _fmt_fecha(self.consulta.fecha_atencion),
            'numAutorizacion':                   self.consulta.numero_autorizacion or '',
            'codConsulta':                       self.consulta.cups_principal,
            'modalidadGrupoServicioTecSal':      rips['modalidad'],
            'grupoServicios':                    rips['grupo_servicios'],
            'codServicio':                       int(rips['cod_servicio']) if rips['cod_servicio'] else 1,
            'finalidadTecnologiaSalud':          rips['finalidad'],
            'causaMotivoAtencion':               self.consulta.causa_atencion or '26',
            'codDiagnosticoPrincipal':           self.consulta.diagnostico_principal,
            'codDiagnosticoRelacionado1':        self.consulta.diagnostico_relacionado_1 or None,
            'codDiagnosticoRelacionado2':        self.consulta.diagnostico_relacionado_2 or None,
            'codDiagnosticoRelacionado3':        self.consulta.diagnostico_relacionado_3 or None,
            'tipoDiagnosticoPrincipal':          self.consulta.tipo_diagnostico or '01',
            'tipoDocumentoIdentificacionMedico': tipo_doc_med,
            'numDocumentoIdentificacionMedico':  num_doc_med,
            'vrServicio':                        float(self.consulta.valor_consulta or 0),
            'conceptoRecaudo':                   _concepto_recaudo(self.paciente.regimen),
            'valorPagoModerador':                float(self.consulta.valor_copago or 0),
            'numFEVPagoModerador':               '',
            'consecutivo':                       1,
        }]

    # ── Procedimientos ────────────────────────────────────────────────────────

    def _procedimientos(self) -> list:
        tipo_doc_med, num_doc_med = _doc_medico(self.medico)
        procs = []
        for i, proc in enumerate(self.consulta.procedimientos.all(), start=1):
            rips = _cups_rips_data(proc.cups, {
                'modalidad':       self.consulta.modalidad,
                'grupo_servicios': '02',
                'cod_servicio':    getattr(proc, 'codigo_servicio', None) or '1',
                'finalidad':       getattr(proc, 'finalidad', None) or '15',
                'via_ingreso':     self.consulta.via_ingreso or '02',
            })
            procs.append({
                'codPrestador':                      _codigo_prestador(),
                'fechaInicioAtencion':               _fmt_fecha(self.consulta.fecha_atencion),
                'idMIPRES':                          None,
                'numAutorizacion':                   self.consulta.numero_autorizacion or '',
                'codProcedimiento':                  proc.cups,
                'viaIngresoServicioSalud':           rips['via_ingreso'],
                'modalidadGrupoServicioTecSal':      rips['modalidad'],
                'grupoServicios':                    rips['grupo_servicios'],
                'codServicio':                       int(rips['cod_servicio']) if rips['cod_servicio'] else 1,
                'finalidadTecnologiaSalud':          rips['finalidad'],
                'codDiagnosticoPrincipal':           self.consulta.diagnostico_principal,
                'codDiagnosticoRelacionado1':        self.consulta.diagnostico_relacionado_1 or None,
                'codComplicacion':                   None,
                'tipoDiagnosticoPrincipal':          self.consulta.tipo_diagnostico or '01',
                'tipoDocumentoIdentificacionMedico': tipo_doc_med,
                'numDocumentoIdentificacionMedico':  num_doc_med,
                'vrServicio':                        float(proc.valor_facturar),
                'conceptoRecaudo':                   _concepto_recaudo(self.paciente.regimen),
                'valorPagoModerador':                0,
                'numFEVPagoModerador':               '',
                'consecutivo':                       i,
            })
        return procs

    # ── Medicamentos ──────────────────────────────────────────────────────────

    def _medicamentos(self) -> list:
        if not hasattr(self.consulta, 'medicamentos'):
            return []
        tipo_doc_med, num_doc_med = _doc_medico(self.medico)
        meds = []
        for i, med in enumerate(self.consulta.medicamentos.all(), start=1):
            meds.append({
                'codPrestador':                      _codigo_prestador(),
                'numAutorizacion':                   '',
                'idMIPRES':                          None,
                'fechaDispensAdmon':                 _fmt_fecha(med.fecha),
                'codDiagnosticoPrincipal':           self.consulta.diagnostico_principal,
                'codDiagnosticoRelacionado1':        self.consulta.diagnostico_relacionado_1 or None,
                'tipoMedicamento':                   med.tipo or '1',
                'codTecnologiaSalud':                med.cum or '',
                'nomTecnologiaSalud':                med.nombre,
                'concentracionMedicamento':          str(med.concentracion or ''),
                'unidadMedida':                      med.unidad_medida or '',
                'formaFarmaceutica':                 med.forma_farmaceutica or '',
                'unidadMinDispensa':                 int(med.unidades or 1),
                'cantidadMedicamento':               int(med.unidades or 1),
                'diasTratamiento':                   int(getattr(med, 'dias_tratamiento', 1) or 1),
                'tipoDocumentoIdentificacionMedico': tipo_doc_med,
                'numDocumentoIdentificacionMedico':  num_doc_med,
                'vrUnitMedicamento':                 float(med.valor_unitario),
                'vrServicio':                        float(med.valor_total),
                # vrDispensacion: obligatorio desde 1-julio-2026 (Res.948)
                'vrDispensacion':                    float(getattr(med, 'valor_dispensacion', 0) or 0),
                'conceptoRecaudo':                   _concepto_recaudo(self.paciente.regimen),
                'valorPagoModerador':                0,
                'numFEVPagoModerador':               '',
                'consecutivo':                       i,
            })
        return meds

    def exportar_json(self, rips: dict) -> str:
        return json.dumps(rips, ensure_ascii=False, indent=2, default=str)
