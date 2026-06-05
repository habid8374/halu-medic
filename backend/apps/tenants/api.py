"""
API de configuración del consultorio actual (tenant).
Permite al admin del consultorio ver y actualizar sus datos,
incluyendo sus credenciales Factus propias.

El consultorio activo se obtiene de connection.tenant (django-tenants).
"""
from rest_framework import serializers
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import connection

from apps.usuarios.permissions import EsAdminOSuperadmin


class ConfiguracionConsultorioSerializer(serializers.Serializer):
    # Datos básicos
    nombre           = serializers.CharField(required=False)
    razon_social     = serializers.CharField(required=False, allow_blank=True)
    nit              = serializers.CharField(required=False)
    codigo_prestador = serializers.CharField(required=False, allow_blank=True)
    direccion        = serializers.CharField(required=False, allow_blank=True)
    municipio_codigo = serializers.CharField(required=False, allow_blank=True)
    telefono         = serializers.CharField(required=False, allow_blank=True)
    email            = serializers.EmailField(required=False, allow_blank=True)

    # Credenciales Factus (write_only el secreto y password por seguridad)
    factus_base_url            = serializers.CharField(required=False, allow_blank=True)
    factus_client_id           = serializers.CharField(required=False, allow_blank=True)
    factus_client_secret       = serializers.CharField(required=False, allow_blank=True, write_only=True)
    factus_username            = serializers.CharField(required=False, allow_blank=True)
    factus_password            = serializers.CharField(required=False, allow_blank=True, write_only=True)
    factus_rango_numeracion_id = serializers.IntegerField(required=False, allow_null=True)

    # Resolución DIAN y numeración de la factura
    resolucion_dian            = serializers.CharField(required=False, allow_blank=True)
    resolucion_fecha           = serializers.DateField(required=False, allow_null=True)
    factura_prefijo            = serializers.CharField(required=False, allow_blank=True)
    factura_rango_desde        = serializers.IntegerField(required=False, allow_null=True)
    factura_rango_hasta        = serializers.IntegerField(required=False, allow_null=True)
    factura_leyenda            = serializers.CharField(required=False, allow_blank=True)


class ConfiguracionConsultorioView(APIView):
    """
    GET  /api/consultorio/configuracion/  → datos del consultorio actual
    PUT  /api/consultorio/configuracion/  → actualizar datos y credenciales Factus
    """
    permission_classes = [IsAuthenticated, EsAdminOSuperadmin]

    CAMPOS_EDITABLES = [
        'nombre', 'razon_social', 'nit', 'codigo_prestador', 'direccion',
        'municipio_codigo', 'telefono', 'email',
        'factus_base_url', 'factus_client_id', 'factus_client_secret',
        'factus_username', 'factus_password', 'factus_rango_numeracion_id',
        'resolucion_dian', 'resolucion_fecha', 'factura_prefijo',
        'factura_rango_desde', 'factura_rango_hasta', 'factura_leyenda',
    ]

    def get(self, request):
        c = connection.tenant
        return Response({
            'nombre':           c.nombre,
            'razon_social':     c.razon_social,
            'nit':              c.nit,
            'codigo_prestador': c.codigo_prestador,
            'direccion':        c.direccion,
            'municipio_codigo': c.municipio_codigo,
            'telefono':         c.telefono,
            'email':            c.email,
            'plan':             c.plan,
            # Factus: nunca devolvemos secret ni password en claro
            'factus_base_url':            c.factus_base_url,
            'factus_client_id':           c.factus_client_id,
            'factus_username':            c.factus_username,
            'factus_rango_numeracion_id': c.factus_rango_numeracion_id,
            'factus_configurado':         c.factus_configurado,
            # Resolución DIAN y numeración
            'resolucion_dian':     c.resolucion_dian,
            'resolucion_fecha':    c.resolucion_fecha,
            'factura_prefijo':     c.factura_prefijo,
            'factura_rango_desde': c.factura_rango_desde,
            'factura_rango_hasta': c.factura_rango_hasta,
            'factura_leyenda':     c.factura_leyenda,
        })

    def put(self, request):
        serializer = ConfiguracionConsultorioSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        c = connection.tenant
        cambiados = []
        for campo, valor in serializer.validated_data.items():
            if campo in self.CAMPOS_EDITABLES:
                setattr(c, campo, valor)
                cambiados.append(campo)

        if cambiados:
            c.save(update_fields=cambiados + ['actualizado_en'])
            # Invalidar token Factus cacheado si cambiaron credenciales
            if any(campo.startswith('factus_') for campo in cambiados):
                from django.core.cache import cache
                cache.delete(f'factus_access_token::{c.schema_name}')

        return Response({
            'mensaje': 'Configuración actualizada correctamente.',
            'factus_configurado': c.factus_configurado,
        })
