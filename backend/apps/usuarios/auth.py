"""
API de autenticación y gestión de usuarios
Endpoints:
  POST /api/auth/login/                    → JWT (usuario/contraseña o cédula/contraseña)
  POST /api/auth/refresh/                  → renovar access token
  POST /api/auth/logout/                   → invalidar refresh token
  GET  /api/auth/me/                       → perfil del usuario actual
  POST /api/auth/recuperar-password/       → solicitar reset por email
  POST /api/auth/confirmar-password/       → confirmar reset con token
  GET  /api/usuarios/                      → listar usuarios del consultorio (admin)
  POST /api/usuarios/                      → crear usuario en el consultorio (admin)
  PUT  /api/usuarios/{id}/                 → editar usuario
  POST /api/usuarios/{id}/cambiar_password/
  POST /api/usuarios/{id}/desactivar/
"""
from rest_framework import serializers, viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.core.mail import send_mail
from django.conf import settings

from apps.usuarios.models import Rol
from apps.usuarios.permissions import EsAdminOSuperadmin

User = get_user_model()


# ── JWT personalizado — incluye rol y nombre en el token ─────────────────────

class HaluTokenSerializer(TokenObtainPairSerializer):
    """
    Login por username O cédula.
    Body: { "username": "<usuario o cédula>", "password": "..." }
    """

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['nombre']   = user.get_full_name()
        token['email']    = user.email
        token['rol']      = user.rol
        token['username'] = user.username
        return token

    def validate(self, attrs):
        # Intentar resolver por cédula si el username no existe
        username_or_cedula = attrs.get('username', '')
        if username_or_cedula and not User.objects.filter(username=username_or_cedula).exists():
            user_by_cedula = User.objects.filter(cedula=username_or_cedula).first()
            if user_by_cedula:
                attrs['username'] = user_by_cedula.username

        data = super().validate(attrs)
        user = self.user

        if not user.activo_tenant:
            raise serializers.ValidationError('Tu cuenta está desactivada en este consultorio.')

        data['usuario'] = {
            'id':       str(user.id),
            'nombre':   user.get_full_name(),
            'email':    user.email,
            'username': user.username,
            'cedula':   user.cedula,
            'rol':      user.rol,
            'rol_label': user.get_rol_display(),
            'permisos': {
                'puede_facturar':        user.puede_facturar,
                'puede_ver_clinica':     user.puede_ver_clinica,
                'puede_editar_clinica':  user.puede_editar_clinica,
                'puede_gestionar_citas': user.puede_gestionar_citas,
                'es_admin':              user.es_admin,
                'es_superadmin':         user.es_superadmin,
            }
        }
        return data


class LoginView(TokenObtainPairView):
    """
    POST /api/auth/login/
    Body: { "username": "<usuario o cédula>", "password": "..." }
    Respuesta: { "access": "...", "refresh": "...", "usuario": {...} }
    """
    serializer_class = HaluTokenSerializer
    permission_classes = [AllowAny]


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Body: { "refresh": "..." }
    Invalida el refresh token (blacklist).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            token = RefreshToken(request.data.get('refresh'))
            token.blacklist()
            return Response({'mensaje': 'Sesión cerrada correctamente.'})
        except Exception:
            return Response(
                {'error': 'Token inválido o ya expirado.'},
                status=status.HTTP_400_BAD_REQUEST
            )


