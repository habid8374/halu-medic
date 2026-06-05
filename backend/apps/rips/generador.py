"""
Generador de RIPS JSON — Resolución 948 de 2026 (MinSalud)

Estructura correcta (servicios DENTRO de cada usuario):
{
  "numDocumentoIdObligado": "...",
  "numFactura": "FE100940",
  "tipoNota": null,
  "numNota": null,
  "usuarios": [
    {
      "tipoDocumentoIdentificacion": "CC",
      "numDocumentoIdentificacion": "...",
      "tipoUsuario": "01",
      "fechaNacimiento": "1968-01-07",
      "codSexo": "F",
      "codPaisResidencia": "170",       ← código DIVIPOLA, NO "CO"
      "codMunicipioResidencia": "08001", ← 5 dígitos DIVIPOLA
      "codZonaTerritorialResidencia": "01",
      "incapacidad": "NO",              ← "NO" no "N"
      "consecutivo": 1,
      "codPaisOrigen": "170",
      "servicios": {
        "consultas": [...],
        "procedimientos": [...],
        "medicamentos": [...],
        "hospitalizacion": [],
        "otrosServicios": []
      }
    }
  ]
}
"""
import json
import logging

logger = logging.getLogger(__name__)

# Colombia DIVIPOLA
PAIS_COLOMBIA = '170'


