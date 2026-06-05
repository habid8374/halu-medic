"""
RIPS PGP/Capitado — Resolución 948/2026

Reglas PGP en RIPS:
  - usuarios[] → array VACÍO (no se enumeran pacientes individuales)
  - cucon      → OBLIGATORIO en la raíz (SHA-256 64 chars del contrato)
  - tipoNota   → null (PGP no genera notas crédito/débito en RIPS)
  - Todos los valores monetarios van en 0 (el valor global va en la FEV, no en RIPS)
"""
import json
from django.db import connection
from django.conf import settings


class GeneradorRIPSPGP:

    def __init__(self, factura_pgp):
        self.factura  = factura_pgp
        self.convenio = factura_pgp.convenio

    def generar(self) -> dict:
        return {
            'numDocumentoIdObligado': self._nit_prestador(),
            'numFactura':             self.factura.numero_factus or '',
            'tipoNota':               None,
            'numNota':                None,
            'cucon':                  getattr(self.convenio, 'cucon', '') or '',
            'usuarios':               [],   # vacío por definición PGP/capitado
        }

    def _nit_prestador(self) -> str:
        tenant = getattr(connection, 'tenant', None)
        if tenant and getattr(tenant, 'nit', ''):
            return tenant.nit.split('-')[0].strip()
        return getattr(settings, 'NIT_PRESTADOR', '')

    def exportar_json(self) -> str:
        return json.dumps(self.generar(), ensure_ascii=False, indent=2)
