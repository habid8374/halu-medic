"""
Middleware que cae al schema público cuando el dominio no está en la BD.
"""
from django_tenants.middleware.main import TenantMainMiddleware
from django_tenants.utils import get_public_schema_name
from django.db import connection
from django.conf import settings
from django.urls import set_urlconf


class FallbackToPublicMiddleware(TenantMainMiddleware):
    """
    Si el dominio no tiene tenant asignado usa el schema público
    en lugar de devolver 404.
    """

    def process_request(self, request):
        try:
            super().process_request(request)
        except self.TENANT_NOT_FOUND_EXCEPTION:
            from apps.tenants.models import Consultorio
            try:
                tenant = Consultorio.objects.get(schema_name=get_public_schema_name())
            except Consultorio.DoesNotExist:
                # sin tenant público, dejar que falle normalmente
                raise

            request.tenant = tenant
            connection.set_tenant(tenant)

            # Activar URLconf público
            public_urlconf = getattr(settings, 'PUBLIC_SCHEMA_URLCONF', None)
            if public_urlconf:
                request.urlconf = public_urlconf
                set_urlconf(public_urlconf)
