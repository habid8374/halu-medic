"""
Comando: python manage.py crear_superadmin
Crea el usuario superadmin de Axentia Technologies en el schema público.
Se ejecuta una sola vez al inicializar el sistema.
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django_tenants.utils import schema_context

User = get_user_model()


class Command(BaseCommand):
    help = 'Crea el superadmin de Axentia en el schema público'

    def add_arguments(self, parser):
        parser.add_argument('--username',  default='habid',           help='Username del superadmin')
        parser.add_argument('--email',     default='habid@axentia.co', help='Email del superadmin')
        parser.add_argument('--nombre',    default='Habid',            help='Primer nombre')
        parser.add_argument('--apellido',  default='Acuña',            help='Primer apellido')
        parser.add_argument('--password',  default=None,               help='Contraseña (se pedirá si no se provee)')

    def handle(self, *args, **options):
        with schema_context('public'):
            username = options['username']

            if User.objects.filter(username=username).exists():
                self.stdout.write(self.style.WARNING(
                    f'El usuario "{username}" ya existe. Sin cambios.'
                ))
                return

            password = options['password']
            if not password:
                import getpass
                password  = getpass.getpass(f'Contraseña para {username}: ')
                password2 = getpass.getpass('Confirmar contraseña: ')
                if password != password2:
                    self.stderr.write('Las contraseñas no coinciden.')
                    return

            user = User.objects.create_superuser(
                username   = username,
                email      = options['email'],
                password   = password,
                first_name = options['nombre'],
                last_name  = options['apellido'],
            )
            # Asignar rol superadmin
            from backend.apps.usuarios.models import Rol
            user.rol = Rol.SUPERADMIN
            user.save(update_fields=['rol'])

            self.stdout.write(self.style.SUCCESS(
                f'\n✓ Superadmin creado exitosamente'
                f'\n  Usuario:  {user.username}'
                f'\n  Email:    {user.email}'
                f'\n  Nombre:   {user.get_full_name()}'
                f'\n  Rol:      {user.get_rol_display()}'
                f'\n\n  Acceso:   http://localhost:8000/admin/'
                f'\n  API login: POST /api/auth/login/'
            ))
