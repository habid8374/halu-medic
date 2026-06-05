"""
Registra el dominio de Railway en el tenant público para que
TenantMainMiddleware resuelva correctamente las peticiones.
"""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Asegura que el dominio Railway apunte al tenant público'

    def add_arguments(self, parser):
        parser.add_argument('--domain', default='', help='Dominio a registrar')

    def handle(self, *args, **options):
        from apps.tenants.models import Consultorio, Dominio

        railway_domain = options['domain'].strip()
        if not railway_domain:
            self.stdout.write('Sin dominio especificado, omitiendo.')
            return

        try:
            publico = Consultorio.objects.get(schema_name='public')
        except Consultorio.DoesNotExist:
            self.stdout.write(self.style.ERROR('Tenant público no existe aún.'))
            return

        obj, created = Dominio.objects.get_or_create(
            domain=railway_domain,
            defaults={'tenant': publico, 'is_primary': True},
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f'Dominio creado: {railway_domain}'))
        else:
            self.stdout.write(f'Dominio ya existe: {railway_domain}')
