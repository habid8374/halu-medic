"""
Provisiona un tenant de producción y redirige el dominio Railway a él.
Reemplaza el tenant 'demo' como destino del dominio principal.

Uso (Railway Shell o consola del servidor):

  python manage.py setup_produccion \
      --schema miips \
      --nombre "Clínica San José" \
      --nit "900123456-1" \
      --admin-email admin@miips.com \
      --admin-password "Cambiar123!"

Parámetros opcionales:
  --razon-social "Clínica San José SAS"
  --telefono "3001234567"
  --municipio "08001"  (código DANE, 08001=Barranquilla)
  --plan pro           (basico|pro|clinica)
  --no-importar-catalogos  (omitir CIE-10, CUPS, aseguradoras)
"""
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Crea tenant de producción y redirige el dominio Railway a él'

    def add_arguments(self, parser):
        parser.add_argument('--schema',         required=True,  help='Schema name (slug): solo minúsculas y guiones bajos')
        parser.add_argument('--nombre',         required=True,  help='Nombre de la IPS/consultorio')
        parser.add_argument('--nit',            required=True,  help='NIT de la IPS')
        parser.add_argument('--admin-email',    required=True,  help='Email del usuario administrador')
        parser.add_argument('--admin-password', required=True,  help='Contraseña del usuario administrador')
        parser.add_argument('--admin-nombre',   default='Admin',help='Nombre del usuario administrador')
        parser.add_argument('--admin-cedula',   default='0',    help='Cédula del usuario administrador')
        parser.add_argument('--razon-social',   default='',     help='Razón social completa')
        parser.add_argument('--telefono',       default='',     help='Teléfono de contacto')
        parser.add_argument('--municipio',      default='08001',help='Código DANE del municipio (default: 08001 = Barranquilla)')
        parser.add_argument('--plan',           default='pro',  choices=['basico', 'pro', 'clinica'])
        parser.add_argument('--no-importar-catalogos', action='store_true',
                            help='No importar CIE-10, CUPS ni aseguradoras')

    def handle(self, *args, **options):
        from django.db import transaction
        from django_tenants.utils import schema_context
        from apps.tenants.models import Consultorio, Dominio
        from apps.usuarios.models import Usuario, Rol

        schema = options['schema'].lower().replace('-', '_')
        if not schema.replace('_', '').isalnum():
            raise CommandError('El schema solo puede tener letras, números y guiones bajos.')

        self.stdout.write(self.style.MIGRATE_HEADING(f'\n=== Provisionando tenant de producción: {schema} ===\n'))

        # ── 1. Crear o recuperar Consultorio ─────────────────────────────────
        with transaction.atomic():
            consultorio, creado = Consultorio.objects.get_or_create(
                schema_name=schema,
                defaults={
                    'nombre':          options['nombre'],
                    'nit':             options['nit'],
                    'razon_social':    options.get('razon_social') or options['nombre'],
                    'telefono':        options.get('telefono', ''),
                    'municipio_codigo': options.get('municipio', '08001'),
                    'plan':            options['plan'],
                    'activo':          True,
                }
            )
            if creado:
                self.stdout.write(self.style.SUCCESS(f'✓ Consultorio creado: {consultorio.nombre}'))
            else:
                self.stdout.write(f'  Consultorio ya existe: {consultorio.nombre}')

            # ── 2. Redirigir todos los dominios del tenant demo a producción ──
            demo_qs = Consultorio.objects.filter(schema_name='demo')
            if demo_qs.exists():
                demo = demo_qs.first()
                dominios_migrados = Dominio.objects.filter(tenant=demo)
                count = dominios_migrados.update(tenant=consultorio)
                if count:
                    self.stdout.write(self.style.SUCCESS(
                        f'✓ {count} dominio(s) redirigido(s) del tenant demo → {schema}'
                    ))
                else:
                    self.stdout.write('  No había dominios en demo para redirigir.')
            else:
                self.stdout.write('  Tenant demo no encontrado, no hay dominios que redirigir.')

            # ── 3. Crear usuario admin en el nuevo schema ─────────────────────
            with schema_context(schema):
                username = options['admin_email'].split('@')[0].lower().replace('.', '_')
                if not Usuario.objects.filter(username=username).exists():
                    admin = Usuario(
                        username      = username,
                        first_name    = options['admin_nombre'],
                        email         = options['admin_email'],
                        cedula        = options['admin_cedula'],
                        rol           = Rol.ADMIN,
                        activo_tenant = True,
                        is_staff      = False,
                        is_superuser  = False,
                    )
                    admin.set_password(options['admin_password'])
                    admin.save()
                    self.stdout.write(self.style.SUCCESS(f'✓ Usuario admin creado: {username}'))
                else:
                    self.stdout.write(f'  Usuario {username} ya existe.')

            # ── 4. Crear suscripción activa ───────────────────────────────────
            try:
                from apps.suscripciones.models import Suscripcion, EstadoSuscripcion
                from django.utils import timezone
                from datetime import timedelta

                if not hasattr(consultorio, 'suscripcion') or not consultorio.suscripcion_id:
                    fecha_fin = (timezone.now() + timedelta(days=365)).date()
                    sus = Suscripcion.objects.create(
                        consultorio  = consultorio,
                        estado       = EstadoSuscripcion.ACTIVA,
                        fecha_inicio = timezone.now().date(),
                        fecha_fin    = fecha_fin,
                        dias_gracia  = 7,
                    )
                    sus.aplicar_limites_plan()
                    sus.save()
                    self.stdout.write(self.style.SUCCESS(f'✓ Suscripción {options["plan"]} activa hasta {fecha_fin}'))
                else:
                    self.stdout.write('  Suscripción ya existe.')
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'  Suscripción: {e}'))

        # ── 5. Importar catálogos (opcional) ─────────────────────────────────
        if not options['no_importar_catalogos']:
            self.stdout.write('\nImportando catálogos...')
            with schema_context(schema):
                from django.core.management import call_command
                for cmd in ['importar_cups', 'importar_cie10', 'importar_aseguradoras']:
                    try:
                        call_command(cmd, verbosity=0)
                        self.stdout.write(self.style.SUCCESS(f'✓ {cmd}'))
                    except Exception as e:
                        self.stdout.write(self.style.WARNING(f'  {cmd}: {e}'))

        self.stdout.write(self.style.SUCCESS(
            f'\n✅ Tenant "{schema}" listo. '
            f'Accede al sistema con el usuario: {options["admin_email"]}'
        ))
