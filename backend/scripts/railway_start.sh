#!/bin/bash
set -e

echo "=== Halu Medic — Railway startup ==="

echo "→ Migraciones schema público (shared)..."
python manage.py migrate_schemas --shared --noinput

echo "→ Crear tenant demo y registrar dominio Railway..."
python manage.py setup_railway_domain \
  --domain "${RAILWAY_PUBLIC_DOMAIN:-halu-medic-production.up.railway.app}" \
  || echo "setup_railway_domain: no crítico"

echo "→ Migraciones schemas tenant (incluye demo)..."
python manage.py migrate_schemas --noinput

echo "→ Crear usuario admin en tenant demo..."
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
    print('Usuario demo OK:', u.username)
" || echo "setup usuario demo: no crítico"

echo "→ Importar CUPS (si la tabla está vacía)..."
python manage.py importar_cups || echo "CUPS ya importados o error no crítico"

echo "→ Importar CIE-10 (si la tabla está vacía)..."
python manage.py importar_cie10 || echo "CIE-10 ya importados o error no crítico"

echo "→ Archivos estáticos..."
python manage.py collectstatic --noinput

echo "→ Levantando gunicorn..."
exec gunicorn config.wsgi:application \
  --bind 0.0.0.0:${PORT:-8000} \
  --workers 2 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
