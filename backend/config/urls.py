"""
URLs del tenant (cada consultorio)
Todas las rutas /api/* viven en el schema del tenant
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from backend.config.api import (
    PacienteViewSet,
    CitaViewSet,
    ConsultaViewSet,
    FacturaViewSet,
)

router = DefaultRouter()
router.register(r'pacientes',             PacienteViewSet,  basename='paciente')
router.register(r'citas',                 CitaViewSet,      basename='cita')
router.register(r'consultas',             ConsultaViewSet,  basename='consulta')
router.register(r'facturacion/facturas',  FacturaViewSet,   basename='factura')

urlpatterns = [
    path('admin/', admin.site.urls),

    # Auth JWT
    path('api/auth/token/',         TokenObtainPairView.as_view(),  name='token_obtain'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(),     name='token_refresh'),

    # API REST
    path('api/', include(router.urls)),
]
