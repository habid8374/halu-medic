"""
Halu Medic — Configuración Django
Multi-tenant con django-tenants (schema por consultorio)
"""
from pathlib import Path
from decouple import config, Csv
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config('SECRET_KEY', default='dev-secret-key-cambiar-en-produccion')
DEBUG = config('DEBUG', default=True, cast=bool)
# '.localhost' permite todos los subdominios de tenant (demo.localhost, etc.)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,.localhost,127.0.0.1', cast=Csv())
# Siempre permitir el dominio de Railway
_RAILWAY = 'halu-medic-production.up.railway.app'
if _RAILWAY not in ALLOWED_HOSTS:
    ALLOWED_HOSTS = list(ALLOWED_HOSTS) + [_RAILWAY]

# ── Multi-tenancy ─────────────────────────────────────────────────────────────
# Apps compartidas (schema "public") — datos del SaaS
SHARED_APPS = [
    'django_tenants',
    'django.contrib.contenttypes',
    'django.contrib.auth',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.admin',

    'rest_framework',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',

    'apps.tenants',       # Modelo Consultorio y Dominio
    'apps.usuarios',      # Usuarios y roles
    'apps.suscripciones', # Planes SaaS
    'apps.catalogos',     # Catálogos nacionales (CUPS / homologador REPS)
]

# Apps por tenant (cada consultorio tiene su propio schema)
TENANT_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.auth',

    'apps.pacientes',
    'apps.citas',
    'apps.consultas',
    'apps.facturacion',
    'apps.rips',
    'apps.tarifas',
    'apps.reportes',
]

INSTALLED_APPS = list(set(SHARED_APPS + TENANT_APPS))

TENANT_MODEL = 'tenants.Consultorio'
TENANT_DOMAIN_MODEL = 'tenants.Dominio'

# ── Middleware ────────────────────────────────────────────────────────────────
MIDDLEWARE = [
    'config.health.HealthCheckMiddleware',               # ANTES del tenant middleware
    'corsheaders.middleware.CorsMiddleware',             # ANTES del tenant middleware para OPTIONS
    'config.tenant_middleware.FallbackToPublicMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'apps.suscripciones.middleware.SuscripcionActivaMiddleware',  # Bloqueo por vencimiento
]

ROOT_URLCONF = 'config.urls'
PUBLIC_SCHEMA_URLCONF = 'config.urls_public'

# ── Templates ─────────────────────────────────────────────────────────────────
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# ── Base de datos ─────────────────────────────────────────────────────────────
DATABASES = {
    'default': {
        'ENGINE': 'django_tenants.postgresql_backend',
        'NAME': config('DB_NAME', default='halu_medic'),
        'USER': config('DB_USER', default='halu_user'),
        'PASSWORD': config('DB_PASSWORD', default='halu_pass'),
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='5432'),
    }
}

DATABASE_ROUTERS = ['django_tenants.routers.TenantSyncRouter']

# ── Caché / Redis ─────────────────────────────────────────────────────────────
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': config('REDIS_URL', default='redis://localhost:6379/0'),
    }
}

# ── Celery ────────────────────────────────────────────────────────────────────
CELERY_BROKER_URL = config('REDIS_URL', default='redis://localhost:6379/0')
CELERY_RESULT_BACKEND = config('REDIS_URL', default='redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_TIMEZONE = 'America/Bogota'

# ── Django REST Framework ─────────────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'config.pagination.StandardPagination',
    'PAGE_SIZE': 25,
    'DEFAULT_FILTER_BACKENDS': [
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
}

# ── JWT ───────────────────────────────────────────────────────────────────────
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=8),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
    'ROTATE_REFRESH_TOKENS': True,
}

# ── CORS ──────────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = list(config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:3000,http://127.0.0.1:3000',
    cast=Csv()
))
_VERCEL = 'https://halu-medic.vercel.app'
if _VERCEL not in CORS_ALLOWED_ORIGINS:
    CORS_ALLOWED_ORIGINS.append(_VERCEL)
CORS_ALLOW_CREDENTIALS = True

# ── Almacenamiento ────────────────────────────────────────────────────────────
if config('AWS_ACCESS_KEY_ID', default=''):
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
    AWS_ACCESS_KEY_ID     = config('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = config('AWS_SECRET_ACCESS_KEY')
    AWS_STORAGE_BUCKET_NAME = config('AWS_STORAGE_BUCKET_NAME', default='halu-medic-docs')
    AWS_S3_ENDPOINT_URL   = config('AWS_S3_ENDPOINT_URL', default='')
    AWS_DEFAULT_ACL       = 'private'
else:
    MEDIA_URL  = '/media/'
    MEDIA_ROOT = BASE_DIR / 'media'

STATIC_URL  = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# ── Email ─────────────────────────────────────────────────────────────────────
EMAIL_BACKEND   = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST      = config('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT      = config('EMAIL_PORT', default=587, cast=int)
EMAIL_USE_TLS   = True
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL  = config('DEFAULT_FROM_EMAIL', default='noreply@halumedic.co')

# ── Internacionalización ──────────────────────────────────────────────────────
LANGUAGE_CODE = 'es-co'
TIME_ZONE     = 'America/Bogota'
USE_I18N      = True
USE_TZ        = True

# ── RIPS / Facturación (datos del prestador) ──────────────────────────────────
NIT_PRESTADOR          = config('NIT_PRESTADOR', default='')
CODIGO_PRESTADOR_RIPS  = config('CODIGO_PRESTADOR_RIPS', default='')

# ── Suscripciones / SaaS ──────────────────────────────────────────────────────
FRONTEND_URL           = config('FRONTEND_URL', default='http://localhost:3000')
FACTUS_WEBHOOK_SECRET  = config('FACTUS_WEBHOOK_SECRET', default='')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ── Usuario personalizado ─────────────────────────────────────────────────────
AUTH_USER_MODEL = 'usuarios.Usuario'
