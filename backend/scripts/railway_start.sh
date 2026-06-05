#!/bin/bash
set -e

echo "=== Halu Medic — Railway startup ==="

echo "→ Migraciones schema público (shared)..."
python manage.py migrate_schemas --shared --noinput

echo "→ Migraciones schemas tenant..."
python manage.py migrate_schemas --noinput

echo "→ Registrar dominio Railway en tenant público..."
python manage.py setup_railway_domain \
  --domain "${RAILWAY_PUBLIC_DOMAIN:-halu-medic-production.up.railway.app}" \
  || echo "setup_railway_domain: no crítico"

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
