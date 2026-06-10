from django.apps import AppConfig


class HistoriaConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.historia'
    verbose_name = 'Historia Clínica'

    def ready(self):
        import apps.historia.signals  # noqa
