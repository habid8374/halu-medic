"""
Extiende TenantMainMiddleware para caer en el schema público
cuando el dominio no está registrado en la BD (ej: dominio de Railway).
"""
from django_tenants.middleware.main import TenantMainMiddleware
from django_tenants.utils import get_public_schema_name
from django.db import connection


class FallbackToPublicMiddleware(TenantMainMiddleware):
    """
    Si el dominio no tiene tenant asignado, usa el schema público
    en lugar de devolver 404. Útil para el dominio de Railway/hosting
    que sirve la API raíz.
    """

    def process_request(self, request):
        try:
            super().process_request(request)
        except self.TENANT_NOT_FOUND_EXCEPTION:
            from apps.tenants.models import Consultorio
            try:
                tenant = Consultorio.objects.get(schema_name=get_public_schema_name())
                tenant.domain_url = request.get_host()
                request.tenant = tenant
                connection.set_tenant(tenant)
                self.setup_url_routing(request)
            except Consultorio.DoesNotExist:
                pass
