"""
Modelos de usuarios y roles para Halu Medic

Jerarquía de roles:
  SUPERADMIN  → Habid / Axentia — acceso total a todos los tenants
  ADMIN       → Dueño/gerente del consultorio — su tenant completo
  MEDICO      → Solo sus propias consultas y agenda
  RECEPCIONISTA → Citas y pacientes, sin acceso financiero
  FACTURADOR  → Facturación y RIPS, sin acceso clínico
  AUDITOR     → Solo lectura en todo
"""
from django.contrib.auth.models import AbstractUser
from django.db import models
import uuid


class Rol(models.TextChoices):
    SUPERADMIN    = 'superadmin',    'Superadmin (Axentia)'
    ADMIN         = 'admin',         'Administrador del consultorio'
    MEDICO        = 'medico',        'Médico'
    RECEPCIONISTA = 'recepcionista', 'Recepcionista'
    FACTURADOR    = 'facturador',    'Facturador'
    AUDITOR       = 'auditor',       'Auditor (solo lectura)'


class Usuario(AbstractUser):
    """
    Usuario extendido con rol y datos del perfil.
    Reemplaza al User de Django (AUTH_USER_MODEL).
    """
    id     = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rol    = models.CharField(max_length=20, choices=Rol.choices, default=Rol.RECEPCIONISTA)
    cedula = models.CharField(
        max_length=20, blank=True, db_index=True,
        help_text='Cédula / número de identificación — usado para login',
    )
    telefono = models.CharField(max_length=20, blank=True)
    avatar   = models.ImageField(upload_to='avatares/', null=True, blank=True)
    activo_tenant = models.BooleanField(default=True, help_text='Activo en este consultorio')

    # ── Datos profesionales (médicos y personal clínico) ─────────────────────
    tarjeta_profesional = models.CharField(
        max_length=20, blank=True,
        help_text='Número de tarjeta profesional (Colegio Médico Colombiano)',
    )
    numero_rethus = models.CharField(
        max_length=30, blank=True,
        help_text='Número de registro ReTHUS (Ley 1164/2007)',
    )
    especialidad_principal = models.ForeignKey(
        'catalogos.Especialidad',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='medicos_principal',
        help_text='Especialidad principal del profesional',
    )
    especialidades = models.ManyToManyField(
        'catalogos.Especialidad',
        blank=True,
        related_name='medicos',
        help_text='Especialidades adicionales',
    )
    firma_imagen = models.ImageField(
        upload_to='firmas/',
        null=True, blank=True,
        help_text='Imagen de la firma del profesional (PNG/JPG)',
    )

    # Campos obligatorios para AbstractUser
    REQUIRED_FIELDS = ['email', 'first_name', 'last_name', 'rol']

    class Meta:
        verbose_name = 'Usuario'
        verbose_name_plural = 'Usuarios'

    def __str__(self):
        return f'{self.get_full_name()} ({self.get_rol_display()})'

    # ── Helpers de permisos por rol ──────────────────────────────────────────

    @property
    def es_superadmin(self):
        return self.rol == Rol.SUPERADMIN or self.is_superuser

    @property
    def es_admin(self):
        return self.rol in (Rol.SUPERADMIN, Rol.ADMIN) or self.is_superuser

    @property
    def puede_facturar(self):
        return self.rol in (Rol.SUPERADMIN, Rol.ADMIN, Rol.FACTURADOR)

    @property
    def puede_ver_clinica(self):
        return self.rol in (Rol.SUPERADMIN, Rol.ADMIN, Rol.MEDICO, Rol.AUDITOR)

    @property
    def puede_editar_clinica(self):
        return self.rol in (Rol.SUPERADMIN, Rol.ADMIN, Rol.MEDICO)

    @property
    def puede_gestionar_citas(self):
        return self.rol in (Rol.SUPERADMIN, Rol.ADMIN, Rol.MEDICO, Rol.RECEPCIONISTA)

    @property
    def solo_lectura(self):
        return self.rol == Rol.AUDITOR
