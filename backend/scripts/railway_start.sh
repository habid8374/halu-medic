#!/bin/bash
set -e

echo "=== Halu Medic — Railway startup ==="

# Solo las migraciones del schema público (rápido — no itera tenants)
echo "→ Migraciones shared..."
python manage.py migrate_schemas --shared --noinput

# Archivos estáticos (rápido)
echo "→ Collectstatic..."
python manage.py collectstatic --noinput

# Todo lo lento corre en background DESPUÉS de que gunicorn arranque
(
  echo "→ [BG] Registrar dominio Railway..."
  python manage.py setup_railway_domain \
    --domain "${RAILWAY_PUBLIC_DOMAIN:-halu-medic-production.up.railway.app}" \
    || echo "[BG] setup_railway_domain: no crítico"

  echo "→ [BG] Migraciones tenant schemas..."
  python manage.py migrate_schemas --noinput || echo "[BG] migrate_schemas: error"

  echo "→ [BG] Crear usuario admin..."
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
    print('[BG] Usuario demo OK:', u.username)
" || echo "[BG] usuario: no crítico"

  echo "→ [BG] Importar CUPS..."
  python manage.py importar_cups || echo "[BG] CUPS ya importados"

  echo "→ [BG] Importar CIE-10..."
  python manage.py importar_cie10 || echo "[BG] CIE-10 ya importados"

  echo "→ [BG] Tareas de fondo completadas."
) &

echo "→ Levantando gunicorn..."
exec gunicorn config.wsgi:application \
  --bind 0.0.0.0:${PORT:-8000} \
  --workers 2 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
