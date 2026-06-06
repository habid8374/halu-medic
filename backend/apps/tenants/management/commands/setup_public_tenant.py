"""
Configura el tenant público (schema 'public') y registra el dominio Railway.
También crea el superusuario de Axentia si no existe.

Ejecutar en Railway:
  /opt/venv/bin/python manage.py setup_public_tenant
"""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Configura tenant público, dominio Railway y superusuario Axentia'

    def handle(self, *args, **options):
        from django.conf import settings
        from apps.tenants.models import Consultorio, Dominio

        # ── 1. Tenant público ──────────────────────────────────────────────────
        pub, created = Consultorio.objects.get_or_create(
            schema_name='public',
            defaults={
                'nombre':      'Axentia Technologies',
                'nit':         '900000001',
                'razon_social': 'Axentia Technologies S.A.S.',
                'email':       'admin@axentia.co',
                'activo':      True,
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS('✓ Tenant público creado'))
        else:
            self.stdout.write('  Tenant público ya existe')

        # ── 2. Dominio Railway → public ────────────────────────────────────────
        railway_domain = 'halu-medic-production.up.railway.app'
        dom, created = Dominio.objects.get_or_create(
            domain=railway_domain,
            defaults={'tenant': pub, 'is_primary': True},
        )
        if not created and dom.tenant_id != pub.pk:
            dom.tenant = pub
            dom.save(update_fields=['tenant'])
            self.stdout.write(self.style.SUCCESS(f'✓ Dominio {railway_domain} reasignado → public'))
        elif created:
            self.stdout.write(self.style.SUCCESS(f'✓ Dominio {railway_domain} registrado → public'))
        else:
            self.stdout.write(f'  Dominio {railway_domain} ya apunta a public')

        # ── 3. Dominio localhost → public (desarrollo) ────────────────────────
        for dev_domain in ['localhost', '127.0.0.1']:
            Dominio.objects.get_or_create(
                domain=dev_domain,
                defaults={'tenant': pub, 'is_primary': False},
            )

        # ── 4. Superusuario en el schema público ──────────────────────────────
        from django_tenants.utils import schema_context
        with schema_context('public'):
            from apps.usuarios.models import Usuario, Rol
            from django.conf import settings as s
            su_username = 'axentia'
            if not Usuario.objects.filter(username=su_username).exists():
                su = Usuario(
                    username    = su_username,
                    first_name  = 'Habid',
                    last_name   = 'Axentia',
                    email       = 'habid8374@gmail.com',
                    rol         = Rol.SUPERADMIN,
                    is_staff    = True,
                    is_superuser = True,
                    activo_tenant = True,
                )
                su.set_password('Axentia2026*')
                su.save()
                self.stdout.write(self.style.SUCCESS(
                    f'✓ Superusuario "{su_username}" creado — cambia la contraseña tras el primer login'
                ))
            else:
                self.stdout.write(f'  Superusuario "{su_username}" ya existe')

        self.stdout.write(self.style.SUCCESS(
            '\n✓ Listo. Accede al admin en:\n'
            '  https://halu-medic-production.up.railway.app/admin/\n'
            f'  Usuario: {su_username} / Contraseña: Axentia2026*'
        ))
