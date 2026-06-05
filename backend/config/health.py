from django.http import JsonResponse


class HealthCheckMiddleware:
    """Responde /api/health/ antes de que TenantMainMiddleware procese la petición."""
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path == '/api/health/':
            return JsonResponse({'status': 'ok'})
        return self.get_response(request)
