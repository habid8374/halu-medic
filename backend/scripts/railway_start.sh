#!/bin/bash
set -e

echo "=== Halu Medic — Railway startup ==="

# 1. Migraciones schema público (solo tablas compartidas — rápido)
echo "→ Migraciones shared..."
python manage.py migrate_schemas --shared --noinput

# 2. Registrar dominio Railway
echo "→ Registrar dominio..."
python manage.py setup_railway_domain \
  --domain "${RAILWAY_PUBLIC_DOMAIN:-halu-medic-production.up.railway.app}" \
  || echo "setup_railway_domain: no crítico"

# 3. Migraciones de TODOS los tenant schemas (necesario antes de servir requests)
echo "→ Migraciones tenant schemas..."
python manage.py migrate_schemas --noinput

# 4. Crear usuario admin en tenant demo
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
    print('Usuario demo OK:', u.username)
" || echo "setup usuario demo: no crítico"

# 5. Archivos estáticos (rápido)
echo "→ Collectstatic..."
python manage.py collectstatic --noinput

# 6. Importaciones de catálogos en BACKGROUND — no bloquean gunicorn
#    Usan nohup para sobrevivir al exec que sigue
nohup bash -c "
  sleep 5
  echo '→ [BG] Importar CUPS...'
  python manage.py importar_cups || echo '[BG] CUPS ya importados'
  echo '→ [BG] Importar CIE-10...'
  python manage.py importar_cie10 || echo '[BG] CIE-10 ya importados'
  echo '→ [BG] Catálogos listos.'
" > /tmp/catalogos.log 2>&1 &

# 7. Levantar gunicorn (reemplaza este proceso)
echo "→ Levantando gunicorn..."
exec gunicorn config.wsgi:application \
  --bind 0.0.0.0:${PORT:-8000} \
  --workers 2 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
