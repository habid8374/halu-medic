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
    CodigoCUPSViewSet,
    CodigoCIE10ViewSet,
    OrdenMedicaViewSet,
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
]
