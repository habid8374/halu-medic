"""
Generador de RIPS JSON
Alineado a Resolución 948 de 2026 (MinSalud)
Deroga: Resolución 2275/2023, 558/2024, 1884/2024

Estructura JSON de salida:
{
  "numDocumentoIdObligado": "...",
  "numFactura": "...",
  "tipoDocumentoIdentificacion": "...",
  "cucon": "...",          ← NUEVO en Res. 948/2026 (obligatorio en convenios)
  "consecutivo": 1,
  "usuarios": [...],
  "consultas": [...],
  "procedimientos": [...],
  "medicamentos": [...],   ← si aplica
  "otrosServicios": [...]
}
"""
import hashlib
import json
import logging
from datetime import datetime
from decimal import Decimal

logger = logging.getLogger(__name__)


class GeneradorRIPS:
    """
    Genera el JSON de RIPS conforme a la Resolución 948 de 2026.
    
    Uso:
        gen = GeneradorRIPS(factura)
        rips_json = gen.generar()
        gen.validar(rips_json)
    """

    def __init__(self, factura):
        self.factura = factura
        self.consulta = factura.consulta
        self.paciente = self.consulta.paciente
        self.convenio = factura.convenio  # None si es particular

    def generar(self) -> dict:
        """Genera la estructura RIPS completa para una factura."""
        rips = {
            'numDocumentoIdObligado': self._nit_prestador(),
            'numFactura': self.factura.numero_factus or '',
            'tipoDocumentoIdentificacion': self.paciente.tipo_identificacion,
            'numDocumentoIdentificacion': self.paciente.numero_identificacion,
            'consecutivo': 1,
            'usuarios': [self._usuario()],
            'consultas': self._consultas(),
            'procedimientos': self._procedimientos(),
            'medicamentos': self._medicamentos(),
            'otrosServicios': [],
        }

        # CUCON — Res. 948/2026: obligatorio cuando hay convenio EPS
        if self.convenio and self.convenio.cucon:
            rips['cucon'] = self.convenio.cucon
        
        return rips

    # ── Secciones ────────────────────────────────────────────────────────────

    def _usuario(self) -> dict:
        p = self.paciente
        return {
            'tipoDocumentoIdentificacion': p.tipo_identificacion,
            'numDocumentoIdentificacion': p.numero_identificacion,
            'primerNombre': p.primer_nombre,
            'segundoNombre': p.segundo_nombre or '',
            'primerApellido': p.primer_apellido,
            'segundoApellido': p.segundo_apellido or '',
            'fechaNacimiento': p.fecha_nacimiento.strftime('%Y-%m-%d'),
            'codSexo': p.sexo,
            'codPaisResidencia': 'CO',
            'codMunicipioResidencia': p.municipio_codigo or '08001',  # Barranquilla por defecto
            'codZonaTerritorialResidencia': '1',  # 1=Cabecera, 2=Centro poblado, 3=Rural
            'incapacidad': 'N',
            'codPaisOrigen': 'CO',
            'tipoUsuario': self._tipo_usuario(),
            'numAutorizacion': self.consulta.numero_autorizacion or '',
            'numMIPRES': '',
            'idMIPRES': '',
            'numContrato': self.convenio.numero_contrato if self.convenio else '',
            'numPoliza': p.numero_poliza or '',
            'consecutivoFacturacion': 1,
            'pagadorRecuperacion': '',
            'consecutivoPagadorRecuperacion': '',
        }

    def _get_cups_rips_data(self) -> dict:
        """Obtiene datos RIPS del catálogo CUPS. Fallback a valores de la consulta."""
        try:
            from apps.catalogos.models import CodigoCUPS
            cups = CodigoCUPS.objects.get(codigo=self.consulta.cups_principal)
            return {
                'modalidad':        cups.modalidad_rips or self.consulta.modalidad,
                'grupo_servicios':  cups.grupo_servicios_rips or self.consulta.grupo_servicio,
                'cod_servicio':     cups.cod_servicio_rips or self.consulta.codigo_servicio,
                'finalidad':        cups.finalidad_rips or self.consulta.finalidad,
                'via_ingreso':      cups.via_ingreso_rips or getattr(self.consulta, 'via_ingreso', '2'),
                'personal_atiende': cups.personal_atiende or '01',
                'ambito':           cups.ambito_rips or '1',
            }
        except Exception:
            return {
                'modalidad':        self.consulta.modalidad,
                'grupo_servicios':  self.consulta.grupo_servicio,
                'cod_servicio':     self.consulta.codigo_servicio,
                'finalidad':        self.consulta.finalidad,
                'via_ingreso':      getattr(self.consulta, 'via_ingreso', '2'),
                'personal_atiende': '01',
                'ambito':           '1',
            }

    def _get_proc_cups_rips_data(self, proc) -> dict:
        """Obtiene datos RIPS del catálogo CUPS para un procedimiento."""
        try:
            from apps.catalogos.models import CodigoCUPS
            cups = CodigoCUPS.objects.get(codigo=proc.cups)
            return {
                'ambito':           cups.ambito_rips or proc.ambito or '1',
                'finalidad':        cups.finalidad_rips or proc.finalidad or '01',
                'personal_atiende': cups.personal_atiende or proc.personal_atiende or '01',
            }
        except Exception:
            return {
                'ambito':           proc.ambito or '1',
                'finalidad':        proc.finalidad or '01',
                'personal_atiende': proc.personal_atiende or '01',
            }

    def _consultas(self) -> list:
        """Genera el bloque de consultas médicas (código AC en RIPS)."""
        rips_data = self._get_cups_rips_data()
        return [{
            'codPrestador': self._codigo_prestador(),
            'fechaInicioAtencion': self.consulta.fecha_atencion.strftime('%Y-%m-%dT%H:%M:%S'),
            'numAutorizacion': self.consulta.numero_autorizacion or '',
            'codConsulta': self.consulta.cups_principal,
            'modalidadGrupoServicioTecSal': rips_data['modalidad'],
            'grupoServicios': rips_data['grupo_servicios'],
            'codServicio': rips_data['cod_servicio'],
            'finalidadTecnologiaSalud': rips_data['finalidad'],
            'viaIngresoServicioSalud': rips_data['via_ingreso'],
            'causaMotivoAtencion': self.consulta.causa_atencion or '26',
            'codDiagnosticoPrincipal': self.consulta.diagnostico_principal,
            'codDiagnosticoRelacionado1': self.consulta.diagnostico_relacionado_1 or '',
            'codDiagnosticoRelacionado2': self.consulta.diagnostico_relacionado_2 or '',
            'codDiagnosticoRelacionado3': self.consulta.diagnostico_relacionado_3 or '',
            'tipoDiagnosticoPrincipal': self.consulta.tipo_diagnostico or '1',
            'tipoDocumentoIdentificacion': self.paciente.tipo_identificacion,
            'numDocumentoIdentificacion': self.paciente.numero_identificacion,
            'vrServicio': float(self.consulta.valor_consulta or 0),
            'conceptoRecaudo': self._concepto_recaudo(),
            'valorPagoModerador': float(self.consulta.valor_copago or 0),
            'numFEV': self.factura.numero_factus or '',
            'consecutivoFacturacion': 1,
        }]

    def _procedimientos(self) -> list:
        """Genera el bloque de procedimientos (código AP en RIPS)."""
        procs = []
        for proc in self.consulta.procedimientos.all():
            proc_data = self._get_proc_cups_rips_data(proc)
            procs.append({
                'codPrestador': self._codigo_prestador(),
                'fechaInicioAtencion': self.consulta.fecha_atencion.strftime('%Y-%m-%dT%H:%M:%S'),
                'idMIPRES': '',
                'numAutorizacion': self.consulta.numero_autorizacion or '',
                'ambito': proc_data['ambito'],
                'finalidadProcedimiento': proc_data['finalidad'],
                'personalAtiende': proc_data['personal_atiende'],
                'codProcedimiento': proc.cups,
                'viaDiagnosticaTerapeutica': proc.via_diagnostica or '1',
                'grupoProcedimiento': proc.grupo or '1',
                'codDiagnosticoPrincipal': self.consulta.diagnostico_principal,
                'codDiagnosticoRelacionado': self.consulta.diagnostico_relacionado_1 or '',
                'codComplicacion': '',
                'tipoDocumentoIdentificacion': self.paciente.tipo_identificacion,
                'numDocumentoIdentificacion': self.paciente.numero_identificacion,
                'vrServicio': float(proc.valor_facturar),
                'conceptoRecaudo': self._concepto_recaudo(),
                'valorPagoModerador': 0,
                'numFEV': self.factura.numero_factus or '',
                'consecutivoFacturacion': 1,
            })
        return procs

    def _medicamentos(self) -> list:
        """Genera el bloque de medicamentos (código AM en RIPS) si aplica."""
        if not hasattr(self.consulta, 'medicamentos'):
            return []
        meds = []
        for med in self.consulta.medicamentos.all():
            meds.append({
                'codPrestador': self._codigo_prestador(),
                'numDocumentoIdentificacion': self.paciente.numero_identificacion,
                'tipoDocumentoIdentificacion': self.paciente.tipo_identificacion,
                'fechaDispensAdministracion': med.fecha.strftime('%Y-%m-%dT%H:%M:%S'),
                'numAutorizacion': '',
                'idMIPRES': '',
                'tipoMedicamento': med.tipo or '1',
                'codTecnologiaSalud': med.cum or '',
                'nombreMedicamento': med.nombre,
                'concentracionMedicamento': str(med.concentracion or ''),
                'unidadMedida': med.unidad_medida or '',
                'formaFarmaceutica': med.forma_farmaceutica or '',
                'numUnidadMinDispensa': med.unidades,
                'vrUnitMedicamento': float(med.valor_unitario),
                'vrServicio': float(med.valor_total),
                'conceptoRecaudo': self._concepto_recaudo(),
                'valorPagoModerador': 0,
                'numFEV': self.factura.numero_factus or '',
                'consecutivoFacturacion': 1,
            })
        return meds

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _nit_prestador(self) -> str:
        """NIT del obligado a facturar — propio de cada consultorio (tenant)."""
        from django.db import connection
        from django.conf import settings
        tenant = getattr(connection, 'tenant', None)
        if tenant and getattr(tenant, 'nit', ''):
            # El NIT puede venir como '900123456-7'; RIPS usa solo el número
            return tenant.nit.split('-')[0].strip()
        return getattr(settings, 'NIT_PRESTADOR', '')

    def _codigo_prestador(self) -> str:
        """Código de habilitación del prestador — propio de cada consultorio."""
        from django.db import connection
        from django.conf import settings
        tenant = getattr(connection, 'tenant', None)
        if tenant and getattr(tenant, 'codigo_prestador', ''):
            return tenant.codigo_prestador
        return getattr(settings, 'CODIGO_PRESTADOR_RIPS', '')

    def _tipo_usuario(self) -> str:
        """Mapeo régimen → código RIPS."""
        mapeo = {
            'C': '1',  # Contributivo
            'S': '2',  # Subsidiado
            'V': '3',  # Vinculado/PPNA
            'P': '5',  # Particular
            'A': '6',  # ARL
            'T': '7',  # SOAT
            'O': '9',  # Otro
        }
        return mapeo.get(self.paciente.regimen, '5')

    def _concepto_recaudo(self) -> str:
        """Concepto de recaudo según régimen."""
        mapeo = {
            'C': '02',  # Cuota moderadora
            'S': '03',  # Copago subsidiado
            'P': '04',  # Pago voluntario particular
        }
        return mapeo.get(self.paciente.regimen, '04')

    # ── Validación ───────────────────────────────────────────────────────────

    def validar(self, rips: dict) -> list:
        """
        Validaciones básicas antes de enviar al MUV.
        Retorna lista de errores (vacía = OK).
        """
        errores = []

        if not rips.get('numDocumentoIdObligado'):
            errores.append('numDocumentoIdObligado es obligatorio')

        if not rips.get('numFactura'):
            errores.append('numFactura es obligatorio (CUFE de la FEV)')

        # Validar CUCON si hay convenio (Res. 948/2026)
        if self.convenio:
            cucon = rips.get('cucon', '')
            if not cucon or len(cucon) != 64:
                errores.append(f'CUCON inválido (debe ser SHA-256 de 64 caracteres). Valor: "{cucon}"')

        if not rips.get('usuarios'):
            errores.append('Debe existir al menos un usuario en RIPS')

        if not rips.get('consultas') and not rips.get('procedimientos'):
            errores.append('RIPS debe tener al menos consultas o procedimientos')

        for error in errores:
            logger.warning(f'[RIPS Validación] {error}')

        return errores

    def exportar_json(self, rips: dict) -> str:
        """Exporta el RIPS como string JSON con indentación."""
        return json.dumps(rips, ensure_ascii=False, indent=2, default=str)
