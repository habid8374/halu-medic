"""
RIPS PGP/Capitado — Resolución 948/2026
En el modelo PGP los valores monetarios van en 0.
El RIPS identifica el contrato pero no enumera pacientes individuales.
"""
import json
from django.db import connection
from django.conf import settings


class GeneradorRIPSPGP:
    def __init__(self, factura_pgp):
        self.factura = factura_pgp
        self.convenio = factura_pgp.convenio

    def generar(self) -> dict:
        return {
            "numDocumentoIdObligado": self._nit_prestador(),
            "numFactura": self.factura.numero_factus or "",
            "tipoNota": None,
            "numNota": None,
            "cucon": getattr(self.convenio, 'cucon', '') or "",
            "usuarios": [],
        }

    def _nit_prestador(self) -> str:
        tenant = getattr(connection, 'tenant', None)
        if tenant and getattr(tenant, 'nit', ''):
            return tenant.nit
        return getattr(settings, 'NIT_PRESTADOR', '')

    def exportar_json(self) -> str:
        return json.dumps(self.generar(), ensure_ascii=False, indent=2)
