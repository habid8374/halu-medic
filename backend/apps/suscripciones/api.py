"""
API de suscripciones (schema público — superadmin)
Endpoints:
  GET  /api/admin/suscripciones/              → listar todas las suscripciones
  POST /api/admin/suscripciones/              → crear suscripción para un consultorio
  GET  /api/admin/suscripciones/{id}/         → detalle
  PUT  /api/admin/suscripciones/{id}/         → actualizar plan / fecha
  POST /api/admin/suscripciones/{id}/renovar/ → renovar N meses
  GET  /api/admin/suscripciones/{id}/pagos/   → historial de pagos
"""
from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from datetime import timedelta, date

from apps.suscripciones.models import Suscripcion, HistorialPago, EstadoSuscripcion
from apps.usuarios.permissions import EsSuperadmin


class HistorialPagoSerializer(serializers.ModelSerializer):
    class Meta:
        model = HistorialPago
        fields = ['id', 'monto', 'moneda', 'referencia', 'metodo',
                  'estado', 'fecha', 'meses_pagados']
        read_only_fields = ['id', 'fecha']


class SuscripcionSerializer(serializers.ModelSerializer):
    consultorio_nombre = serializers.CharField(source='consultorio.nombre', read_only=True)
    esta_activa        = serializers.BooleanField(read_only=True)
    dias_restantes     = serializers.IntegerField(read_only=True)

    class Meta:
        model = Suscripcion
        fields = [
            'id', 'consultorio', 'consultorio_nombre',
            'plan', 'estado', 'fecha_inicio', 'fecha_fin', 'dias_gracia',
            'max_medicos', 'max_facturas_mes',
            'referencia_pago', 'metodo_pago',
            'esta_activa', 'dias_restantes',
            'creado_en', 'actualizado_en',
        ]
        read_only_fields = ['id', 'creado_en', 'actualizado_en']

    def create(self, validated_data):
        suscripcion = Suscripcion(**validated_data)
        suscripcion.aplicar_limites_plan()
        suscripcion.save()
        return suscripcion


class RenovarSerializer(serializers.Serializer):
    meses         = serializers.IntegerField(min_value=1, max_value=24, default=1)
    monto         = serializers.DecimalField(max_digits=12, decimal_places=2)
    referencia    = serializers.CharField(max_length=100)
    metodo        = serializers.CharField(max_length=50, default='manual')


class SuscripcionViewSet(viewsets.ModelViewSet):
    serializer_class   = SuscripcionSerializer
    permission_classes = [IsAuthenticated, EsSuperadmin]
    queryset           = Suscripcion.objects.select_related('consultorio').all()
    ordering           = ['-creado_en']

    @action(detail=True, methods=['post'])
    def renovar(self, request, pk=None):
        """
        POST /api/admin/suscripciones/{id}/renovar/
        Extiende la fecha_fin N meses y registra el pago.
        """
        suscripcion = self.get_object()
        serializer  = RenovarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        meses = datos['meses']
        hoy   = timezone.localdate()

        # Calcular nueva fecha fin (desde hoy si vencida, desde fecha_fin si activa)
        base = suscripcion.fecha_fin if (suscripcion.fecha_fin and suscripcion.fecha_fin >= hoy) else hoy
        nueva_fecha_fin = date(base.year + (base.month + meses - 1) // 12,
                               (base.month + meses - 1) % 12 + 1,
                               base.day)

        suscripcion.fecha_fin = nueva_fecha_fin
        suscripcion.estado    = EstadoSuscripcion.ACTIVA
        suscripcion.save(update_fields=['fecha_fin', 'estado', 'actualizado_en'])

        HistorialPago.objects.create(
            suscripcion=suscripcion,
            monto=datos['monto'],
            referencia=datos['referencia'],
            metodo=datos['metodo'],
            estado='aprobado',
            meses_pagados=meses,
        )

        return Response({
            'mensaje': f'Suscripción renovada {meses} mes(es). Nueva fecha fin: {nueva_fecha_fin}',
            'fecha_fin': str(nueva_fecha_fin),
            'estado': suscripcion.estado,
        })

    @action(detail=True, methods=['get'])
    def pagos(self, request, pk=None):
        """GET /api/admin/suscripciones/{id}/pagos/ — historial de pagos."""
        suscripcion = self.get_object()
        pagos = suscripcion.pagos.all()
        serializer = HistorialPagoSerializer(pagos, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def suspender(self, request, pk=None):
        """POST /api/admin/suscripciones/{id}/suspender/ — suspende manualmente."""
        suscripcion = self.get_object()
        suscripcion.estado = EstadoSuscripcion.SUSPENDIDA
        suscripcion.save(update_fields=['estado', 'actualizado_en'])
        return Response({'mensaje': 'Suscripción suspendida.'})

    @action(detail=True, methods=['post'])
    def activar(self, request, pk=None):
        """POST /api/admin/suscripciones/{id}/activar/ — reactiva una suscripción suspendida."""
        suscripcion = self.get_object()
        suscripcion.estado = EstadoSuscripcion.ACTIVA
        suscripcion.save(update_fields=['estado', 'actualizado_en'])
        return Response({'mensaje': 'Suscripción activada.'})
