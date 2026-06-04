from django.contrib import admin
from apps.suscripciones.models import Suscripcion, HistorialPago


class HistorialPagoInline(admin.TabularInline):
    model = HistorialPago
    extra = 0
    readonly_fields = ['fecha']
    fields = ['monto', 'moneda', 'referencia', 'metodo', 'estado', 'meses_pagados', 'fecha']


@admin.register(Suscripcion)
class SuscripcionAdmin(admin.ModelAdmin):
    list_display  = ['consultorio', 'plan', 'estado', 'fecha_fin', 'esta_activa', 'dias_restantes']
    list_filter   = ['plan', 'estado']
    search_fields = ['consultorio__nombre', 'consultorio__nit']
    inlines       = [HistorialPagoInline]
    readonly_fields = ['creado_en', 'actualizado_en', 'esta_activa', 'dias_restantes']


@admin.register(HistorialPago)
class HistorialPagoAdmin(admin.ModelAdmin):
    list_display  = ['suscripcion', 'monto', 'estado', 'metodo', 'fecha']
    list_filter   = ['estado', 'metodo']
    search_fields = ['suscripcion__consultorio__nombre', 'referencia']
    readonly_fields = ['fecha']
