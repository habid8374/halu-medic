"""Configuración de Celery para Halu Medic"""
import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('halu_medic')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()


# Tareas periódicas (Celery Beat)
from celery.schedules import crontab

app.conf.beat_schedule = {
    'reenviar-facturas-pendientes': {
        'task': 'apps.facturacion.tasks.reenviar_facturas_pendientes',
        'schedule': crontab(minute='*/10'),  # cada 10 minutos
    },
}
