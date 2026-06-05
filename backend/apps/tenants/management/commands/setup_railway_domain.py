"""
Crea el tenant demo y registra el dominio Railway apuntando a él.
Se ejecuta en cada deploy - es idempotente.
"""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Crea tenant demo y registra dominio Railway'

    def add_arguments(self, parser):
        parser.add_argument('--domain', default='', help='Dominio a registrar')

    def handle(self, *args, **options):
        from apps.tenants.models import Consultorio, Dominio

        domain = options['domain'].strip()
        if not domain:
            self.stdout.write('Sin dominio especificado, omitiendo.')
            return

        # 1. Crear tenant demo si no existe
        demo, created = Consultorio.objects.get_or_create(
            schema_name='demo',
            defaults={
                'nombre': 'Consultorio Demo',
                'nit': '000000000',
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS('Tenant demo creado'))
        else:
            self.stdout.write('Tenant demo ya existe')

        # 2. Registrar dominio apuntando al tenant demo
        obj, created = Dominio.objects.get_or_create(
            domain=domain,
            defaults={'tenant': demo, 'is_primary': True},
        )
        if not created and obj.tenant != demo:
            obj.tenant = demo
            obj.save()
            self.stdout.write(self.style.SUCCESS(f'Dominio {domain} actualizado → demo'))
        elif created:
            self.stdout.write(self.style.SUCCESS(f'Dominio {domain} creado → demo'))
        else:
            self.stdout.write(f'Dominio {domain} ya apunta a demo')
