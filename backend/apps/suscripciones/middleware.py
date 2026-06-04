"""
Middleware que bloquea el acceso a tenants con suscripción vencida.
Retorna 402 Payment Required si el consultorio no tiene suscripción activa.
Se omiten: admin Django, endpoints públicos y el schema 'public'.
"""
import json
from django.http import HttpResponse
from django.utils import timezone


RUTAS_EXENTAS = {
    '/admin/',
    '/api/auth/login/',
    '/api/auth/refresh/',
    '/api/auth/recuperar-password/',
    '/api/auth/confirmar-password/',
    '/api/facturacion/webhook/',
}


class SuscripcionActivaMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Solo aplica a tenants (no al schema público)
        schema = getattr(getattr(request, 'tenant', None), 'schema_name', 'public')
        if schema == 'public':
            return self.get_response(request)

        # Rutas exentas
        if any(request.path.startswith(ruta) for ruta in RUTAS_EXENTAS):
            return self.get_response(request)

        # Verificar suscripción del tenant
        tenant = request.tenant
        try:
            suscripcion = tenant.suscripcion
            if not suscripcion.esta_activa:
                return HttpResponse(
                    json.dumps({
                        'error': 'suscripcion_vencida',
                        'mensaje': (
                            'Tu suscripción ha vencido. '
                            'Renueva tu plan para continuar usando Halu Medic.'
                        ),
                        'dias_vencida': abs(suscripcion.dias_restantes or 0),
                    }),
                    status=402,
                    content_type='application/json',
                )
        except Exception:
            # Si no tiene suscripción asignada, no bloquear (puede ser un tenant nuevo)
            pass

        return self.get_response(request)
