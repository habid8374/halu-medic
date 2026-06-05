"""
Admin de Consultorios (tenants) — schema público.
Permite al superadmin de Axentia configurar cada consultorio,
incluyendo sus credenciales Factus propias.
"""
from django.contrib import admin
from apps.tenants.models import Consultorio, Dominio


class DominioInline(admin.TabularInline):
    model = Dominio
    extra = 1


@admin.register(Consultorio)
class ConsultorioAdmin(admin.ModelAdmin):
    list_display  = ['nombre', 'nit', 'plan', 'activo', 'factus_configurado', 'fecha_vencimiento']
    list_filter   = ['plan', 'activo']
    search_fields = ['nombre', 'nit', 'codigo_prestador']
    inlines       = [DominioInline]
    readonly_fields = ['creado_en', 'actualizado_en', 'factus_configurado']

    fieldsets = (
        ('Identificación', {
            'fields': ('nombre', 'razon_social', 'nit', 'codigo_prestador',
                       'direccion', 'municipio_codigo', 'telefono', 'email'),
        }),
        ('Plan SaaS', {
            'fields': ('plan', 'activo', 'fecha_vencimiento'),
        }),
        ('Facturación electrónica Factus (propia del consultorio)', {
            'fields': ('factus_configurado', 'factus_base_url', 'factus_client_id',
                       'factus_client_secret', 'factus_username', 'factus_password',
                       'factus_rango_numeracion_id'),
            'description': 'Credenciales Factus exclusivas de este prestador. '
                           'Cada consultorio se habilita ante la DIAN con su propia cuenta.',
        }),
        ('Auditoría', {
            'fields': ('creado_en', 'actualizado_en'),
            'classes': ('collapse',),
        }),
    )


@admin.register(Dominio)
class DominioAdmin(admin.ModelAdmin):
    list_display  = ['domain', 'tenant', 'is_primary']
    search_fields = ['domain']
