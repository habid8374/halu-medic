from django.contrib import admin

from apps.catalogos.models import CodigoCUPS, CodigoCIE10


@admin.register(CodigoCUPS)
class CodigoCUPSAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'descripcion', 'grupo_servicio', 'cobertura', 'codigo_reps')
    list_filter = ('cobertura', 'grupo_servicio')
    search_fields = ('codigo', 'descripcion', 'nombre_servicio')


@admin.register(CodigoCIE10)
class CodigoCIE10Admin(admin.ModelAdmin):
    list_display = ('codigo', 'nombre', 'descripcion', 'capitulo_codigo', 'sexo', 'habilitado')
    list_filter = ('habilitado', 'sexo', 'capitulo_codigo')
    search_fields = ('codigo', 'nombre', 'descripcion')