class GeneradorRIPS:
    """
    Genera el JSON de RIPS conforme a la Resolución 948 de 2026.

    Uso:
        gen = GeneradorRIPS(factura)
        rips_json = gen.generar()
    """

    def __init__(self, factura):
        self.factura  = factura
        self.consulta = factura.consulta
        self.paciente = self.consulta.paciente
        self.convenio = factura.convenio  # None si es particular

    def generar(self) -> dict:
        """Genera la estructura RIPS completa para una factura."""
        rips = {
            'numDocumentoIdObligado': self._nit_prestador(),
            'numFactura':             self.factura.numero_factus or '',
            'tipoNota':               None,
            'numNota':                None,
            'usuarios': [self._usuario()],
        }
        if self.convenio and self.convenio.cucon:
            rips['cucon'] = self.convenio.cucon
        return rips

    # ── Usuario ──────────────────────────────────────────────────────────────

    def _usuario(self) -> dict:
        p = self.paciente
        return {
            'tipoDocumentoIdentificacion': p.tipo_identificacion,
            'numDocumentoIdentificacion':  p.numero_identificacion,
            'tipoUsuario':                 self._tipo_usuario(),
            'fechaNacimiento':             p.fecha_nacimiento.strftime('%Y-%m-%d'),
            'codSexo':                     p.sexo,
            'codPaisResidencia':           PAIS_COLOMBIA,
            'codMunicipioResidencia':      self._municipio_5dig(p.municipio_codigo),
            'codZonaTerritorialResidencia': '01',
            'incapacidad':                 'NO',
            'consecutivo':                 1,
            'codPaisOrigen':               PAIS_COLOMBIA,
            'servicios': {
                'consultas':       self._consultas(),
                'procedimientos':  self._procedimientos(),
                'medicamentos':    self._medicamentos(),
                'hospitalizacion': [],
                'otrosServicios':  [],
            },
        }

    # ── Servicios ─────────────────────────────────────────────────────────────

    def _consultas(self) -> list:
        if not self.consulta.cups_principal or not float(self.consulta.valor_consulta or 0):
            return []
        rips_data = self._cups_rips_data_consulta()
        return [{
            'codPrestador':              self._codigo_prestador(),
            'fechaInicioAtencion':       self._fmt_fecha(self.consulta.fecha_atencion),
            'numAutorizacion':           self.consulta.numero_autorizacion or '',
            'codConsulta':               self.consulta.cups_principal,
            'modalidadGrupoServicioTecSal': rips_data['modalidad'],
            'grupoServicios':            rips_data['grupo_servicios'],
            'codServicio':               int(rips_data['cod_servicio']) if rips_data['cod_servicio'] else 1,
            'finalidadTecnologiaSalud':  rips_data['finalidad'],
            'causaMotivoAtencion':       self.consulta.causa_atencion or '26',
            'codDiagnosticoPrincipal':   self.consulta.diagnostico_principal,
            'codDiagnosticoRelacionado1': self.consulta.diagnostico_relacionado_1 or None,
            'codDiagnosticoRelacionado2': self.consulta.diagnostico_relacionado_2 or None,
            'codDiagnosticoRelacionado3': self.consulta.diagnostico_relacionado_3 or None,
            'tipoDiagnosticoPrincipal':  self.consulta.tipo_diagnostico or '01',
            'tipoDocumentoIdentificacion': self.paciente.tipo_identificacion,
            'numDocumentoIdentificacion':  self.paciente.numero_identificacion,
            'vrServicio':                float(self.consulta.valor_consulta or 0),
            'conceptoRecaudo':           self._concepto_recaudo(),
            'valorPagoModerador':        float(self.consulta.valor_copago or 0),
            'numFEVPagoModerador':       '',
            'consecutivo':               1,
        }]

    def _procedimientos(self) -> list:
        procs = []
        for i, proc in enumerate(self.consulta.procedimientos.all(), start=1):
            proc_data = self._cups_rips_data_proc(proc)
            procs.append({
                'codPrestador':              self._codigo_prestador(),
                'fechaInicioAtencion':       self._fmt_fecha(self.consulta.fecha_atencion),
                'idMIPRES':                  None,
                'numAutorizacion':           self.consulta.numero_autorizacion or '',
                'codProcedimiento':          proc.cups,
                'viaIngresoServicioSalud':   proc_data.get('via_ingreso', '01'),
                'modalidadGrupoServicioTecSal': proc_data.get('modalidad', '01'),
                'grupoServicios':            proc_data.get('grupo_servicios', '02'),
                'codServicio':               int(proc_data['cod_servicio']) if proc_data.get('cod_servicio') else 1,
                'finalidadTecnologiaSalud':  proc_data.get('finalidad', '15'),
                'tipoDocumentoIdentificacion': self.paciente.tipo_identificacion,
                'numDocumentoIdentificacion':  self.paciente.numero_identificacion,
                'codDiagnosticoPrincipal':   self.consulta.diagnostico_principal,
                'codDiagnosticoRelacionado': self.consulta.diagnostico_relacionado_1 or None,
                'codComplicacion':           None,
                'vrServicio':                float(proc.valor_facturar),
                'conceptoRecaudo':           self._concepto_recaudo(),
                'valorPagoModerador':        0,
                'numFEVPagoModerador':       '',
                'consecutivo':               i,
            })
        return procs

    def _medicamentos(self) -> list:
        if not hasattr(self.consulta, 'medicamentos'):
            return []
        meds = []
        for i, med in enumerate(self.consulta.medicamentos.all(), start=1):
            meds.append({
                'codPrestador':            self._codigo_prestador(),
                'numAutorizacion':         '',
                'idMIPRES':                None,
                'fechaDispensAdmon':       self._fmt_fecha(med.fecha),
                'codDiagnosticoPrincipal': self.consulta.diagnostico_principal,
                'codDiagnosticoRelacionado': self.consulta.diagnostico_relacionado_1 or None,
                'tipoMedicamento':         med.tipo or '01',
                'codTecnologiaSalud':      med.cum or '',
                'nomTecnologiaSalud':      med.nombre,
                'concentracionMedicamento': float(med.concentracion or 0),
                'unidadMedida':            int(med.unidad_medida) if med.unidad_medida else 168,
                'formaFarmaceutica':       med.forma_farmaceutica or '',
                'unidadMinDispensa':       int(med.unidades or 1),
                'cantidadMedicamento':     int(med.unidades or 1),
                'diasTratamiento':         int(med.dias_tratamiento or 1),
                'tipoDocumentoIdentificacion': self.paciente.tipo_identificacion,
                'numDocumentoIdentificacion':  self.paciente.numero_identificacion,
                'vrUnitMedicamento':       float(med.valor_unitario),
                'vrServicio':              float(med.valor_total),
                'conceptoRecaudo':         self._concepto_recaudo(),
                'valorPagoModerador':      0,
                'numFEVPagoModerador':     '',
                'consecutivo':             i,
            })
        return meds

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _fmt_fecha(self, dt) -> str:
        """Formato de fecha RIPS: 'YYYY-MM-DD HH:MM'"""
        if not dt:
            return ''
        return dt.strftime('%Y-%m-%d %H:%M')

    def _municipio_5dig(self, codigo: str) -> str:
        """DIVIPOLA 5 dígitos. Barranquilla por defecto."""
        if not codigo:
            return '08001'
        # Si viene con 6 dígitos (ej. 085001) convertir a 5 (08001)
        c = str(codigo).strip()
        if len(c) == 6:
            return c[0:2] + c[3:]
        return c[:5] if len(c) > 5 else c

    def _cups_rips_data_consulta(self) -> dict:
        try:
            from apps.catalogos.models import CodigoCUPS
            cups = CodigoCUPS.objects.get(codigo=self.consulta.cups_principal)
            return {
                'modalidad':       cups.modalidad_rips or self.consulta.modalidad or '01',
                'grupo_servicios': cups.grupo_servicios_rips or self.consulta.grupo_servicio or '01',
                'cod_servicio':    cups.cod_servicio_rips or self.consulta.codigo_servicio or '1',
                'finalidad':       cups.finalidad_rips or self.consulta.finalidad or '44',
            }
        except Exception:
            return {
                'modalidad':       self.consulta.modalidad or '01',
                'grupo_servicios': self.consulta.grupo_servicio or '01',
                'cod_servicio':    self.consulta.codigo_servicio or '1',
                'finalidad':       self.consulta.finalidad or '44',
            }

    def _cups_rips_data_proc(self, proc) -> dict:
        try:
            from apps.catalogos.models import CodigoCUPS
            cups = CodigoCUPS.objects.get(codigo=proc.cups)
            return {
                'modalidad':       cups.modalidad_rips or '01',
                'grupo_servicios': cups.grupo_servicios_rips or '02',
                'cod_servicio':    cups.cod_servicio_rips or '1',
                'finalidad':       cups.finalidad_rips or '15',
                'via_ingreso':     cups.via_ingreso_rips or '01',
            }
        except Exception:
            return {
                'modalidad':       '01',
                'grupo_servicios': '02',
                'cod_servicio':    getattr(proc, 'codigo_servicio', None) or '1',
                'finalidad':       getattr(proc, 'finalidad', None) or '15',
                'via_ingreso':     '01',
            }

    def _nit_prestador(self) -> str:
        from django.db import connection
        from django.conf import settings
        tenant = getattr(connection, 'tenant', None)
        if tenant and getattr(tenant, 'nit', ''):
            return tenant.nit.split('-')[0].strip()
        return getattr(settings, 'NIT_PRESTADOR', '')

    def _codigo_prestador(self) -> str:
        from django.db import connection
        from django.conf import settings
        tenant = getattr(connection, 'tenant', None)
        if tenant and getattr(tenant, 'codigo_prestador', ''):
            return tenant.codigo_prestador
        return getattr(settings, 'CODIGO_PRESTADOR_RIPS', '')

    def _tipo_usuario(self) -> str:
        """Código tipoUsuario según régimen — 2 dígitos."""
        mapeo = {
            'C': '01',  # Contributivo
            'S': '02',  # Subsidiado
            'V': '03',  # Vinculado/PPNA
            'P': '04',  # Particular
            'A': '06',  # ARL
            'T': '07',  # SOAT
            'O': '09',  # Otro
        }
        return mapeo.get(self.paciente.regimen, '04')

    def _concepto_recaudo(self) -> str:
        mapeo = {
            'C': '02',  # Cuota moderadora
            'S': '03',  # Copago subsidiado
            'P': '04',  # Pago voluntario particular
            'A': '06',  # ARL
        }
        return mapeo.get(self.paciente.regimen, '04')

    def exportar_json(self, rips: dict) -> str:
        return json.dumps(rips, ensure_ascii=False, indent=2, default=str)
