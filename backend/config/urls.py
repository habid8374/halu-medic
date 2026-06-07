"""
URLs del tenant (cada consultorio)
Todas las rutas /api/* viven en el schema del tenant
"""
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from apps.catalogos import views as views_catalogos


def health(request):
    return JsonResponse({'status': 'ok'})
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from config.api import (
    PacienteViewSet,
    CitaViewSet,
    ConsultaViewSet,
    FacturaViewSet,
    FacturaPGPViewSet,
    CodigoCUPSViewSet,
    CodigoCIE10ViewSet,
    OrdenMedicaViewSet,
    AseguradoraViewSet,
    ConvenioEPSViewSet,
    IngresoViewSet,
    EgresoViewSet,
    HistoriaClinicaViewSet,
    CatalogoMedicamentoViewSet,
    MedicamentoHCViewSet,
    OrdenHCViewSet,
    TarifaMedicamentoViewSet,
    ReportesView,
    # Módulo Salud
    EspecialidadViewSet,
    NotaMedicaViewSet,
    ProgramacionCxViewSet,
    DescripcionQuirurgicaViewSet,
    AyudaDiagnosticaViewSet,
    # Prefactura
    PrefacturaViewSet,
    ItemPrefacturaViewSet,
    # Nota de Ajuste RIPS
    NotaAjusteRIPSViewSet,
    # Nota Crédito / Débito
    NotaDocumentoViewSet,
    # Nuevos módulos clínicos
    TriageViewSet,
    ListaVerificacionQxViewSet,
    RegistroAnestesiaViewSet,
    ConsentimientoViewSet,
    NotaEnfermeriaViewSet,
    # Referencia / Rehabilitación / Odontología / Telemedicina / UCI / Sangre
    ReferenciaPacienteViewSet,
    PlanRehabilitacionViewSet,
    SesionRehabilitacionViewSet,
    HistoriaOdontologicaViewSet,
    ProcedimientoOdontologicoViewSet,
    SesionTelemedicinaSViewSet,
    CamaUCIViewSet,
    AdmisionUCIViewSet,
    MonitoreoUCIViewSet,
    UnidadHemoderivadoViewSet,
    SolicitudHemoderivadoViewSet,
    # Farmacia
    MedicamentoFarmaciaViewSet,
    LoteInventarioViewSet,
    DispensacionMedicamentoViewSet,
    # Laboratorio
    SolicitudLaboratorioViewSet,
    ResultadoLaboratorioViewSet,
)
from config.api import dashboard_stats
from config.api import (
    # Phase 5
    CargoViewSet,
    ContratoEmpleadoViewSet,
    TurnoViewSet,
    LiquidacionNominaViewSet,
    IncapacidadViewSet,
    EquipoEsterilizableViewSet,
    CicloEsterilizacionViewSet,
    EquipoBiomedicoViewSet,
    OrdenMantenimientoViewSet,
    DietaTerapeuticaViewSet,
    NotificacionSIVIGILAViewSet,
    BrotEpidemicoViewSet,
    CuentaContableViewSet,
    AsientoContableViewSet,
    PresupuestoAnualViewSet,
    NotificacionViewSet,
)
from apps.tarifas.api import ManualTarifarioViewSet
from apps.usuarios.auth import (
    LoginView,
    LogoutView,
    MiPerfilView,
    RecuperarPasswordView,
    ConfirmarPasswordView,
    UsuarioViewSet,
)
from apps.facturacion.webhook import FactusWebhookView
from apps.tenants.api import ConfiguracionConsultorioView
from apps.suscripciones.api import SuscripcionViewSet

