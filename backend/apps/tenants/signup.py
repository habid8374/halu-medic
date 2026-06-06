"""
Registro de nuevo consultorio (SaaS onboarding).
Crea en una sola transacción:
  1. Consultorio  → schema PostgreSQL propio
  2. Dominio      → subdominio <slug>.halumedic.co
  3. Usuario admin → credenciales iniciales del propietario
  4. Suscripcion  → 14 días de prueba gratuita
"""
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
import re

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import serializers

from apps.usuarios.permissions import EsSuperadmin

from apps.tenants.models import Consultorio, Dominio
from apps.suscripciones.models import Suscripcion, EstadoSuscripcion


# ── Validaciones ──────────────────────────────────────────────────────────────

def _slug_valido(slug: str) -> bool:
    return bool(re.match(r'^[a-z0-9][a-z0-9\-]{1,30}[a-z0-9]$', slug))


def _slug_disponible(slug: str) -> bool:
    dominio = f'{slug}.halumedic.co'
    return not Dominio.objects.filter(domain=dominio).exists()


def _nit_disponible(nit: str) -> bool:
    return not Consultorio.objects.filter(nit=nit).exists()


# ── Serializer ────────────────────────────────────────────────────────────────

class SignupSerializer(serializers.Serializer):
    # Datos del consultorio
    nombre          = serializers.CharField(max_length=200)
    nit             = serializers.CharField(max_length=20)
    razon_social    = serializers.CharField(max_length=200, required=False, allow_blank=True)
    telefono        = serializers.CharField(max_length=20, required=False, allow_blank=True)
    email           = serializers.EmailField()
    municipio_codigo = serializers.CharField(max_length=10, default='11001')
    slug            = serializers.CharField(max_length=32,
                        help_text='Subdominio: solo minúsculas, números y guiones')
    plan            = serializers.ChoiceField(choices=['basico', 'pro', 'clinica'], default='basico')

    # Datos del usuario administrador
    admin_nombre    = serializers.CharField(max_length=100)
    admin_apellido  = serializers.CharField(max_length=100, required=False, allow_blank=True)
    admin_cedula    = serializers.CharField(max_length=20)
    admin_username  = serializers.CharField(max_length=150)
    admin_email     = serializers.EmailField()
    admin_password  = serializers.CharField(min_length=8, write_only=True)

    def validate_nit(self, v):
        if not _nit_disponible(v):
            raise serializers.ValidationError('Ya existe un consultorio con este NIT.')
        return v

    def validate_slug(self, v):
        v = v.lower().strip()
        if not _slug_valido(v):
            raise serializers.ValidationError(
                'Solo minúsculas, números y guiones. Mínimo 3, máximo 32 caracteres.'
            )
        if not _slug_disponible(v):
            raise serializers.ValidationError('Este subdominio ya está en uso.')
        return v

    def validate_admin_password(self, v):
        if len(v) < 8:
            raise serializers.ValidationError('La contraseña debe tener al menos 8 caracteres.')
        return v


# ── Vista ─────────────────────────────────────────────────────────────────────

class SignupView(APIView):
    permission_classes = [IsAuthenticated, EsSuperadmin]

    def post(self, request):
        ser = SignupSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data

        try:
            resultado = _provisionar_tenant(d)
        except Exception as exc:
            return Response({'error': str(exc)}, status=400)

        return Response({
            'mensaje':   'Consultorio creado exitosamente. Periodo de prueba: 14 días.',
            'subdominio': resultado['dominio'],
            'plan':       d['plan'],
            'prueba_hasta': resultado['prueba_hasta'],
        }, status=201)


# ── Provisioning ─────────────────────────────────────────────────────────────

@transaction.atomic
def _provisionar_tenant(d: dict) -> dict:
    from django_tenants.utils import schema_context
    from apps.usuarios.models import Usuario, Rol

    slug   = d['slug']
    dominio_str = f'{slug}.halumedic.co'

    # 1. Crear Consultorio (crea schema automáticamente)
    consultorio = Consultorio(
        schema_name   = slug.replace('-', '_'),
        nombre        = d['nombre'],
        nit           = d['nit'],
        razon_social  = d.get('razon_social', d['nombre']),
        telefono      = d.get('telefono', ''),
        email         = d['email'],
        municipio_codigo = d.get('municipio_codigo', '11001'),
        plan          = d['plan'],
        activo        = True,
    )
    consultorio.save()

    # 2. Crear Dominio
    Dominio.objects.create(
        domain     = dominio_str,
        tenant     = consultorio,
        is_primary = True,
    )

    # 3. Crear usuario admin dentro del schema del tenant
    with schema_context(consultorio.schema_name):
        admin = Usuario(
            username       = d['admin_username'],
            first_name     = d['admin_nombre'],
            last_name      = d.get('admin_apellido', ''),
            email          = d['admin_email'],
            cedula         = d['admin_cedula'],
            rol            = Rol.ADMIN,
            activo_tenant  = True,
            is_staff       = False,
            is_superuser   = False,
        )
        admin.set_password(d['admin_password'])
        admin.save()

    # 4. Crear Suscripcion de prueba
    prueba_hasta = (timezone.now() + timedelta(days=14)).date()
    suscripcion = Suscripcion.objects.create(
        consultorio  = consultorio,
        estado       = EstadoSuscripcion.PRUEBA,
        fecha_inicio = timezone.now().date(),
        fecha_fin    = prueba_hasta,
        dias_gracia  = 3,
    )
    suscripcion.aplicar_limites_plan()
    suscripcion.save()

    return {
        'dominio':       dominio_str,
        'prueba_hasta':  str(prueba_hasta),
        'suscripcion_id': str(suscripcion.id),
    }
