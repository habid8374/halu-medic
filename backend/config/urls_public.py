"""
URLs públicas (schema 'public') — SaaS landing y gestión de tenants
"""
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse


def health(request):
    return JsonResponse({'status': 'ok'})
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from apps.usuarios.auth import (
    LoginView,
    LogoutView,
    MiPerfilView,
    RecuperarPasswordView,
    ConfirmarPasswordView,
    UsuarioViewSet,
)
from apps.suscripciones.api import SuscripcionViewSet
from config.api import CodigoCUPSViewSet, CodigoCIE10ViewSet

router = DefaultRouter()
router.register(r'admin/suscripciones', SuscripcionViewSet,  basename='suscripcion')
router.register(r'usuarios',            UsuarioViewSet,      basename='usuario-public')
router.register(r'cups',                CodigoCUPSViewSet,   basename='cups-public')
router.register(r'cie10',               CodigoCIE10ViewSet,  basename='cie10-public')

urlpatterns = [
    path('api/health/', health, name='health'),
    path('admin/', admin.site.urls),

    # ── Auth ──────────────────────────────────────────────────────────────────
    path('api/auth/login/',              LoginView.as_view(),             name='login'),
    path('api/auth/refresh/',            TokenRefreshView.as_view(),      name='token_refresh'),
    path('api/auth/logout/',             LogoutView.as_view(),            name='logout'),
    path('api/auth/me/',                 MiPerfilView.as_view(),          name='me'),
    path('api/auth/recuperar-password/', RecuperarPasswordView.as_view(), name='recuperar_password'),
    path('api/auth/confirmar-password/', ConfirmarPasswordView.as_view(), name='confirmar_password'),

    # ── Admin SaaS ────────────────────────────────────────────────────────────
    path('api/', include(router.urls)),
]
