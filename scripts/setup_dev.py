#!/usr/bin/env python
"""
Script de setup inicial para desarrollo local
Crea la base de datos, schemas y un tenant de prueba
Ejecutar desde la carpeta backend/:  python ..\\scripts\\setup_dev.py
"""
import os
import sys
import django

# La raíz de imports es la carpeta backend/ (igual que manage.py)
BACKEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
sys.path.insert(0, BACKEND_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()


def main():
    from django.core.management import call_command
    from apps.tenants.models import Consultorio, Dominio

    print('─' * 50)
    print('  Halu Medic — Setup de desarrollo')
    print('─' * 50)

    from django_tenants.utils import get_public_schema_name

    # 1. Migrar schema public
    print('\n[1/4] Migrando schema público...')
    call_command('migrate_schemas', '--shared', verbosity=1)

    # 1b. Tenant PÚBLICO (obligatorio para django-tenants) + dominio localhost
    public_schema = get_public_schema_name()  # normalmente 'public'
    if not Consultorio.objects.filter(schema_name=public_schema).exists():
        publico = Consultorio(
            schema_name=public_schema,
            nombre='Halu Medic (público)',
            nit='000000000',
            plan='clinica',
        )
        publico.save()
        print(f'  ✓ Tenant público creado (schema "{public_schema}")')
    else:
        publico = Consultorio.objects.get(schema_name=public_schema)
        print(f'  · Tenant público ya existe (schema "{public_schema}")')
    for dom in ('localhost', '127.0.0.1'):
        if not Dominio.objects.filter(domain=dom).exists():
            Dominio.objects.create(domain=dom, tenant=publico, is_primary=(dom == 'localhost'))
            print(f'  ✓ Dominio "{dom}" → tenant público')

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
        print('  ✓ Consultorio "demo" creado')
    else:
        consultorio = Consultorio.objects.get(schema_name='demo')
        print('  · Consultorio "demo" ya existe')

    # Dominio del tenant demo (idempotente)
    if not Dominio.objects.filter(domain='demo.localhost').exists():
        Dominio.objects.create(domain='demo.localhost', tenant=consultorio, is_primary=True)
        print('  ✓ Dominio "demo.localhost" → consultorio demo')

    # Suscripción activa de prueba para el consultorio demo
    from apps.suscripciones.models import Suscripcion, EstadoSuscripcion
    from datetime import timedelta
    from django.utils import timezone as tz
    if not Suscripcion.objects.filter(consultorio=consultorio).exists():
        sus = Suscripcion.objects.create(
            consultorio=consultorio,
            plan='pro',
            estado=EstadoSuscripcion.ACTIVA,
            fecha_inicio=tz.now().date(),
            fecha_fin=(tz.now() + timedelta(days=365)).date(),
        )
        sus.aplicar_limites_plan()
        sus.save()
        print('  ✓ Suscripción "pro" activa creada (365 días)')

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
            from apps.usuarios.models import Rol
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

    # 5. Crear usuario admin DENTRO del tenant demo (app clínica)
    print('\n[5/5] Creando usuario admin del consultorio demo...')
    from apps.usuarios.models import Rol
    with schema_context('demo'):
        if not User.objects.filter(username='demo').exists():
            medico = User.objects.create_user(
                username='demo', email='demo@consultorio.co', password='Demo2026*',
                first_name='Doctor', last_name='Demo',
            )
            medico.rol = Rol.ADMIN
            medico.cedula = '1000000001'
            medico.save(update_fields=['rol', 'cedula'])
            print('  ✓ Usuario del consultorio demo creado:')
            print('    Usuario:   demo   (o cédula 1000000001)')
            print('    Password:  Demo2026*')
        else:
            print('  · Usuario "demo" ya existe en el tenant')

    print('\n' + '─' * 50)
    print('  Setup completado')
    print('  Backend: python manage.py runserver')
    print('')
    print('  ── App clínica (médico/secretaria) ──')
    print('  Frontend: http://localhost:3000')
    print('  Usuario:  demo  /  Password: Demo2026*')
    print('')
    print('  ── Panel SaaS (superadmin Axentia) ──')
    print('  Django admin: http://localhost:8000/admin/')
    print('  Usuario:      habid  /  Password: Axentia2026*')
    print('─' * 50)


if __name__ == '__main__':
    main()
