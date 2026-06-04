"""
Modelos de Tenants
Consultorio = tenant principal (tiene su propio schema PostgreSQL)
Dominio = subdominio para acceder al tenant (ej: drperez.halumedic.co)
"""
from django.db import models
from django_tenants.models import TenantMixin, DomainMixin
import uuid


class PlanSaaS(models.TextChoices):
    BASICO  = 'basico',  'Básico (1 médico, 100 facturas/mes)'
    PRO     = 'pro',     'Pro (5 médicos, ilimitado)'
    CLINICA = 'clinica', 'Clínica (ilimitado + API)'


class Consultorio(TenantMixin):
    """
    Cada consultorio es un tenant con su propio schema en PostgreSQL.
    El schema se crea automáticamente al guardar.
    """
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nombre          = models.CharField(max_length=200, help_text='Nombre del consultorio o clínica')
    nit             = models.CharField(max_length=20, unique=True)
    codigo_prestador = models.CharField(max_length=20, blank=True, help_text='Código habilitación MinSalud')
    razon_social    = models.CharField(max_length=200, blank=True)
    direccion       = models.CharField(max_length=200, blank=True)
    municipio_codigo = models.CharField(max_length=10, default='08001', help_text='DANE — 08001=Barranquilla')
    telefono        = models.CharField(max_length=20, blank=True)
    email           = models.EmailField(blank=True)

    # SaaS
    plan            = models.CharField(max_length=20, choices=PlanSaaS.choices, default=PlanSaaS.BASICO)
    activo          = models.BooleanField(default=True)
    fecha_vencimiento = models.DateField(null=True, blank=True)

    # Facturación propia del tenant (para Factus)
    factus_rango_numeracion_id = models.IntegerField(null=True, blank=True)

    creado_en       = models.DateTimeField(auto_now_add=True)
    actualizado_en  = models.DateTimeField(auto_now=True)

    # django-tenants: crear schema automáticamente al crear tenant
    auto_create_schema = True

    class Meta:
        verbose_name = 'Consultorio'
        verbose_name_plural = 'Consultorios'

    def __str__(self):
        return f'{self.nombre} ({self.nit})'


class Dominio(DomainMixin):
    """
    Dominio/subdominio asociado a un consultorio.
    Ej: drperez.halumedic.co → consultorio DrPerez
    """
    class Meta:
        verbose_name = 'Dominio'
        verbose_name_plural = 'Dominios'

    def __str__(self):
        return self.domain
