from django.contrib import admin
from apps.tarifas.models import (
    ConvenioEPS, TarifaProcedimiento, ManualTarifario, ItemTarifario,
    GrupoQuirurgicoSOAT,
)


@admin.register(GrupoQuirurgicoSOAT)
class GrupoQuirurgicoSOATAdmin(admin.ModelAdmin):
    list_display  = ('grupo', 'smdlv_cirujano', 'smdlv_anestesiologo',
                     'smdlv_ayudante', 'smdlv_sala', 'smdlv_materiales', 'esta_configurado')
    list_editable = ('smdlv_cirujano', 'smdlv_anestesiologo',
                     'smdlv_ayudante', 'smdlv_sala', 'smdlv_materiales')
    ordering      = ('grupo',)

    @admin.display(boolean=True, description='Configurado')
    def esta_configurado(self, obj):
        return obj.configurado

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