router = DefaultRouter()
router.register(r'pacientes',             PacienteViewSet,  basename='paciente')
router.register(r'citas',                 CitaViewSet,      basename='cita')
router.register(r'consultas',             ConsultaViewSet,  basename='consulta')
router.register(r'facturacion/facturas',  FacturaViewSet,   basename='factura')
router.register(r'usuarios',              UsuarioViewSet,   basename='usuario')
router.register(r'cups',                  CodigoCUPSViewSet,  basename='cups')
router.register(r'cie10',                 CodigoCIE10ViewSet, basename='cie10')
router.register(r'tarifas',              ManualTarifarioViewSet, basename='tarifa')
router.register(r'ordenes-medicas',      OrdenMedicaViewSet,     basename='orden-medica')
router.register(r'admin/suscripciones', SuscripcionViewSet,     basename='suscripcion')
router.register(r'aseguradoras',        AseguradoraViewSet,     basename='aseguradora')
router.register(r'convenios-eps',       ConvenioEPSViewSet,     basename='convenio-eps')
router.register(r'facturacion/pgp',     FacturaPGPViewSet,      basename='factura-pgp')
router.register(r'historia/ingresos',      IngresoViewSet,              basename='ingreso')
router.register(r'historia/egresos',       EgresoViewSet,               basename='egreso')
router.register(r'historia/registros',     HistoriaClinicaViewSet,      basename='historia')
router.register(r'historia/medicamentos',  MedicamentoHCViewSet,        basename='medicamento-hc')
router.register(r'historia/ordenes',       OrdenHCViewSet,              basename='orden-hc')
router.register(r'catalogos/medicamentos', CatalogoMedicamentoViewSet,  basename='catalogo-medicamento')
router.register(r'tarifas/medicamentos',   TarifaMedicamentoViewSet,    basename='tarifa-medicamento')
# ── Módulo Salud ──────────────────────────────────────────────────────────────
router.register(r'catalogos/especialidades', EspecialidadViewSet,          basename='especialidad')
router.register(r'salud/notas',              NotaMedicaViewSet,            basename='nota-medica')
router.register(r'salud/cx',                 ProgramacionCxViewSet,        basename='programacion-cx')
router.register(r'salud/descripcion-qx',     DescripcionQuirurgicaViewSet, basename='descripcion-qx')
router.register(r'salud/ayudas',             AyudaDiagnosticaViewSet,      basename='ayuda-diagnostica')
router.register(r'facturacion/prefacturas',  PrefacturaViewSet,            basename='prefactura')
router.register(r'facturacion/items',        ItemPrefacturaViewSet,        basename='item-prefactura')
router.register(r'rips/notas-ajuste',        NotaAjusteRIPSViewSet,        basename='nota-ajuste-rips')
router.register(r'facturacion/notas',        NotaDocumentoViewSet,         basename='nota-documento')
# ── Módulos clínicos extendidos ───────────────────────────────────────────────
router.register(r'salud/triage',             TriageViewSet,                basename='triage')
router.register(r'salud/verificacion-qx',    ListaVerificacionQxViewSet,   basename='verificacion-qx')
router.register(r'salud/anestesia',          RegistroAnestesiaViewSet,     basename='anestesia')
router.register(r'salud/consentimientos',    ConsentimientoViewSet,        basename='consentimiento')
router.register(r'salud/enfermeria',         NotaEnfermeriaViewSet,        basename='nota-enfermeria')
# ── Referencia / Contrareferencia ─────────────────────────────────────────────
router.register(r'salud/referencias',                ReferenciaPacienteViewSet,       basename='referencia-paciente')
router.register(r'salud/rehabilitacion/planes',      PlanRehabilitacionViewSet,        basename='plan-rehabilitacion')
router.register(r'salud/rehabilitacion/sesiones',    SesionRehabilitacionViewSet,      basename='sesion-rehabilitacion')
router.register(r'salud/odontologia/historias',      HistoriaOdontologicaViewSet,      basename='historia-odontologica')
router.register(r'salud/odontologia/procedimientos', ProcedimientoOdontologicoViewSet, basename='procedimiento-odontologico')
router.register(r'salud/telemedicina',               SesionTelemedicinaSViewSet,       basename='sesion-telemedicina')
router.register(r'salud/uci/camas',                  CamaUCIViewSet,                   basename='cama-uci')
router.register(r'salud/uci/admisiones',             AdmisionUCIViewSet,               basename='admision-uci')
router.register(r'salud/uci/monitoreo',              MonitoreoUCIViewSet,              basename='monitoreo-uci')
router.register(r'salud/banco-sangre/unidades',      UnidadHemoderivadoViewSet,        basename='unidad-hemoderivado')
router.register(r'salud/banco-sangre/solicitudes',   SolicitudHemoderivadoViewSet,     basename='solicitud-hemoderivado')
# ── Farmacia ──────────────────────────────────────────────────────────────────
router.register(r'farmacia/medicamentos',            MedicamentoFarmaciaViewSet,       basename='medicamento-farmacia')
router.register(r'farmacia/lotes',                   LoteInventarioViewSet,            basename='lote-inventario')
router.register(r'farmacia/dispensaciones',          DispensacionMedicamentoViewSet,   basename='dispensacion-medicamento')
# ── Laboratorio ───────────────────────────────────────────────────────────────
router.register(r'laboratorio/solicitudes',          SolicitudLaboratorioViewSet,      basename='solicitud-laboratorio')
router.register(r'laboratorio/resultados',           ResultadoLaboratorioViewSet,      basename='resultado-laboratorio')
# ── RRHH ──────────────────────────────────────────────────────────────────────
router.register(r'rrhh/cargos',                      CargoViewSet,                     basename='cargo')
router.register(r'rrhh/contratos',                   ContratoEmpleadoViewSet,          basename='contrato')
router.register(r'rrhh/turnos',                      TurnoViewSet,                     basename='turno')
router.register(r'rrhh/nomina',                      LiquidacionNominaViewSet,         basename='liquidacion-nomina')
router.register(r'rrhh/incapacidades',               IncapacidadViewSet,               basename='incapacidad')
# ── Esterilización ────────────────────────────────────────────────────────────
router.register(r'operaciones/equipos-esterilizables', EquipoEsterilizableViewSet,     basename='equipo-esterilizable')
router.register(r'operaciones/ciclos-esterilizacion',  CicloEsterilizacionViewSet,     basename='ciclo-esterilizacion')
# ── Mantenimiento Biomédico ───────────────────────────────────────────────────
router.register(r'operaciones/equipos-biomedicos',   EquipoBiomedicoViewSet,           basename='equipo-biomedico')
router.register(r'operaciones/mantenimiento',        OrdenMantenimientoViewSet,        basename='orden-mantenimiento')
# ── Nutrición ─────────────────────────────────────────────────────────────────
router.register(r'operaciones/dietas',               DietaTerapeuticaViewSet,          basename='dieta')
# ── Epidemiología ─────────────────────────────────────────────────────────────
router.register(r'epidemiologia/notificaciones',     NotificacionSIVIGILAViewSet,      basename='notificacion-sivigila')
router.register(r'epidemiologia/brotes',             BrotEpidemicoViewSet,             basename='brote-epidemico')
# ── Contabilidad ──────────────────────────────────────────────────────────────
router.register(r'contabilidad/cuentas',             CuentaContableViewSet,            basename='cuenta-contable')
router.register(r'contabilidad/asientos',            AsientoContableViewSet,           basename='asiento-contable')
router.register(r'contabilidad/presupuestos',        PresupuestoAnualViewSet,          basename='presupuesto-anual')
router.register(r'notificaciones',                   NotificacionViewSet,              basename='notificacion')

