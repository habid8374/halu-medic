#!/usr/bin/env python
"""
Crea (o resetea) el usuario del consultorio demo dentro de su schema de tenant.
Ejecutar desde la carpeta backend/:  python ..\\scripts\\crear_usuario_demo.py

Uso opcional con argumentos:
  python ..\\scripts\\crear_usuario_demo.py <schema> <username> <password>
  (por defecto: demo  demo  Demo2026*)
"""
import os
import sys
import django

BACKEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
sys.path.insert(0, BACKEND_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()


def main():
    from django.contrib.auth import get_user_model
    from django_tenants.utils import schema_context
    from apps.usuarios.models import Rol
    from apps.tenants.models import Consultorio

    schema   = sys.argv[1] if len(sys.argv) > 1 else 'demo'
    username = sys.argv[2] if len(sys.argv) > 2 else 'demo'
    password = sys.argv[3] if len(sys.argv) > 3 else 'Demo2026*'

    User = get_user_model()

    # Verificar que el tenant exista
    if not Consultorio.objects.filter(schema_name=schema).exists():
        print(f'  ✗ No existe el consultorio (tenant) con schema "{schema}".')
        print('    Corre primero: python ..\\scripts\\setup_dev.py')
        return

    with schema_context(schema):
        user = User.objects.filter(username=username).first()
        if user:
            user.set_password(password)
            user.rol = Rol.ADMIN
            user.is_active = True
            if not user.cedula:
                user.cedula = '1000000001'
            user.save()
            print(f'  ✓ Usuario "{username}" actualizado (contraseña reseteada).')
        else:
            user = User.objects.create_user(
                username=username, email=f'{username}@consultorio.co', password=password,
                first_name='Doctor', last_name='Demo',
            )
            user.rol = Rol.ADMIN
            user.cedula = '1000000001'
            user.save(update_fields=['rol', 'cedula'])
            print(f'  ✓ Usuario "{username}" creado.')

        # Listar usuarios del tenant para confirmar
        todos = list(User.objects.values_list('username', flat=True))
        print(f'    Schema "{schema}" — usuarios existentes: {todos}')

    print('')
    print('  ── Entra en el frontend con ──')
    print(f'    Usuario:    {username}')
    print(f'    Contraseña: {password}')


if __name__ == '__main__':
    main()
