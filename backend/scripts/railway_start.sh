#!/bin/bash
set -e

echo "=== Halu Medic — Railway startup ==="

# Solo migraciones shared (tablas públicas, muy rápido)
echo "→ Migraciones shared..."
python manage.py migrate_schemas --shared --noinput

# Archivos estáticos
echo "→ Collectstatic..."
python manage.py collectstatic --noinput

# Levantar gunicorn inmediatamente
echo "→ Levantando gunicorn..."
exec gunicorn config.wsgi:application \
  --bind 0.0.0.0:${PORT:-8000} \
  --workers 2 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
