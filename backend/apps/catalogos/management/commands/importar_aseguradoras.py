"""
Pobla Aseguradoras con TODAS las entidades SGSSS Colombia (ADRES 2022).
Itera cada tenant activo. Upsert por código — seguro ejecutar varias veces.
"""
from django.core.management.base import BaseCommand
from django_tenants.utils import schema_context
from apps.tenants.models import Consultorio

# (codigo, nombre, tipo)  — lista completa del PDF ADRES 2022
ENTIDADES = [
    # ── 1. RÉGIMEN CONTRIBUTIVO ────────────────────────────────────────────
    ("CCFC07", "COMFAMILIAR CARTAGENA Y BOLÍVAR (CONTRIBUTIVO)", "EPS"),
    ("CCFC20", "CAJA DE COMPENSACIÓN FAMILIAR DEL CHOCÓ (CONTRIBUTIVO)", "EPS"),
    ("CCFC23", "COMFAGUAJIRA (CONTRIBUTIVO)", "EPS"),
    ("CCFC24", "COMFAMILIAR HUILA (CONTRIBUTIVO)", "EPS"),
    ("CCFC27", "CAJA DE COMPENSACIÓN FAMILIAR DE NARIÑO (CONTRIBUTIVO)", "EPS"),
    ("CCFC33", "CAJA DE COMPENSACIÓN FAMILIAR DE SUCRE (CONTRIBUTIVO)", "EPS"),
    ("CCFC50", "COMFAORIENTE (CONTRIBUTIVO)", "EPS"),
    ("CCFC53", "COMFACUNDI (CONTRIBUTIVO)", "EPS"),
    ("CCFC55", "CAJACOPI ATLÁNTICO (CONTRIBUTIVO)", "EPS"),
    ("EAS016", "EMPRESAS PÚBLICAS DE MEDELLÍN - DPTO. MÉDICO", "OTRO"),
    ("EAS027", "FONDO PASIVO SOCIAL FERROCARRILES NACIONALES", "OTRO"),
    ("EPS001", "ALIANSALUD EPS S.A.", "EPS"),
    ("EPS002", "SALUD TOTAL EPS S.A.", "EPS"),
    ("EPS005", "EPS SANITAS S.A.S.", "EPS"),
    ("EPS008", "COMPENSAR EPS", "EPS"),
    ("EPS010", "EPS SURAMERICANA S.A.", "EPS"),
    ("EPS012", "COMFENALCO VALLE DE LA GENTE EPS", "EPS"),
    ("EPS016", "COOMEVA EPS S.A.", "EPS"),
    ("EPS017", "EPS FAMISANAR S.A.S.", "EPS"),
    ("EPS018", "SERVICIO OCCIDENTAL DE SALUD S.O.S. S.A.S.", "EPS"),
    ("EPS037", "NUEVA EPS S.A.", "EPS"),
    ("EPS040", "SAVIA SALUD EPS (ALIANZA MEDELLÍN ANTIOQUIA)", "EPS"),
    ("EPS041", "NUEVA EPS S.A. (MOVILIDAD CONTRIBUTIVO)", "EPS"),
    ("EPS042", "COOSALUD EPS S.A.", "EPS"),
    ("EPS044", "MEDIMÁS EPS S.A.S.", "EPS"),
    ("EPS045", "MEDIMÁS EPS S.A.S. (MOVILIDAD)", "EPS"),
    ("EPS046", "FUNDACIÓN SALUD MÍA", "EPS"),
    ("EPS048", "MUTUAL SER EPS", "EPS"),
    ("EPSC22", "EPS CONVIDA (MOVILIDAD CONTRIBUTIVO)", "EPS"),
    ("EPSC25", "CAPRESOCA E.P.S. (MOVILIDAD CONTRIBUTIVO)", "EPS"),
    ("EPSC34", "CAPITAL SALUD EPS-S S.A.S. (MOVILIDAD CONTRIBUTIVO)", "EPS"),
    ("EPSIC1", "DUSAKAWI A.R.S.I. (CESAR Y GUAJIRA)", "EPS"),
    ("EPSIC3", "A.I.C. EPSI (ASOCIACIÓN INDÍGENA DEL CAUCA)", "EPS"),
    ("EPSIC4", "ANAS WAYUU EPSI", "EPS"),
    ("EPSIC5", "MALLAMAS EPSI", "EPS"),
    ("EPSIC6", "PIJAOS SALUD EPSI", "EPS"),
    ("ESSC07", "MUTUAL SER EPS (MOVILIDAD CONTRIBUTIVO)", "EPS"),
    ("ESSC18", "EMSSANAR S.A.S. (MOVILIDAD CONTRIBUTIVO)", "EPS"),
    ("ESSC24", "COOSALUD EPS S.A. (MOVILIDAD CONTRIBUTIVO)", "EPS"),
    ("ESSC33", "COMPARTA EPS-S (MOVILIDAD CONTRIBUTIVO)", "EPS"),
    ("ESSC62", "ASMET SALUD EPS S.A.S. (MOVILIDAD CONTRIBUTIVO)", "EPS"),
    ("ESSC76", "AMBUQ EPS-S BARRIOS UNIDOS DE QUIBDÓ (MOV.)", "EPS"),
    ("ESSC91", "ECOOPSOS EPS SAS (MOVILIDAD CONTRIBUTIVO)", "EPS"),
    # ── 2. RÉGIMEN SUBSIDIADO ──────────────────────────────────────────────
    ("CCF007", "COMFAMILIAR CARTAGENA Y BOLÍVAR (SUBSIDIADO)", "EPS"),
    ("CCF023", "COMFAGUAJIRA (SUBSIDIADO)", "EPS"),
    ("CCF024", "COMFAMILIAR HUILA (SUBSIDIADO)", "EPS"),
    ("CCF027", "CAJA DE COMPENSACIÓN FAMILIAR DE NARIÑO (SUBSIDIADO)", "EPS"),
    ("CCF033", "CAJA DE COMPENSACIÓN FAMILIAR DE SUCRE (SUBSIDIADO)", "EPS"),
    ("CCF050", "COMFAORIENTE (SUBSIDIADO)", "EPS"),
    ("CCF053", "COMFACUNDI (SUBSIDIADO)", "EPS"),
    ("CCF055", "CAJACOPI ATLÁNTICO (SUBSIDIADO)", "EPS"),
    ("CCF102", "CAJA DE COMPENSACIÓN FAMILIAR DEL CHOCÓ (SUBSIDIADO)", "EPS"),
    ("EPS022", "EPS CONVIDA (SUBSIDIADO)", "EPS"),
    ("EPS025", "CAPRESOCA E.P.S. (SUBSIDIADO)", "EPS"),
    ("EPSI01", "DUSAKAWI A.R.S.I. (SUBSIDIADO)", "EPS"),
    ("EPSI03", "A.I.C. EPSI (SUBSIDIADO)", "EPS"),
    ("EPSI04", "ANAS WAYUU EPSI (SUBSIDIADO)", "EPS"),
    ("EPSI05", "MALLAMAS EPSI (SUBSIDIADO)", "EPS"),
    ("EPSI06", "PIJAOS SALUD EPSI (SUBSIDIADO)", "EPS"),
    ("EPSS01", "ALIANSALUD EPS S.A. (MOV. SUBSIDIADO)", "EPS"),
    ("EPSS02", "SALUD TOTAL EPS S.A. (MOV. SUBSIDIADO)", "EPS"),
    ("EPSS05", "EPS SANITAS S.A.S. (MOV. SUBSIDIADO)", "EPS"),
    ("EPSS08", "COMPENSAR EPS (MOV. SUBSIDIADO)", "EPS"),
    ("EPSS10", "EPS SURAMERICANA S.A. (MOV. SUBSIDIADO)", "EPS"),
    ("EPSS12", "COMFENALCO VALLE EPS (MOV. SUBSIDIADO)", "EPS"),
    ("EPSS16", "COOMEVA EPS S.A. (MOV. SUBSIDIADO)", "EPS"),
    ("EPSS17", "EPS FAMISANAR S.A.S. (MOV. SUBSIDIADO)", "EPS"),
    ("EPSS18", "S.O.S. EPS (MOV. SUBSIDIADO)", "EPS"),
    ("EPSS34", "CAPITAL SALUD EPS-S S.A.S.", "EPS"),
    ("EPSS37", "NUEVA EPS S.A. (MOV. SUBSIDIADO)", "EPS"),
    ("EPSS40", "SAVIA SALUD EPS (SUBSIDIADO)", "EPS"),
    ("EPSS41", "NUEVA EPS S.A. (SUBSIDIADO)", "EPS"),
    ("EPSS42", "COOSALUD EPS S.A. (MOV. SUBSIDIADO)", "EPS"),
    ("EPSS44", "MEDIMÁS EPS S.A.S. (MOV. SUBSIDIADO)", "EPS"),
    ("EPSS45", "MEDIMÁS EPS S.A.S. (SUBSIDIADO)", "EPS"),
    ("EPSS46", "FUNDACIÓN SALUD MÍA (MOV. SUBSIDIADO)", "EPS"),
    ("EPSS48", "MUTUAL SER EPS (MOV. SUBSIDIADO)", "EPS"),
    ("ESS024", "COOSALUD EPS S.A. (SUBSIDIADO)", "EPS"),
    ("ESS062", "ASMET SALUD EPS S.A.S.", "EPS"),
    ("ESS076", "AMBUQ EPS-S BARRIOS UNIDOS DE QUIBDÓ", "EPS"),
    ("ESS091", "ECOOPSOS EPS SAS", "EPS"),
    ("ESS118", "EMSSANAR S.A.S.", "EPS"),
    ("ESS133", "COMPARTA EPS-S", "EPS"),
    ("ESS207", "MUTUAL SER EPS (SUBSIDIADO)", "EPS"),
    # ── 3. REGÍMENES DE EXCEPCIÓN Y ESPECIAL ──────────────────────────────
    ("FMS001", "FUERZAS MILITARES DE COLOMBIA", "OTRO"),
    ("POL001", "POLICÍA NACIONAL", "OTRO"),
    ("RES002", "ECOPETROL (RÉGIMEN ESPECIAL)", "OTRO"),
    ("RES004", "MAGISTERIO - FOMAG", "OTRO"),
    ("RES005", "UNIVERSIDAD DEL ATLÁNTICO", "OTRO"),
    ("RES006", "UNIVERSIDAD INDUSTRIAL DE SANTANDER (UIS)", "OTRO"),
    ("RES007", "UNIVERSIDAD DEL VALLE", "OTRO"),
    ("RES008", "UNIVERSIDAD NACIONAL DE COLOMBIA", "OTRO"),
    ("RES009", "UNIVERSIDAD DEL CAUCA", "OTRO"),
    ("RES010", "UNIVERSIDAD DE CARTAGENA", "OTRO"),
    ("RES011", "UNIVERSIDAD DE ANTIOQUIA", "OTRO"),
    ("RES012", "UNIVERSIDAD DE CÓRDOBA", "OTRO"),
    ("RES013", "UNIVERSIDAD DE NARIÑO", "OTRO"),
    ("RES014", "UPTC (UNIV. PEDAGÓGICA Y TECNOLÓGICA DE COLOMBIA)", "OTRO"),
    # ── 4. PLANES COMPLEMENTARIOS / MEDICINA PREPAGADA ────────────────────
    ("EMP002", "MEDPLUS MEDICINA PREPAGADA S.A.", "PREPAGADA"),
    ("EMP012", "HUMANA GOLDEN CROSS S.A. MEDICINA PREPAGADA", "PREPAGADA"),
    ("EMP014", "MEDISALUD MEDICINA PREPAGADA S.A. (EN LIQUIDACIÓN)", "PREPAGADA"),
    ("EMP015", "MEDISANITAS S.A. COMPAÑÍA DE MEDICINA PREPAGADA", "PREPAGADA"),
    ("EMP017", "COLMÉDICA MEDICINA PREPAGADA", "PREPAGADA"),
    ("EMP021", "EPS Y MEDICINA PREPAGADA SURAMERICANA S.A.", "PREPAGADA"),
    ("EMP022", "VIVIR S.A. MEDICINA PREPAGADA", "PREPAGADA"),
    ("EMP023", "COLSANITAS S.A. COMPAÑÍA DE MEDICINA PREPAGADA", "PREPAGADA"),
    ("EMP024", "SERVICIO DE SALUD INMEDIATO MEDICINA PREPAGADA S.A.", "PREPAGADA"),
    ("EMP025", "PLAN U.H.C.M. MEDICINA PREPAGADA COMFENALCO VALLE", "PREPAGADA"),
    ("EMP028", "COOMEVA MEDICINA PREPAGADA S.A.", "PREPAGADA"),
    ("EMP029", "COLPATRIA MEDICINA PREPAGADA S.A.", "PREPAGADA"),
    ("EPS023", "CRUZ BLANCA EPS", "EPS"),
    # ── 5. SERVICIOS DE AMBULANCIA PREPAGADA ──────────────────────────────
    ("SAP008", "EMERGENCIA MÉDICA INTEGRAL COLOMBIA S.A.", "PREPAGADA"),
    ("SAP026", "EMERMEDICA S.A. SERVICIOS DE AMBULANCIA PREPAGADOS", "PREPAGADA"),
    ("SAP030", "EMPRESA DE MEDICINA INTEGRAL EMI S.A. (AMBULANCIA)", "PREPAGADA"),
    ("SAP031", "ASISTENCIA MÉDICA INMEDIATA S.A. (AMBULANCIA PREPAGADA)", "PREPAGADA"),
    ("SAP032", "SERVICIO DE EMERGENCIAS REGIONAL S.A. (AMBULANCIA)", "PREPAGADA"),
    ("SAP033", "COOMEVA EMERGENCIAS MÉDICAS", "PREPAGADA"),
    ("SAP034", "ASISTENCIA MÉDICA SAS (AMBULANCIA PREPAGADA)", "PREPAGADA"),
    ("SAP035", "SERVICIO DE ASISTENCIA MÉDICA INMEDIATA S.A. (SAP)", "PREPAGADA"),
    ("SAP036", "TRASMEDICA S.A. SAP (EN LIQUIDACIÓN)", "PREPAGADA"),
    ("SAP037", "SEMI SAP S.A.S. SERVICIOS MÉDICOS INTEGRALES", "PREPAGADA"),
    ("SAP038", "RED MÉDICA VITAL S.A.S. (AMBULANCIA PREPAGADA)", "PREPAGADA"),
]