urlpatterns = [
    path('api/health/', health, name='health'),
    path('admin/', admin.site.urls),

    # ── Auth ──────────────────────────────────────────────────────────────────
    path('api/auth/login/',                LoginView.as_view(),            name='login'),
    path('api/auth/refresh/',              TokenRefreshView.as_view(),     name='token_refresh'),
    path('api/auth/logout/',               LogoutView.as_view(),           name='logout'),
    path('api/auth/me/',                   MiPerfilView.as_view(),         name='me'),
    path('api/auth/recuperar-password/',   RecuperarPasswordView.as_view(), name='recuperar_password'),
    path('api/auth/confirmar-password/',   ConfirmarPasswordView.as_view(), name='confirmar_password'),

    # ── Configuración del consultorio (incluye credenciales Factus) ───────────
    path('api/consultorio/configuracion/', ConfiguracionConsultorioView.as_view(), name='config_consultorio'),

    # ── Webhook Factus (sin autenticación JWT) ────────────────────────────────
    path('api/facturacion/webhook/factus/', FactusWebhookView.as_view(), name='webhook_factus'),

    # ── API REST ──────────────────────────────────────────────────────────────
    path('api/', include(router.urls)),

    # ── FHIR R4 ──────────────────────────────────────────────────────────────
    path('api/fhir/r4/', include('apps.fhir.urls')),

    # ── CUPS RIPS plantilla / importación ────────────────────────────────────
    path('api/cups/plantilla/',     views_catalogos.plantilla_cups_rips, name='cups-plantilla'),
    path('api/cups/importar-rips/', views_catalogos.importar_cups_rips,  name='cups-importar-rips'),

    # ── Reportes ──────────────────────────────────────────────────────────────
    path('api/reportes/', ReportesView.as_view(), name='reportes'),

    # ── Dashboard stats ───────────────────────────────────────────────────────
    path('api/dashboard/stats/', dashboard_stats, name='dashboard_stats'),
]
