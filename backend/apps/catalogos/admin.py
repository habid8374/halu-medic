from django.contrib import admin

from apps.catalogos.models import CodigoCUPS


@admin.register(CodigoCUPS)
class CodigoCUPSAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'descripcion', 'grupo_servicio', 'cobertura', 'codigo_reps')
    list_filter = ('cobertura', 'grupo_servicio')
    search_fields = ('codigo', 'descripcion', 'nombre_servicio')
