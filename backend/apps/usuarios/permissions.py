"""
Permisos DRF personalizados por rol
Uso en ViewSets:
    permission_classes = [IsAuthenticated, EsAdminOSuperadmin]
"""
from rest_framework.permissions import BasePermission


class EsSuperadmin(BasePermission):
    """Solo Habid / Axentia — acceso total a todos los tenants."""
    message = 'Acción reservada para superadministradores de Axentia.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.es_superadmin)


class EsAdminOSuperadmin(BasePermission):
    """Admin del consultorio o superadmin."""
    message = 'Requiere rol de administrador del consultorio.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.es_admin)


class PuedeFacturar(BasePermission):
    """Admin, facturador o superadmin."""
    message = 'No tienes permisos para gestionar facturación.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.puede_facturar)


class PuedeGestionarCitas(BasePermission):
    """Admin, médico, recepcionista o superadmin."""
    message = 'No tienes permisos para gestionar citas.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.puede_gestionar_citas)


class PuedeVerClinica(BasePermission):
    """Admin, médico, auditor o superadmin — sin recepcionista."""
    message = 'No tienes acceso a información clínica.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.puede_ver_clinica)


class SoloLectura(BasePermission):
    """Permite GET/HEAD/OPTIONS a cualquier autenticado; escribe solo quien no es auditor."""
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        return not request.user.solo_lectura
