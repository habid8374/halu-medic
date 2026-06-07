"""
Pobla la tabla de Aseguradoras con las entidades oficiales del SGSSS Colombia
(fuente: ADRES 2022). Se pueden ejecutar múltiples veces (upsert por código).
Itera todos los tenants activos para cargar en cada schema.
"""
from django.core.management.base import BaseCommand
from django_tenants.utils import schema_context
from apps.tenants.models import Consultorio

# (codigo_adres, nombre, tipo)
ENTIDADES = [
    # ── Régimen Contributivo ────────────────────────────────────────────
    ("EPS001", "ALIANSALUD EPS S.A.", "EPS"),
    ("EPS002", "SALUD TOTAL EPS S.A.", "EPS"),
    ("EPS005", "EPS SANITAS S.A.S.", "EPS"),
    ("EPS008", "COMPENSAR EPS", "EPS"),
    ("EPS010", "EPS SURAMERICANA S.A.", "EPS"),
    ("EPS012", "COMFENALCO VALLE EPS", "EPS"),
    ("EPS016", "COOMEVA EPS S.A.", "EPS"),
    ("EPS017", "EPS FAMISANAR S.A.S.", "EPS"),
    ("EPS018", "SERVICIO OCCIDENTAL DE SALUD S.A.S. (S.O.S.)", "EPS"),
    ("EPS037", "NUEVA EPS S.A.", "EPS"),
    ("EPS040", "SAVIA SALUD EPS (ALIANZA MEDELLÍN ANTIOQUIA)", "EPS"),
    ("EPS042", "COOSALUD EPS S.A.", "EPS"),
    ("EPS044", "MEDIMÁS EPS S.A.S.", "EPS"),
    ("EPS046", "FUNDACIÓN SALUD MIA", "EPS"),
    ("EPS048", "MUTUAL SER EPS", "EPS"),
    # ── Régimen Subsidiado ──────────────────────────────────────────────
    ("EPS022", "EPS CONVIDA (RÉGIMEN SUBSIDIADO)", "EPS"),
    ("EPS025", "CAPRESOCA E.P.S.", "EPS"),
    ("EPSS34", "CAPITAL SALUD EPS-S S.A.S.", "EPS"),
    ("EPSS41", "NUEVA EPS S.A. (SUBSIDIADO)", "EPS"),
    ("EPSS45", "MEDIMÁS EPS S.A.S. (SUBSIDIADO)", "EPS"),
    ("ESS024", "COOSALUD EPS S.A. (SUBSIDIADO)", "EPS"),
    ("ESS062", "ASMET SALUD EPS S.A.S.", "EPS"),
    ("ESS091", "ECOOPSOS EPS SAS", "EPS"),
    ("ESS118", "EMSSANAR S.A.S.", "EPS"),
    ("ESS133", "COMPARTA EPS-S", "EPS"),
    ("ESS207", "MUTUAL SER EPS (SUBSIDIADO)", "EPS"),
    ("ESS076", "AMBUQ EPS-S (BARRIOS UNIDOS DE QUIBDÓ)", "EPS"),
    # ── EPS Indígenas ───────────────────────────────────────────────────
    ("EPSI01", "DUSAKAWI A.R.S.I. (CESAR Y GUAJIRA)", "EPS"),
    ("EPSI03", "A.I.C. EPSI (ASOCIACIÓN INDÍGENA DEL CAUCA)", "EPS"),
    ("EPSI04", "ANAS WAYUU EPSI", "EPS"),
    ("EPSI05", "MALLAMAS EPSI", "EPS"),
    ("EPSI06", "PIJAOS SALUD EPSI", "EPS"),
    # ── Cajas de Compensación (subsidiado) ─────────────────────────────
    ("CCF007", "COMFAMILIAR CARTAGENA Y BOLÍVAR", "EPS"),
    ("CCF023", "COMFAGUAJIRA", "EPS"),
    ("CCF024", "COMFAMILIAR HUILA", "EPS"),
    ("CCF027", "CAJA DE COMPENSACIÓN FAMILIAR DE NARIÑO", "EPS"),
    ("CCF033", "COMFASUCRE", "EPS"),
    ("CCF050", "COMFAORIENTE", "EPS"),
    ("CCF053", "COMFACUNDI", "EPS"),
    ("CCF055", "CAJACOPI ATLÁNTICO", "EPS"),
    ("CCF102", "CAJA DE COMPENSACIÓN FAMILIAR DEL CHOCÓ", "EPS"),
    # ── Regímenes especiales / excepción ───────────────────────────────
    ("FMS001", "FUERZAS MILITARES DE COLOMBIA", "OTRO"),
    ("POL001", "POLICÍA NACIONAL", "OTRO"),
    ("RES002", "ECOPETROL (RÉGIMEN ESPECIAL)", "OTRO"),
    ("RES004", "MAGISTERIO (FOMAG)", "OTRO"),
    ("RES005", "UNIVERSIDAD DEL ATLÁNTICO", "OTRO"),
    ("RES006", "UNIVERSIDAD INDUSTRIAL DE SANTANDER (UIS)", "OTRO"),
    ("RES007", "UNIVERSIDAD DEL VALLE", "OTRO"),
    ("RES008", "UNIVERSIDAD NACIONAL DE COLOMBIA", "OTRO"),
    ("RES009", "UNIVERSIDAD DEL CAUCA", "OTRO"),
    ("RES010", "UNIVERSIDAD DE CARTAGENA", "OTRO"),
    ("RES011", "UNIVERSIDAD DE ANTIOQUIA", "OTRO"),
    ("RES012", "UNIVERSIDAD DE CÓRDOBA", "OTRO"),
    ("RES013", "UNIVERSIDAD DE NARIÑO", "OTRO"),
    ("RES014", "UPTC (UNIVERSIDAD PEDAGÓGICA Y TECNOLÓGICA)", "OTRO"),
    # ── Medicina Prepagada ──────────────────────────────────────────────
    ("EMP002", "MEDPLUS MEDICINA PREPAGADA S.A.", "PREPAGADA"),
    ("EMP012", "HUMANA GOLDEN CROSS S.A.", "PREPAGADA"),
    ("EMP015", "MEDISANITAS S.A. COMPAÑÍA DE MEDICINA PREPAGADA", "PREPAGADA"),
    ("EMP017", "COLMÉDICA MEDICINA PREPAGADA", "PREPAGADA"),
    ("EMP021", "EPS Y MEDICINA PREPAGADA SURAMERICANA S.A.", "PREPAGADA"),
    ("EMP022", "VIVIR S.A. MEDICINA PREPAGADA", "PREPAGADA"),
    ("EMP023", "COLSANITAS S.A. MEDICINA PREPAGADA", "PREPAGADA"),
    ("EMP024", "SERVICIO DE SALUD INMEDIATO MEDICINA PREPAGADA", "PREPAGADA"),
    ("EMP025", "PLAN UHCM MEDICINA PREPAGADA COMFENALCO VALLE", "PREPAGADA"),
    ("EMP028", "COOMEVA MEDICINA PREPAGADA S.A.", "PREPAGADA"),
    ("EMP029", "COLPATRIA MEDICINA PREPAGADA S.A.", "PREPAGADA"),
    # ── Servicios de ambulancia prepagada ──────────────────────────────
    ("SAP008", "EMERGENCIA MÉDICA INTEGRAL COLOMBIA S.A.", "PREPAGADA"),
    ("SAP026", "EMERMEDICA S.A.", "PREPAGADA"),
    ("SAP030", "EMPRESA DE MEDICINA INTEGRAL EMI S.A.", "PREPAGADA"),
    ("SAP031", "ASISTENCIA MÉDICA INMEDIATA (AMBULANCIA PREPAGADA)", "PREPAGADA"),
    ("SAP033", "COOMEVA EMERGENCIAS MÉDICAS", "PREPAGADA"),
    ("SAP034", "ASISTENCIA MÉDICA SAS (AMBULANCIA PREPAGADA)", "PREPAGADA"),
    ("SAP038", "RED MÉDICA VITAL S.A.S.", "PREPAGADA"),
    # ── Entidades EAS / Especiales ──────────────────────────────────────
    ("EAS016", "EMPRESAS PÚBLICAS DE MEDELLÍN - DEPARTAMENTO MÉDICO", "OTRO"),
    ("EAS027", "FONDO PASIVO SOCIAL FERROCARRILES NACIONALES", "OTRO"),
]


class Command(BaseCommand):
    help = "Importa aseguradoras SGSSS Colombia (fuente: ADRES 2022) en todos los tenants"

    def handle(self, *args, **options):
        tenants = Consultorio.objects.exclude(schema_name='public')
        if not tenants.exists():
            self.stdout.write(self.style.WARNING("Sin tenants — nada que hacer"))
            return

        for tenant in tenants:
            self.stdout.write(f"→ Schema: {tenant.schema_name}")
            creadas = actualizadas = 0
            with schema_context(tenant.schema_name):
                from apps.pacientes.models import Aseguradora
                for codigo, nombre, tipo in ENTIDADES:
                    nit_provisional = f"ADRES-{codigo}"
                    _, created = Aseguradora.objects.update_or_create(
                        codigo=codigo,
                        defaults={
                            "nombre": nombre,
                            "tipo": tipo,
                            "nit": nit_provisional,
                            "activa": True,
                        },
                    )
                    if created:
                        creadas += 1
                    else:
                        actualizadas += 1
            self.stdout.write(self.style.SUCCESS(
                f"  {tenant.schema_name}: {creadas} creadas, {actualizadas} actualizadas"
            ))