def _cargar_en_schema(schema_name, stdout, style):
    from apps.pacientes.models import Aseguradora
    creadas = actualizadas = errores = 0
    for codigo, nombre, tipo in ENTIDADES:
        nit = f"ADRES-{codigo}"
        try:
            _, created = Aseguradora.objects.update_or_create(
                codigo=codigo,
                defaults={"nombre": nombre, "tipo": tipo, "nit": nit, "activa": True},
            )
            if created:
                creadas += 1
            else:
                actualizadas += 1
        except Exception as e:
            errores += 1
            stdout.write(style.WARNING(f"  ⚠ {codigo} — {e}"))
    stdout.write(style.SUCCESS(
        f"  [{schema_name}] {creadas} creadas · {actualizadas} actualizadas"
        + (f" · {errores} errores" if errores else "")
    ))


class Command(BaseCommand):
    help = "Importa todas las aseguradoras SGSSS Colombia (ADRES 2022) en cada tenant"

    def handle(self, *args, **options):
        self.stdout.write(f"Total entidades a importar: {len(ENTIDADES)}")
        tenants = Consultorio.objects.exclude(schema_name='public')
        if not tenants.exists():
            self.stdout.write(self.style.WARNING("Sin tenants — nada que hacer"))
            return
        for tenant in tenants:
            self.stdout.write(f"→ {tenant.schema_name} ({tenant.name if hasattr(tenant, 'name') else ''})")
            with schema_context(tenant.schema_name):
                _cargar_en_schema(tenant.schema_name, self.stdout, self.style)
        self.stdout.write(self.style.SUCCESS("✓ Importación completada"))
