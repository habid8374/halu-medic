#!/usr/bin/env python
"""
Script de setup inicial para desarrollo local
Crea la base de datos, schemas y un tenant de prueba
Ejecutar: python scripts/setup_dev.py
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.config.settings')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
django.setup()


def main():
    from django.core.management import call_command
    from backend.apps.tenants.models import Consultorio, Dominio

    print('─' * 50)
    print('  Halu Medic — Setup de desarrollo')
    print('─' * 50)

    # 1. Migrar schema public
    print('\n[1/4] Migrando schema público...')
    call_command('migrate_schemas', '--shared', verbosity=1)

    # 2. Crear tenant de prueba si no existe
    print('\n[2/4] Creando consultorio de prueba...')
    if not Consultorio.objects.filter(schema_name='demo').exists():
        consultorio = Consultorio(
            schema_name='demo',
            nombre='Consultorio Demo',
            nit='900000001',
            codigo_prestador='010101',
            plan='pro',
        )
        consultorio.save()
        Dominio.objects.create(
            domain='demo.localhost',
            tenant=consultorio,
            is_primary=True,
        )
        print('  ✓ Consultorio "demo" creado — dominio: demo.localhost')
    else:
        print('  · Consultorio "demo" ya existe')

    # 3. Migrar schema del tenant
    print('\n[3/4] Migrando schema del tenant demo...')
    call_command('migrate_schemas', '--schema=demo', verbosity=1)

    # 4. Crear superadmin Axentia en public si no existe
    print('\n[4/4] Verificando superadmin...')
    from django.contrib.auth import get_user_model
    from django_tenants.utils import schema_context
    User = get_user_model()
    with schema_context('public'):
        if not User.objects.filter(username='habid').exists():
            from backend.apps.usuarios.models import Rol
            user = User.objects.create_superuser(
                username='habid', email='habid@axentia.co', password='Axentia2026*',
                first_name='Habid', last_name='Acuña',
            )
            user.rol = Rol.SUPERADMIN
            user.save(update_fields=['rol'])
            print('  ✓ Superadmin creado:')
            print('    Usuario:   habid')
            print('    Password:  Axentia2026*  ← CAMBIAR en producción')
        else:
            print('  · Superadmin "habid" ya existe')

    print('\n' + '─' * 50)
    print('  Setup completado')
    print('  Backend: python manage.py runserver')
    print('  Admin:   http://localhost:8000/admin/')
    print('  Login:   POST http://demo.localhost:8000/api/auth/login/')
    print('           { "username": "habid", "password": "Axentia2026*" }')
    print('─' * 50)


if __name__ == '__main__':
    main()
