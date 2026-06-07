#!/bin/bash
set -e

echo "=== Halu Medic — Railway startup ==="

# 1. Migraciones schema público (rápido)
echo "→ Migraciones shared (public schema)..."
python manage.py migrate_schemas --shared --noinput

# 2. Registrar dominio Railway (crea tenant 'demo' si no existe)
echo "→ Registrar dominio Railway..."
python manage.py setup_railway_domain \
  --domain "${RAILWAY_PUBLIC_DOMAIN:-halu-medic-production.up.railway.app}" \
  || echo "setup_railway_domain: no crítico"

# 3. Migrar SOLO el schema 'demo' (no itera todos los schemas — mucho más rápido)
echo "→ Migraciones schema demo..."
python manage.py tenant_command migrate --schema=demo --noinput \
  || python manage.py migrate_schemas --noinput

# 4. Crear usuario admin
echo "→ Crear usuario admin..."
python manage.py shell -c "
from django_tenants.utils import schema_context
from apps.usuarios.models import Usuario
with schema_context('demo'):
    u, created = Usuario.objects.get_or_create(
        username='habid',
        defaults={
            'email': 'habid8374@gmail.com',
            'rol': 'superadmin',
            'is_staff': True,
            'is_superuser': True,
            'activo_tenant': True,
        }
    )
    u.set_password('Axentia2026*')
    u.activo_tenant = True
    u.is_active = True
    u.is_staff = True
    u.is_superuser = True
    u.save()
    print('Usuario OK:', u.username)
" || echo "usuario: no crítico"

# 5. Archivos estáticos
echo "→ Collectstatic..."
python manage.py collectstatic --noinput

# 6. Catálogos en background (no bloquean arranque)
nohup bash -c "
  sleep 5
  python manage.py importar_cups    || echo 'CUPS ya OK'
  python manage.py importar_cie10   || echo 'CIE10 ya OK'
" > /tmp/catalogos.log 2>&1 &

echo "→ Levantando gunicorn..."
exec gunicorn config.wsgi:application \
  --bind 0.0.0.0:${PORT:-8000} \
  --workers 2 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
