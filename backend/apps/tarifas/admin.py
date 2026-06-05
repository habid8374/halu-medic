from django.contrib import admin
from apps.tarifas.models import ConvenioEPS, TarifaProcedimiento, ManualTarifario, ItemTarifario

@admin.register(ManualTarifario)
class ManualTarifarioAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'tipo', 'porcentaje_ajuste', 'es_predeterminado', 'activo')
    list_filter = ('tipo', 'activo', 'es_predeterminado')
    search_fields = ('nombre',)

@admin.register(ItemTarifario)
class ItemTarifarioAdmin(admin.ModelAdmin):
    list_display = ('cups', 'descripcion', 'valor_base', 'manual')
    list_filter = ('manual',)
    search_fields = ('cups', 'descripcion')
