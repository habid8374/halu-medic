#!/bin/bash
set -e

echo "=== Halu Medic — Railway startup ==="

# Migraciones shared (esquema público)
echo "→ Migraciones shared..."
python manage.py migrate_schemas --shared --noinput

# Migraciones tenant (schemas por IPS)
echo "→ Migraciones tenant..."
python manage.py migrate_schemas --noinput

# Archivos estáticos
echo "→ Collectstatic..."
python manage.py collectstatic --noinput

# Tenant público y superusuario (idempotente)
echo "→ Setup tenant público..."
python manage.py setup_public_tenant

# Levantar gunicorn
echo "→ Levantando gunicorn..."
exec gunicorn config.wsgi:application \
  --bind 0.0.0.0:${PORT:-8000} \
  --workers 2 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
