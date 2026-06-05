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

    # ── Credenciales Factus (PROPIAS de cada consultorio) ─────────────────────
    # Cada prestador se habilita ante la DIAN con su propia cuenta Factus.
    # En producción conviene cifrar client_secret y password (django-cryptography).
    factus_base_url        = models.CharField(
        max_length=200, blank=True,
        default='https://api-sandbox.factus.com.co',
        help_text='URL Factus (sandbox o producción) del consultorio',
    )
    factus_client_id       = models.CharField(max_length=200, blank=True)
    factus_client_secret   = models.CharField(max_length=255, blank=True)
    factus_username        = models.CharField(max_length=150, blank=True, help_text='Email/usuario Factus del consultorio')
    factus_password        = models.CharField(max_length=255, blank=True)
    factus_rango_numeracion_id = models.IntegerField(null=True, blank=True,
                                  help_text='ID del rango de numeración en Factus')

    # ── Resolución DIAN y numeración (propias de cada consultorio) ────────────
    resolucion_dian        = models.CharField(max_length=50, blank=True,
                              help_text='Número de la resolución DIAN de facturación')
    resolucion_fecha       = models.DateField(null=True, blank=True,
                              help_text='Fecha de la resolución DIAN')
    factura_prefijo        = models.CharField(max_length=10, blank=True,
                              help_text='Prefijo de la factura (ej: SETP, FE)')
    factura_rango_desde    = models.BigIntegerField(null=True, blank=True,
                              help_text='Número inicial autorizado en la resolución')
    factura_rango_hasta    = models.BigIntegerField(null=True, blank=True,
                              help_text='Número final autorizado en la resolución')
    factura_leyenda        = models.TextField(blank=True,
                              help_text='Leyenda/texto legal que aparece en la representación gráfica (PDF)')

    creado_en       = models.DateTimeField(auto_now_add=True)
    actualizado_en  = models.DateTimeField(auto_now=True)

    # django-tenants: crear schema automáticamente al crear tenant
    auto_create_schema = True

    class Meta:
        verbose_name = 'Consultorio'
        verbose_name_plural = 'Consultorios'

    def __str__(self):
        return f'{self.nombre} ({self.nit})'

    @property
    def factus_configurado(self) -> bool:
        """True si el consultorio tiene credenciales Factus completas."""
        return bool(
            self.factus_client_id and self.factus_client_secret
            and self.factus_username and self.factus_password
        )

    def credenciales_factus(self) -> dict:
        """
        Devuelve las credenciales Factus del consultorio.
        Si no están configuradas, cae a las variables de entorno (solo dev).
        """
        from decouple import config
        return {
            'base_url':      self.factus_base_url or config('FACTUS_BASE_URL', default='https://api-sandbox.factus.com.co'),
            'client_id':     self.factus_client_id or config('FACTUS_CLIENT_ID', default=''),
            'client_secret': self.factus_client_secret or config('FACTUS_CLIENT_SECRET', default=''),
            'username':      self.factus_username or config('FACTUS_USERNAME', default=''),
            'password':      self.factus_password or config('FACTUS_PASSWORD', default=''),
        }


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
