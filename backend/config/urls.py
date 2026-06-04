"""
URLs del tenant (cada consultorio)
Todas las rutas /api/* viven en el schema del tenant
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from backend.config.api import (
    PacienteViewSet,
    CitaViewSet,
    ConsultaViewSet,
    FacturaViewSet,
)
from apps.usuarios.auth import (
    LoginView,
    LogoutView,
    MiPerfilView,
    UsuarioViewSet,
)

router = DefaultRouter()
router.register(r'pacientes',             PacienteViewSet,  basename='paciente')
router.register(r'citas',                 CitaViewSet,      basename='cita')
router.register(r'consultas',             ConsultaViewSet,  basename='consulta')
router.register(r'facturacion/facturas',  FacturaViewSet,   basename='factura')
router.register(r'usuarios',              UsuarioViewSet,   basename='usuario')

urlpatterns = [
    path('admin/', admin.site.urls),

    # ── Auth ──────────────────────────────────────────────────────────────────
    path('api/auth/login/',   LoginView.as_view(),    name='login'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/logout/',  LogoutView.as_view(),   name='logout'),
    path('api/auth/me/',      MiPerfilView.as_view(), name='me'),

    # ── API REST ──────────────────────────────────────────────────────────────
    path('api/', include(router.urls)),
]