class MiPerfilView(APIView):
    """
    GET /api/auth/me/
    Devuelve el perfil completo del usuario autenticado.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            'id':        str(user.id),
            'username':  user.username,
            'cedula':    user.cedula,
            'nombre':    user.get_full_name(),
            'email':     user.email,
            'telefono':  user.telefono,
            'rol':       user.rol,
            'rol_label': user.get_rol_display(),
            'permisos': {
                'puede_facturar':        user.puede_facturar,
                'puede_ver_clinica':     user.puede_ver_clinica,
                'puede_editar_clinica':  user.puede_editar_clinica,
                'puede_gestionar_citas': user.puede_gestionar_citas,
                'es_admin':              user.es_admin,
                'es_superadmin':         user.es_superadmin,
            }
        })


# ── Recuperación de contraseña ────────────────────────────────────────────────

class RecuperarPasswordView(APIView):
    """
    POST /api/auth/recuperar-password/
    Body: { "email": "doctor@ejemplo.com" }
    Envía un correo con enlace de recuperación.
    Siempre responde 200 para no revelar si el email existe.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        if email:
            user = User.objects.filter(email__iexact=email).first()
            if user and user.email:
                token = default_token_generator.make_token(user)
                uid   = urlsafe_base64_encode(force_bytes(user.pk))
                frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
                reset_link = f'{frontend_url}/reset-password/{uid}/{token}/'
                send_mail(
                    subject='Recuperación de contraseña — Halu Medic',
                    message=(
                        f'Hola {user.get_full_name()},\n\n'
                        f'Recibimos una solicitud para restablecer tu contraseña.\n\n'
                        f'Haz clic en el siguiente enlace (válido por 24 horas):\n{reset_link}\n\n'
                        f'Si no solicitaste esto, ignora este correo.\n\n'
                        f'— Equipo Halu Medic'
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=True,
                )
        return Response({'mensaje': 'Si el correo está registrado, recibirás las instrucciones.'})


class ConfirmarPasswordView(APIView):
    """
    POST /api/auth/confirmar-password/
    Body: { "uid": "...", "token": "...", "password": "...", "password2": "..." }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        uid      = request.data.get('uid', '')
        token    = request.data.get('token', '')
        password = request.data.get('password', '')
        password2 = request.data.get('password2', '')

        if not all([uid, token, password, password2]):
            return Response(
                {'error': 'Todos los campos son requeridos.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if password != password2:
            return Response(
                {'error': 'Las contraseñas no coinciden.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            pk   = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=pk)
        except (User.DoesNotExist, ValueError, TypeError):
            return Response(
                {'error': 'El enlace es inválido.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not default_token_generator.check_token(user, token):
            return Response(
                {'error': 'El enlace ha expirado. Solicita uno nuevo.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            validate_password(password, user)
        except Exception as e:
            return Response({'error': list(e.messages)}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(password)
        user.save(update_fields=['password'])
        return Response({'mensaje': 'Contraseña actualizada. Ya puedes iniciar sesión.'})


# ── Gestión de usuarios del consultorio ──────────────────────────────────────

class UsuarioSerializer(serializers.ModelSerializer):
    rol_label       = serializers.CharField(source='get_rol_display', read_only=True)
    nombre_completo = serializers.CharField(source='get_full_name', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'cedula', 'first_name', 'last_name', 'nombre_completo',
            'email', 'telefono', 'rol', 'rol_label',
            'activo_tenant', 'date_joined',
        ]
        read_only_fields = ['id', 'date_joined']


class CrearUsuarioSerializer(serializers.ModelSerializer):
    password  = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, label='Confirmar contraseña')

    class Meta:
        model = User
        fields = [
            'username', 'cedula', 'first_name', 'last_name', 'email',
            'telefono', 'rol', 'password', 'password2',
        ]

    def validate(self, data):
        if data['password'] != data['password2']:
            raise serializers.ValidationError({'password2': 'Las contraseñas no coinciden.'})
        request = self.context.get('request')
        if data.get('rol') == Rol.SUPERADMIN:
            if not (request and request.user.es_superadmin):
                raise serializers.ValidationError(
                    {'rol': 'Solo un superadmin puede crear otro superadmin.'}
                )
        # Validar cédula única dentro del tenant
        cedula = data.get('cedula', '')
        if cedula and User.objects.filter(cedula=cedula).exists():
            raise serializers.ValidationError({'cedula': 'Ya existe un usuario con esa cédula.'})
        return data

    def create(self, validated_data):
        validated_data.pop('password2')
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class CambiarPasswordSerializer(serializers.Serializer):
    password_actual = serializers.CharField(write_only=True, required=False, allow_blank=True)
    password_nuevo  = serializers.CharField(write_only=True, validators=[validate_password])
    password_nuevo2 = serializers.CharField(write_only=True)

    def validate(self, data):
        if data['password_nuevo'] != data['password_nuevo2']:
            raise serializers.ValidationError({'password_nuevo2': 'Las contraseñas no coinciden.'})
        return data


class UsuarioViewSet(viewsets.ModelViewSet):
    """CRUD de usuarios del consultorio. Solo admins y superadmins."""
    permission_classes = [IsAuthenticated, EsAdminOSuperadmin]
    search_fields = ['username', 'cedula', 'first_name', 'last_name', 'email']
    ordering = ['first_name', 'last_name']

    def get_queryset(self):
        qs = User.objects.all()
        if not self.request.user.es_superadmin:
            qs = qs.exclude(rol=Rol.SUPERADMIN)
        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return CrearUsuarioSerializer
        return UsuarioSerializer

    @action(detail=True, methods=['post'], url_path='cambiar_password')
    def cambiar_password(self, request, pk=None):
        """
        POST /api/usuarios/{id}/cambiar_password/
        Admin puede cambiar cualquier contraseña. El usuario solo la suya.
        """
        usuario = self.get_object()

        if not request.user.es_admin and request.user.id != usuario.id:
            return Response(
                {'error': 'No tienes permiso para cambiar esta contraseña.'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = CambiarPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if request.user.id == usuario.id:
            if not usuario.check_password(serializer.validated_data['password_actual']):
                return Response(
                    {'error': 'La contraseña actual es incorrecta.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        usuario.set_password(serializer.validated_data['password_nuevo'])
        usuario.save()
        return Response({'mensaje': 'Contraseña actualizada correctamente.'})

    @action(detail=True, methods=['post'], url_path='desactivar')
    def desactivar(self, request, pk=None):
        """POST /api/usuarios/{id}/desactivar/ — desactiva acceso al tenant."""
        usuario = self.get_object()
        if usuario.es_superadmin and not request.user.es_superadmin:
            return Response(
                {'error': 'No puedes desactivar un superadmin.'},
                status=status.HTTP_403_FORBIDDEN
            )
        usuario.activo_tenant = False
        usuario.save(update_fields=['activo_tenant'])
        return Response({'mensaje': f'Usuario {usuario.get_full_name()} desactivado.'})

    @action(detail=True, methods=['post'], url_path='activar')
    def activar(self, request, pk=None):
        """POST /api/usuarios/{id}/activar/ — reactiva acceso al tenant."""
        usuario = self.get_object()
        usuario.activo_tenant = True
        usuario.save(update_fields=['activo_tenant'])
        return Response({'mensaje': f'Usuario {usuario.get_full_name()} activado.'})
