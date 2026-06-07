"""
API REST — Serializers y ViewSets principales
Endpoints disponibles:
  /api/pacientes/
  /api/citas/
  /api/consultas/
  /api/facturacion/facturas/
  /api/facturacion/facturas/{id}/emitir/
"""
from rest_framework import serializers, viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone

# ── PACIENTES ─────────────────────────────────────────────────────────────────

from apps.pacientes.models import Paciente, Aseguradora
from apps.tarifas.models import ManualTarifario


class AseguradoraSerializer(serializers.ModelSerializer):
    tarifario_nombre     = serializers.CharField(source='tarifario.nombre', read_only=True, default='')
    tarifario_porcentaje = serializers.DecimalField(
        source='tarifario.porcentaje_ajuste', read_only=True,
        max_digits=6, decimal_places=2, default=None,
    )

    class Meta:
        model = Aseguradora
        fields = [
            'id', 'nombre', 'nit', 'codigo', 'tipo', 'activa',
            'tarifario', 'tarifario_nombre', 'tarifario_porcentaje',
        ]


class AseguradoraViewSet(viewsets.ModelViewSet):
    serializer_class = AseguradoraSerializer

    def get_queryset(self):
        qs = Aseguradora.objects.select_related('tarifario')
        todas = self.request.query_params.get('todas')
        if todas:
            return qs
        return qs.filter(activa=True)


from apps.tarifas.models import ConvenioEPS


class ConvenioEPSSerializer(serializers.ModelSerializer):
    aseguradora_nombre = serializers.CharField(source='aseguradora.nombre', read_only=True)
    aseguradora_nit    = serializers.CharField(source='aseguradora.nit', read_only=True)

    class Meta:
        model = ConvenioEPS
        fields = [
            'id', 'aseguradora', 'aseguradora_nombre', 'aseguradora_nit',
            'numero_contrato', 'vigencia_desde', 'vigencia_hasta',
            'cucon', 'tipo_tarifa', 'porcentaje_copago',
            'valor_cuota_moderadora', 'activo', 'observaciones',
        ]


class ConvenioEPSViewSet(viewsets.ModelViewSet):
    serializer_class = ConvenioEPSSerializer

    def get_queryset(self):
        return ConvenioEPS.objects.select_related('aseguradora').all()


class PacienteSerializer(serializers.ModelSerializer):
    aseguradora_nombre = serializers.CharField(source='aseguradora.nombre', read_only=True)
    nombre_completo    = serializers.CharField(read_only=True)
    tarifa             = serializers.PrimaryKeyRelatedField(
        queryset=ManualTarifario.objects.all(),
        allow_null=True, required=False
    )
    tarifa_nombre      = serializers.CharField(source='tarifa.nombre', read_only=True, default='')

    class Meta:
        model = Paciente
        fields = [
            'id', 'tipo_identificacion', 'numero_identificacion',
            'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido',
            'nombre_completo', 'fecha_nacimiento', 'sexo',
            'email', 'telefono', 'direccion', 'municipio_codigo',
            'regimen', 'aseguradora', 'aseguradora_nombre', 'numero_poliza',
            'tarifa', 'tarifa_nombre',
            'activo', 'creado_en',
        ]
        read_only_fields = ['id', 'creado_en']


class PacienteViewSet(viewsets.ModelViewSet):
    serializer_class = PacienteSerializer
    search_fields = ['numero_identificacion', 'primer_apellido', 'primer_nombre', 'email']
    ordering_fields = ['primer_apellido', 'creado_en']
    ordering = ['primer_apellido']

    def get_queryset(self):
        return Paciente.objects.select_related('aseguradora').filter(activo=True)


# ── CITAS ─────────────────────────────────────────────────────────────────────

from apps.citas.models import Cita, Medico, Especialidad, Sala


class CitaSerializer(serializers.ModelSerializer):
    paciente_nombre = serializers.CharField(source='paciente.nombre_completo', read_only=True)
    medico_nombre   = serializers.CharField(source='medico.usuario.get_full_name', read_only=True)
    duracion_minutos = serializers.IntegerField(read_only=True)

    class Meta:
        model = Cita
        fields = [
            'id', 'paciente', 'paciente_nombre', 'medico', 'medico_nombre',
            'especialidad', 'sala', 'convenio',
            'fecha_hora_inicio', 'fecha_hora_fin', 'duracion_minutos',
            'estado', 'motivo_consulta', 'observaciones', 'creado_en',
        ]
        read_only_fields = ['id', 'creado_en']

    def validate(self, data):
        inicio = data.get('fecha_hora_inicio')
        fin    = data.get('fecha_hora_fin')
        if inicio and fin and fin <= inicio:
            raise serializers.ValidationError('La hora de fin debe ser posterior a la de inicio.')

        # Verificar disponibilidad del médico
        medico = data.get('medico')
        if medico and inicio and fin:
            solapadas = Cita.objects.filter(
                medico=medico,
                fecha_hora_inicio__lt=fin,
                fecha_hora_fin__gt=inicio,
                estado__in=['programada', 'confirmada', 'en_curso'],
            )
            if self.instance:
                solapadas = solapadas.exclude(id=self.instance.id)
            if solapadas.exists():
                raise serializers.ValidationError('El médico ya tiene una cita en ese horario.')
        return data


class CitaViewSet(viewsets.ModelViewSet):
    serializer_class = CitaSerializer
    search_fields = ['paciente__primer_apellido', 'paciente__numero_identificacion']
    ordering_fields = ['fecha_hora_inicio', 'estado']
    ordering = ['fecha_hora_inicio']

    def get_queryset(self):
        qs = Cita.objects.select_related('paciente', 'medico__usuario', 'sala', 'especialidad')
        # Filtros opcionales por query params
        fecha = self.request.query_params.get('fecha')
        medico_id = self.request.query_params.get('medico')
        if fecha:
            qs = qs.filter(fecha_hora_inicio__date=fecha)
        if medico_id:
            qs = qs.filter(medico_id=medico_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(creado_por=self.request.user)


# ── CONSULTAS ─────────────────────────────────────────────────────────────────

from apps.consultas.models import Consulta, Procedimiento, OrdenMedica
from apps.citas.models import Medico as MedicoModel


class ProcedimientoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Procedimiento
        fields = ['id', 'cups', 'descripcion', 'valor_facturar',
                  'ambito', 'finalidad', 'personal_atiende', 'cantidad']


class ConsultaSerializer(serializers.ModelSerializer):
    procedimientos  = ProcedimientoSerializer(many=True, required=False)
    valor_total     = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    paciente_nombre = serializers.CharField(source='paciente.nombre_completo', read_only=True)
    medico          = serializers.PrimaryKeyRelatedField(
        queryset=MedicoModel.objects.all(), allow_null=True, required=False
    )

    class Meta:
        model = Consulta
        fields = [
            'id', 'cita', 'paciente', 'paciente_nombre', 'medico', 'convenio',
            'fecha_atencion', 'cups_principal', 'descripcion_cups',
            'diagnostico_principal', 'diagnostico_relacionado_1',
            'diagnostico_relacionado_2', 'diagnostico_relacionado_3',
            'tipo_diagnostico', 'motivo_consulta', 'enfermedad_actual',
            'examen_fisico', 'plan_tratamiento', 'observaciones',
            'numero_autorizacion', 'modalidad', 'grupo_servicio',
            'finalidad', 'causa_atencion',
            'valor_consulta', 'valor_copago', 'valor_total',
            'procedimientos', 'estado', 'creado_en',
        ]
        read_only_fields = ['id', 'creado_en', 'estado']

    def create(self, validated_data):
        procedimientos_data = validated_data.pop('procedimientos', [])
        consulta = Consulta.objects.create(**validated_data)
        for proc_data in procedimientos_data:
            Procedimiento.objects.create(consulta=consulta, **proc_data)
        return consulta

    def update(self, instance, validated_data):
        procedimientos_data = validated_data.pop('procedimientos', None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if procedimientos_data is not None:
            instance.procedimientos.all().delete()
            for proc_data in procedimientos_data:
                Procedimiento.objects.create(consulta=instance, **proc_data)
        return instance


class ConsultaViewSet(viewsets.ModelViewSet):
    serializer_class = ConsultaSerializer
    search_fields = ['paciente__primer_apellido', 'paciente__numero_identificacion',
                     'diagnostico_principal', 'cups_principal']
    ordering = ['-fecha_atencion']

    def get_queryset(self):
        return Consulta.objects.select_related(
            'paciente', 'medico__usuario', 'convenio'
        ).prefetch_related('procedimientos')

    def perform_create(self, serializer):
        serializer.save(creado_por=self.request.user)


# ── FACTURACIÓN ───────────────────────────────────────────────────────────────

from apps.facturacion.models import Factura, EstadoFactura


class FacturaSerializer(serializers.ModelSerializer):
    consulta_info = serializers.SerializerMethodField()
    tiene_rips    = serializers.SerializerMethodField()
    numero_hc     = serializers.SerializerMethodField()
    historia_info = serializers.SerializerMethodField()

    class Meta:
        model = Factura
        fields = [
            'id', 'consulta', 'consulta_info', 'historia', 'historia_info', 'numero_hc',
            'convenio', 'numero_factus', 'cufe', 'qr_url',
            'subtotal', 'descuento', 'iva', 'total', 'valor_copago',
            'estado', 'errores_dian', 'tiene_rips', 'cuv',
            'fecha_validacion', 'creado_en', 'medio_pago',
        ]
        read_only_fields = [
            'id', 'numero_factus', 'cufe', 'qr_url', 'pdf_base64',
            'estado', 'errores_dian', 'cuv', 'fecha_validacion', 'creado_en',
        ]

    def get_numero_hc(self, obj):
        if obj.historia_id:
            return obj.historia.numero_hc
        try:
            return obj.consulta.historia.numero_hc
        except Exception:
            return None

    def get_historia_info(self, obj):
        h = obj.historia
        if not h:
            return None
        return {
            'id':          str(h.id),
            'numero_hc':   h.numero_hc,
            'fecha':       h.fecha_atencion.strftime('%Y-%m-%d') if h.fecha_atencion else None,
            'tipo':        h.tipo_registro,
            'diagnostico': h.diagnostico_principal,
        }

    def get_consulta_info(self, obj):
        consulta = obj.consulta
        paciente = consulta.paciente
        convenio = obj.convenio

        # Items: consulta principal + procedimientos
        items = []
        if consulta.valor_consulta and float(consulta.valor_consulta) > 0:
            items.append({
                'cups':        consulta.cups_principal,
                'descripcion': consulta.descripcion_cups or f'Consulta {consulta.cups_principal}',
                'cantidad':    1,
                'valor_unit':  float(consulta.valor_consulta),
                'total':       float(consulta.valor_consulta),
            })
        for proc in consulta.procedimientos.all():
            items.append({
                'cups':        proc.cups,
                'descripcion': proc.descripcion,
                'cantidad':    int(proc.cantidad),
                'valor_unit':  float(proc.valor_facturar),
                'total':       float(proc.valor_facturar) * int(proc.cantidad),
            })

        # Datos del consultorio (tenant)
        from django.db import connection
        tenant = getattr(connection, 'tenant', None)

        return {
            'paciente':          paciente.nombre_completo,
            'paciente_doc':      f'{paciente.tipo_identificacion}: {paciente.numero_identificacion}',
            'fecha':             consulta.fecha_atencion,
            'cups':              consulta.cups_principal,
            'diagnostico':       consulta.diagnostico_principal,
            'medico':            consulta.medico.usuario.get_full_name() if consulta.medico else '',
            'num_autorizacion':  consulta.numero_autorizacion or '',
            'items':             items,
            # EPS / convenio
            'eps_nombre':        convenio.aseguradora.nombre if convenio else '',
            'eps_nit':           convenio.aseguradora.nit if convenio else '',
            'regimen':           paciente.regimen,
            'num_contrato':      convenio.numero_contrato if convenio else '',
            'a_cobrar_eps':      float(obj.total) - float(obj.valor_copago or 0),
            'convenio_cucon':    convenio.cucon if convenio else '',
            # Consultorio
            'consultorio_nombre':        getattr(tenant, 'nombre', '') if tenant else '',
            'consultorio_nit':           getattr(tenant, 'nit', '') if tenant else '',
            'consultorio_cod_prestador': getattr(tenant, 'codigo_prestador', '') if tenant else '',
            'consultorio_direccion':     getattr(tenant, 'direccion', '') if tenant else '',
            'consultorio_tel':           getattr(tenant, 'telefono', '') if tenant else '',
        }

    def get_tiene_rips(self, obj):
        return obj.rips_json is not None


class FacturaViewSet(viewsets.ModelViewSet):
    serializer_class = FacturaSerializer
    ordering = ['-creado_en']
    search_fields = [
        'numero_factus', 'cufe',
        'consulta__paciente__numero_identificacion',
        'historia__paciente__numero_identificacion',
        'historia__numero_hc',
    ]

    def get_queryset(self):
        qs = Factura.objects.select_related('consulta__paciente', 'historia__paciente', 'convenio')
        historia_id = self.request.query_params.get('historia')
        if historia_id:
            qs = qs.filter(historia_id=historia_id)
        convenio = self.request.query_params.get('convenio')
        if convenio:
            qs = qs.filter(convenio_id=convenio)
        fecha_desde = self.request.query_params.get('fecha_desde')
        if fecha_desde:
            qs = qs.filter(creado_en__date__gte=fecha_desde)
        fecha_hasta = self.request.query_params.get('fecha_hasta')
        if fecha_hasta:
            qs = qs.filter(creado_en__date__lte=fecha_hasta)
        return qs

    def perform_create(self, serializer):
        """Al crear la factura, calcula totales desde la consulta."""
        consulta = serializer.validated_data['consulta']
        total = consulta.valor_total
        serializer.save(
            subtotal=total,
            total=total,
            valor_copago=consulta.valor_copago,
            convenio=consulta.convenio,
        )

    @action(detail=False, methods=['get'], url_path='pendientes')
    def pendientes(self, request):
        """
        GET /api/facturacion/facturas/pendientes/
        Retorna HCs sin factura para poder facturarlas.
        Filtra por: documento, numero_hc, convenio_id, fecha_desde, fecha_hasta
        """
        from django.db.models import Q

        qs = HistoriaClinica.objects.select_related(
            'paciente', 'ingreso'
        ).filter(
            facturas__isnull=True  # sin factura aún
        )

        doc = request.query_params.get('documento')
        if doc:
            qs = qs.filter(paciente__numero_identificacion__icontains=doc)

        num_hc = request.query_params.get('numero_hc')
        if num_hc:
            qs = qs.filter(numero_hc=num_hc)

        fecha_desde = request.query_params.get('fecha_desde')
        if fecha_desde:
            qs = qs.filter(fecha_atencion__date__gte=fecha_desde)

        fecha_hasta = request.query_params.get('fecha_hasta')
        if fecha_hasta:
            qs = qs.filter(fecha_atencion__date__lte=fecha_hasta)

        class HCPendienteSerializer(serializers.ModelSerializer):
            paciente_nombre = serializers.CharField(source='paciente.nombre_completo', read_only=True)
            paciente_doc    = serializers.CharField(source='paciente.numero_identificacion', read_only=True)
            class Meta:
                model  = HistoriaClinica
                fields = ['id', 'numero_hc', 'fecha_atencion', 'tipo_registro',
                          'diagnostico_principal', 'paciente_nombre', 'paciente_doc']

        return Response(HCPendienteSerializer(qs.order_by('-fecha_atencion')[:100], many=True).data)

    @action(detail=True, methods=['post'])
    def emitir(self, request, pk=None):
        """
        POST /api/facturacion/facturas/{id}/emitir/
        Dispara la tarea Celery para emitir la FEV ante la DIAN vía Factus.
        """
        factura = self.get_object()

        if factura.estado == EstadoFactura.VALIDADA:
            return Response(
                {'error': 'Esta factura ya fue validada por la DIAN.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if factura.estado == EstadoFactura.ANULADA:
            return Response(
                {'error': 'No se puede emitir una factura anulada.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from apps.facturacion.tasks import emitir_factura
        factura.estado = EstadoFactura.ENVIADA
        factura.save(update_fields=['estado'])

        task = emitir_factura.delay(str(factura.id))

        return Response({
            'mensaje': 'Factura enviada a procesamiento. Recibirás el CUFE en breve.',
            'task_id': task.id,
            'factura_id': str(factura.id),
        }, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=['get'])
    def rips(self, request, pk=None):
        """
        GET /api/facturacion/facturas/{id}/rips/
        Regenera el RIPS en tiempo real para incluir NIT y código prestador del tenant.
        """
        factura = self.get_object()
        if not factura.numero_factus:
            return Response(
                {'error': 'RIPS no disponible: la factura aún no ha sido validada por la DIAN.'},
                status=status.HTTP_404_NOT_FOUND
            )
        try:
            from apps.rips.generador import GeneradorRIPS
            gen = GeneradorRIPS(factura)
            rips = gen.generar()
            # Guardar la versión actualizada
            factura.rips_json = rips
            factura.save(update_fields=['rips_json'])
            return Response(rips)
        except Exception as e:
            # Si falla regeneración, devolver el guardado si existe
            if factura.rips_json:
                return Response(factura.rips_json)
            return Response(
                {'error': f'Error generando RIPS: {e}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        """
        GET /api/facturacion/facturas/{id}/pdf/
        Devuelve el PDF en base64 para descarga en el frontend.
        Si no está almacenado, lo obtiene de Factus por numero_factus.
        """
        factura = self.get_object()

        # Si no hay PDF almacenado pero hay numero_factus, intentar obtenerlo de Factus
        if not factura.pdf_base64 and factura.numero_factus:
            try:
                from apps.facturacion.factus_client import FactusClient, FactusAPIError
                with FactusClient() as client:
                    data_factus = client.consultar_factura(factura.numero_factus)
                pdf_b64 = data_factus.get('pdf_base_64') or data_factus.get('pdf_base64') or ''
                if pdf_b64:
                    factura.pdf_base64 = pdf_b64
                    factura.save(update_fields=['pdf_base64'])
            except Exception as e:
                logger.warning(f'No se pudo obtener PDF de Factus para {factura.numero_factus}: {e}')

        if not factura.pdf_base64:
            return Response(
                {'error': 'PDF no disponible. La factura aún no ha sido validada o Factus no lo retornó.'},
                status=status.HTTP_404_NOT_FOUND
            )
        return Response({
            'numero': factura.numero_factus,
            'pdf_base64': factura.pdf_base64,
            'cufe': factura.cufe,
        })

    @action(detail=True, methods=['post'])
    def anular(self, request, pk=None):
        """
        POST /api/facturacion/facturas/{id}/anular/
        Emite una nota crédito en Factus para anular la factura ante la DIAN.
        Body: { "motivo": "Texto del motivo de anulación" }
        """
        factura = self.get_object()

        if factura.estado != EstadoFactura.VALIDADA:
            return Response(
                {'error': 'Solo se pueden anular facturas validadas por la DIAN.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        motivo = request.data.get('motivo', '').strip()
        if not motivo:
            return Response(
                {'error': 'El motivo de anulación es requerido.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from apps.facturacion.factus_client import FactusClient, FactusAPIError
        payload = {
            'bill_id': factura.numero_factus,
            'correction_concept_id': 2,  # 2 = Anulación de factura
            'observation': motivo,
        }

        try:
            with FactusClient() as client:
                resultado = client.crear_nota_credito(payload)

            factura.estado = EstadoFactura.ANULADA
            factura.observaciones = f'Anulada: {motivo}'
            factura.save(update_fields=['estado', 'observaciones'])

            factura.consulta.estado = 'anulada'
            factura.consulta.save(update_fields=['estado'])

            return Response({
                'mensaje': 'Factura anulada correctamente ante la DIAN.',
                'nota_credito': resultado.get('number', ''),
                'cufe_nc': resultado.get('cufe', ''),
            })

        except FactusAPIError as e:
            return Response(
                {'error': f'Error al anular en Factus: {str(e)}', 'detalle': e.errors},
                status=status.HTTP_502_BAD_GATEWAY
            )

    @action(detail=True, methods=['get'])
    def xml(self, request, pk=None):
        """
        GET /api/facturacion/facturas/{id}/xml/
        Devuelve el XML DIAN en base64.
        """
        factura = self.get_object()
        if not factura.xml_base64:
            return Response(
                {'error': 'XML no disponible. La factura aún no ha sido validada.'},
                status=status.HTTP_404_NOT_FOUND
            )
        return Response({
            'numero': factura.numero_factus,
            'xml_base64': factura.xml_base64,
            'cufe': factura.cufe,
        })

    @action(detail=True, methods=['post'])
    def sincronizar(self, request, pk=None):
        """
        POST /api/facturacion/facturas/{id}/sincronizar/
        Consulta el estado actual en Factus y actualiza la BD.
        Útil cuando la factura quedó en estado ENVIADA sin respuesta.
        """
        factura = self.get_object()

        if not factura.numero_factus:
            return Response(
                {'error': 'La factura aún no tiene número asignado por Factus.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from apps.facturacion.factus_client import FactusClient, FactusAPIError
        from django.utils import timezone as tz

        try:
            with FactusClient() as client:
                resultado = client.consultar_factura(factura.numero_factus)

            factus_status = resultado.get('status', '')
            if factus_status == 'validated':
                factura.cufe             = resultado.get('cufe', factura.cufe)
                factura.qr_url           = resultado.get('qr', factura.qr_url)
                factura.pdf_base64       = resultado.get('pdf_base_64', factura.pdf_base64)
                factura.xml_base64       = resultado.get('xml_base_64', factura.xml_base64)
                factura.estado           = EstadoFactura.VALIDADA
                factura.fecha_validacion = tz.now()
                factura.errores_dian     = []
                factura.save()
            elif factus_status == 'rejected':
                factura.estado       = EstadoFactura.ERROR
                factura.errores_dian = resultado.get('errors', [])
                factura.save(update_fields=['estado', 'errores_dian'])

            return Response({
                'mensaje': 'Estado sincronizado con Factus.',
                'estado': factura.estado,
                'factus_status': factus_status,
            })

        except FactusAPIError as e:
            return Response(
                {'error': f'Error consultando Factus: {str(e)}'},
                status=status.HTTP_502_BAD_GATEWAY
            )

    @action(detail=True, methods=['post'])
    def reintentar(self, request, pk=None):
        """
        POST /api/facturacion/facturas/{id}/reintentar/
        Llama Factus directamente (sin Celery). Todo dentro de try/except
        para garantizar respuesta JSON incluso ante errores inesperados.
        """
        import traceback
        import logging
        from django.utils import timezone as tz
        logger = logging.getLogger(__name__)

        try:
            # Cargar con relaciones necesarias para GeneradorRIPS
            factura = Factura.objects.select_related(
                'consulta__paciente',
                'consulta__medico',
                'convenio__aseguradora',
            ).prefetch_related(
                'consulta__procedimientos',
            ).get(pk=pk)
        except Factura.DoesNotExist:
            return Response({'error': 'Factura no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        if factura.estado == EstadoFactura.VALIDADA:
            return Response(
                {'error': 'La factura ya fue validada por la DIAN.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if factura.estado == EstadoFactura.ANULADA:
            return Response(
                {'error': 'No se puede reintentar una factura anulada.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from apps.facturacion.factus_salud import FactusSaludClient, construir_payload_auto
            from apps.facturacion.factus_client import FactusAPIError
            from apps.rips.generador import GeneradorRIPS

            # Resetear estado
            factura.estado = EstadoFactura.BORRADOR
            factura.errores_dian = []
            factura.save(update_fields=['estado', 'errores_dian'])

            # 1. Enviar a Factus primero (Factus asigna el número de FEV)
            factura.estado = EstadoFactura.ENVIADA
            factura.save(update_fields=['estado'])

            payload = construir_payload_auto(factura)
            with FactusSaludClient() as client:
                resultado = client.crear_factura_salud(payload)

            # 2. Guardar resultado de Factus
            factura.numero_factus    = resultado.get('number', '')
            factura.cufe             = resultado.get('cufe', '')
            factura.qr_url           = resultado.get('qr', '')
            factura.pdf_base64       = resultado.get('pdf_base_64', '') or resultado.get('qr_image', '')
            factura.xml_base64       = resultado.get('xml_base_64', '')
            # Si tiene CUFE es validada. errors:{} vacío es truthy en Python — ignorar
            _errors = resultado.get('errors') or []
            if isinstance(_errors, dict): _errors = [f'{k}: {v}' for k, v in _errors.items()]
            factura.estado           = EstadoFactura.VALIDADA if factura.cufe else (EstadoFactura.ERROR if _errors else EstadoFactura.VALIDADA)
            factura.fecha_validacion = tz.now()
            factura.errores_dian     = _errors
            factura.save()

            # 3. Generar RIPS con el numFactura real (para reportar al MUV MinSalud)
            if factura.numero_factus:
                try:
                    gen  = GeneradorRIPS(factura)
                    rips = gen.generar()
                    factura.rips_json = rips
                    factura.save(update_fields=['rips_json'])
                except Exception as e_rips:
                    logger.warning(f'RIPS generación fallida (no crítico): {e_rips}')

            if factura.estado == EstadoFactura.VALIDADA:
                try:
                    factura.consulta.estado = 'facturada'
                    factura.consulta.save(update_fields=['estado'])
                except Exception:
                    pass

            return Response({
                'mensaje': 'Factura procesada.',
                'estado':  factura.estado,
                'numero':  factura.numero_factus,
                'cufe':    factura.cufe,
                'errores': factura.errores_dian,
            }, status=status.HTTP_200_OK)

        except Exception as e:
            tb = traceback.format_exc()
            logger.error(f'[reintentar] factura={pk} error={e}\n{tb}')
            # Intentar marcar la factura como error
            try:
                factura.estado = EstadoFactura.ERROR
                factura.errores_dian = [str(e)]
                factura.save(update_fields=['estado', 'errores_dian'])
            except Exception:
                pass
            return Response(
                {'error': str(e), 'tipo': type(e).__name__},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

# ── ÓRDENES MÉDICAS ───────────────────────────────────────────────────────────

from rest_framework.permissions import IsAuthenticated


class OrdenMedicaSerializer(serializers.ModelSerializer):
    tipo_label   = serializers.CharField(source='get_tipo_display', read_only=True)
    estado_label = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model = OrdenMedica
        fields = '__all__'
        read_only_fields = ['id', 'creado_en']


class OrdenMedicaViewSet(viewsets.ModelViewSet):
    serializer_class = OrdenMedicaSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['consulta', 'tipo', 'estado']
    search_fields = ['descripcion', 'cups', 'cum', 'cie10']

    def get_queryset(self):
        return OrdenMedica.objects.select_related('consulta__paciente').all()


# ── CATÁLOGO CUPS (homologador nacional, schema público compartido) ───────────

from apps.catalogos.models import CodigoCUPS


class CodigoCUPSSerializer(serializers.ModelSerializer):
    class Meta:
        model = CodigoCUPS
        fields = [
            'codigo', 'descripcion', 'nombre_servicio', 'grupo_servicio',
            'cobertura', 'codigo_reps', 'grupo_rips',
        ]


class CodigoCUPSViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Consulta del homologador CUPS (solo lectura).

    Autocompletado:  /api/cups/?search=consulta
    Por código:      /api/cups/012403/
    """
    serializer_class = CodigoCUPSSerializer
    ordering = ['codigo']

    def get_queryset(self):
        qs = CodigoCUPS.objects.all()
        q = self.request.query_params.get('search')
        if q:
            from django.db.models import Q
            qs = qs.filter(Q(codigo__icontains=q) | Q(descripcion__icontains=q) |
                           Q(nombre_servicio__icontains=q))
        return qs


# ── CATÁLOGO CIE-10 ───────────────────────────────────────────────────────────

from apps.catalogos.models import CodigoCIE10


class CodigoCIE10Serializer(serializers.ModelSerializer):
    class Meta:
        model = CodigoCIE10
        fields = [
            'codigo', 'nombre', 'descripcion', 'capitulo_codigo',
            'capitulo_desc', 'sexo', 'edad_minima', 'edad_maxima', 'habilitado',
        ]


class CodigoCIE10ViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Consulta del catálogo CIE-10 (solo lectura).

    Autocompletado:  /api/cie10/?search=colera
    Por código:      /api/cie10/A000/
    Solo habilitados: /api/cie10/?search=...  (filtro por defecto)
    """
    serializer_class = CodigoCIE10Serializer
    ordering = ['codigo']

    def get_queryset(self):
        qs = CodigoCIE10.objects.filter(habilitado=True)
        q = self.request.query_params.get('search')
        if q:
            from django.db.models import Q
            qs = qs.filter(Q(codigo__icontains=q) | Q(nombre__icontains=q) |
                           Q(descripcion__icontains=q))
        return qs


# ── FACTURACIÓN PGP / CAPITADO ────────────────────────────────────────────────

from apps.facturacion.models import FacturaPGP, EstadoFactura as _EstadoPGP


class FacturaPGPSerializer(serializers.ModelSerializer):
    convenio_info = serializers.SerializerMethodField()
    tiene_rips    = serializers.SerializerMethodField()

    class Meta:
        model  = FacturaPGP
        fields = [
            'id', 'convenio', 'convenio_info',
            'periodo_desde', 'periodo_hasta',
            'descripcion_contrato', 'numero_contrato_eps',
            'valor_total',
            'numero_factus', 'cufe', 'qr_url', 'cuv',
            'estado', 'errores_dian', 'tiene_rips',
            'fecha_validacion', 'creado_en',
        ]

    def get_convenio_info(self, obj):
        c = obj.convenio
        if not c:
            return {}
        return {
            'aseguradora_nombre': c.aseguradora.nombre if c.aseguradora else '',
            'aseguradora_nit':    c.aseguradora.nit    if c.aseguradora else '',
            'numero_contrato':    c.numero_contrato,
            'cucon':              c.cucon,
        }

    def get_tiene_rips(self, obj):
        return bool(obj.rips_json)


class FacturaPGPViewSet(viewsets.ModelViewSet):
    serializer_class = FacturaPGPSerializer

    def get_queryset(self):
        qs = FacturaPGP.objects.select_related('convenio__aseguradora').all()
        estado = self.request.query_params.get('estado')
        if estado:
            qs = qs.filter(estado=estado)
        convenio = self.request.query_params.get('convenio')
        if convenio:
            qs = qs.filter(convenio_id=convenio)
        aseguradora = self.request.query_params.get('aseguradora')
        if aseguradora:
            qs = qs.filter(convenio__aseguradora_id=aseguradora)
        fecha_desde = self.request.query_params.get('fecha_desde')
        if fecha_desde:
            qs = qs.filter(periodo_desde__gte=fecha_desde)
        fecha_hasta = self.request.query_params.get('fecha_hasta')
        if fecha_hasta:
            qs = qs.filter(periodo_hasta__lte=fecha_hasta)
        return qs

    @action(detail=True, methods=['post'])
    def reintentar(self, request, pk=None):
        import traceback, logging
        from django.utils import timezone as tz
        from apps.facturacion.factus_salud import FactusSaludClient, ModalidadPago, CoberturaSalud, OpSalud
        from apps.rips.generador_pgp import GeneradorRIPSPGP
        logger = logging.getLogger(__name__)

        try:
            factura = FacturaPGP.objects.select_related('convenio__aseguradora').get(pk=pk)
        except FacturaPGP.DoesNotExist:
            return Response({'error': 'Factura PGP no encontrada.'}, status=404)

        if factura.estado == _EstadoPGP.VALIDADA:
            return Response({'error': 'La factura ya fue validada por la DIAN.'}, status=400)
        if factura.estado == _EstadoPGP.ANULADA:
            return Response({'error': 'No se puede reintentar una factura anulada.'}, status=400)

        try:
            convenio  = factura.convenio
            aseg      = convenio.aseguradora

            # Resetear
            factura.estado = _EstadoPGP.BORRADOR
            factura.errores_dian = []
            factura.save(update_fields=['estado', 'errores_dian'])

            # Determinar op_type: PGP con convenio → SS-CUFE
            op_type = OpSalud.SS_CUFE if convenio.activo else OpSalud.SS_SIN_APORTE

            # Período de facturación
            desde = factura.periodo_desde
            hasta = factura.periodo_hasta

            # Rango numeración
            rango_id = factura.rango_numeracion_id
            if not rango_id:
                from django.db import connection as _conn
                _tenant = getattr(_conn, 'tenant', None)
                rango_id = getattr(_tenant, 'factus_rango_numeracion_id', None) if _tenant else None

            # NIT / código prestador
            from django.db import connection as _conn2
            _tenant2 = getattr(_conn2, 'tenant', None)
            _cod_prest = getattr(_tenant2, 'codigo_prestador', '') or ''

            payload = {
                'operation_type_id': op_type,
                'numbering_range_id': rango_id,
                'reference_code': str(factura.id),
                'observation': factura.descripcion_contrato,
                'payment_method_code': '10',
                'payment_details': [{
                    'payment_method_code': '10',
                    'payment_form': '1',
                    'due_date': hasta.strftime('%Y-%m-%d'),
                    'amount': float(factura.valor_total),
                }],
                'customer': {
                    'identification': aseg.nit,
                    'dv': '',
                    'company': aseg.nombre,
                    'trade_name': aseg.nombre,
                    'names': aseg.nombre,
                    'address': 'Colombia',
                    'email': '',
                    'phone': '',
                    'legal_organization_id': '1',
                    'tribute_id': '1',
                    'identification_document_code': '31',
                    'municipality_id': '11001',
                },
                'items': [{
                    'code_reference': 'PGP-001',
                    'name': factura.descripcion_contrato,
                    'quantity': 1,
                    'discount_rate': '0.00',
                    'price': float(factura.valor_total),
                    'tax_rate': '0.00',
                    'unit_measure_id': 70,
                    'standard_code_id': 1,
                    'is_excluded': 1,
                }],
                # Campos sector salud
                'health_coverage_code': CoberturaSalud.CONTRIBUTIVO,
                'health_modality_code': ModalidadPago.GLOBAL_PROSPECTIVO,
                'health_provider_code': _cod_prest,
                'health_document_type': '31',
                'health_document_number': aseg.nit,
                'health_first_name': aseg.nombre,
                'health_other_names': '',
                'health_last_name': '',
                'health_other_last_name': '',
                'health_billing_period_start_date': desde.strftime('%Y-%m-%d'),
                'health_billing_period_start_time': '00:00:00',
                'health_billing_period_end_date': hasta.strftime('%Y-%m-%d'),
                'health_billing_period_end_time': '23:59:59',
                'health_contract_number': factura.numero_contrato_eps or convenio.numero_contrato,
                'health_policy_number': '',
                'health_authorization_number': '',
                'health_cucon': convenio.cucon or '',
                'health_copay': 0,
                'health_moderation_fee': 0,
                'health_recovery_fee': 0,
                'health_volunteer_payments': 0,
            }

            factura.estado = _EstadoPGP.ENVIADA
            factura.save(update_fields=['estado'])

            with FactusSaludClient() as client:
                resultado = client.crear_factura_salud(payload)

            factura.numero_factus    = resultado.get('number', '')
            factura.cufe             = resultado.get('cufe', '')
            factura.qr_url           = resultado.get('qr', '')
            factura.pdf_base64       = resultado.get('pdf_base_64', '') or resultado.get('qr_image', '')
            factura.xml_base64       = resultado.get('xml_base_64', '')
            _errors = resultado.get('errors') or []
            if isinstance(_errors, dict):
                _errors = [f'{k}: {v}' for k, v in _errors.items()]
            factura.errores_dian     = _errors
            factura.estado           = _EstadoPGP.VALIDADA if factura.cufe else (
                                        _EstadoPGP.ERROR if _errors else _EstadoPGP.VALIDADA)
            factura.fecha_validacion = tz.now()
            factura.save()

            # Generar RIPS con valores en 0
            if factura.numero_factus:
                try:
                    rips = GeneradorRIPSPGP(factura).generar()
                    factura.rips_json = rips
                    factura.save(update_fields=['rips_json'])
                except Exception as e_rips:
                    logger.warning(f'RIPS PGP generación fallida: {e_rips}')

            return Response({
                'mensaje': 'Factura PGP procesada.',
                'estado':  factura.estado,
                'numero':  factura.numero_factus,
                'cufe':    factura.cufe,
                'errores': factura.errores_dian,
            })

        except Exception as e:
            tb = traceback.format_exc()
            logger.error(f'[pgp reintentar] factura={pk} error={e}\n{tb}')
            try:
                factura.estado = _EstadoPGP.ERROR
                factura.errores_dian = [str(e)]
                factura.save(update_fields=['estado', 'errores_dian'])
            except Exception:
                pass
            return Response({'error': str(e), 'tipo': type(e).__name__}, status=500)

    @action(detail=True, methods=['get'])
    def rips(self, request, pk=None):
        from apps.rips.generador_pgp import GeneradorRIPSPGP
        try:
            factura = FacturaPGP.objects.select_related('convenio__aseguradora').get(pk=pk)
        except FacturaPGP.DoesNotExist:
            return Response({'error': 'No encontrada.'}, status=404)
        if not factura.numero_factus:
            return Response({'error': 'La factura aún no tiene número asignado por Factus.'}, status=400)
        rips = GeneradorRIPSPGP(factura).generar()
        factura.rips_json = rips
        factura.save(update_fields=['rips_json'])
        return Response(rips)

    @action(detail=True, methods=['post'])
    def sincronizar(self, request, pk=None):
        import logging
        from django.utils import timezone as tz
        from apps.facturacion.factus_client import FactusClient
        logger = logging.getLogger(__name__)
        try:
            factura = FacturaPGP.objects.get(pk=pk)
        except FacturaPGP.DoesNotExist:
            return Response({'error': 'No encontrada.'}, status=404)
        if not factura.numero_factus:
            return Response({'error': 'Sin número Factus — usa reintentar.'}, status=400)
        try:
            with FactusClient() as client:
                data = client.get(f'/v2/bills/{factura.numero_factus}')
            resultado = data.get('data', data)
            factura.cufe             = resultado.get('cufe', factura.cufe)
            factura.qr_url           = resultado.get('qr', factura.qr_url)
            factura.pdf_base64       = resultado.get('pdf_base_64', factura.pdf_base64) or factura.pdf_base64
            _errors = resultado.get('errors') or []
            if isinstance(_errors, dict):
                _errors = [f'{k}: {v}' for k, v in _errors.items()]
            factura.errores_dian     = _errors
            factura.estado           = _EstadoPGP.VALIDADA if factura.cufe else (
                                        _EstadoPGP.ERROR if _errors else factura.estado)
            factura.fecha_validacion = tz.now() if factura.cufe else factura.fecha_validacion
            factura.save()
            return Response({'estado': factura.estado, 'cufe': factura.cufe, 'errores': factura.errores_dian})
        except Exception as e:
            logger.error(f'[pgp sincronizar] {e}')
            return Response({'error': str(e)}, status=500)


# ── HISTORIA CLÍNICA ──────────────────────────────────────────────────────────

from apps.historia.models import Ingreso, Egreso, HistoriaClinica, OrdenHC


class IngresoSerializer(serializers.ModelSerializer):
    paciente_nombre = serializers.SerializerMethodField()
    medico_nombre   = serializers.SerializerMethodField()
    tiene_egreso    = serializers.SerializerMethodField()
    egreso_info     = serializers.SerializerMethodField()

    class Meta:
        model  = Ingreso
        fields = [
            'id', 'numero_ingreso', 'paciente', 'paciente_nombre',
            'medico', 'medico_nombre', 'fecha_ingreso', 'motivo_ingreso',
            'tipo_atencion', 'observaciones', 'activo',
            'tiene_egreso', 'egreso_info', 'creado_en',
        ]

    def get_paciente_nombre(self, obj):
        return getattr(obj.paciente, 'nombre_completo', '') if obj.paciente else ''

    def get_medico_nombre(self, obj):
        return getattr(obj.medico, 'nombre_completo', '') if obj.medico else ''

    def get_tiene_egreso(self, obj):
        return hasattr(obj, 'egreso')

    def get_egreso_info(self, obj):
        if not hasattr(obj, 'egreso'):
            return None
        e = obj.egreso
        return {
            'id': str(e.id),
            'fecha_egreso': e.fecha_egreso,
            'tipo_egreso': e.tipo_egreso,
            'diagnostico_egreso': e.diagnostico_egreso,
        }


class EgresoSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Egreso
        fields = [
            'id', 'ingreso', 'fecha_egreso', 'tipo_egreso',
            'diagnostico_egreso', 'descripcion_diagnostico',
            'condicion_al_egreso', 'medico', 'observaciones', 'creado_en',
        ]


class HistoriaClinicaSerializer(serializers.ModelSerializer):
    medico_nombre   = serializers.SerializerMethodField()
    paciente_nombre = serializers.SerializerMethodField()

    class Meta:
        model  = HistoriaClinica
        fields = [
            'id', 'paciente', 'paciente_nombre', 'ingreso', 'consulta',
            'medico', 'medico_nombre', 'fecha_atencion', 'tipo_registro',
            'motivo_consulta', 'anamnesis', 'enfermedad_actual',
            'signos_vitales', 'examen_fisico', 'impresion_diagnostica',
            'diagnostico_principal', 'diagnostico_relacionado_1', 'diagnostico_relacionado_2',
            'plan_tratamiento', 'ordenes_medicas', 'observaciones',
            'creado_en', 'actualizado_en',
        ]

    def get_medico_nombre(self, obj):
        return getattr(obj.medico, 'nombre_completo', '') if obj.medico else ''

    def get_paciente_nombre(self, obj):
        return getattr(obj.paciente, 'nombre_completo', '') if obj.paciente else ''


class IngresoViewSet(viewsets.ModelViewSet):
    serializer_class = IngresoSerializer

    def get_queryset(self):
        qs = Ingreso.objects.select_related('paciente', 'medico').prefetch_related('egreso').all()
        paciente = self.request.query_params.get('paciente')
        activo   = self.request.query_params.get('activo')
        search   = self.request.query_params.get('search')
        if paciente:
            qs = qs.filter(paciente=paciente)
        if activo is not None:
            qs = qs.filter(activo=activo.lower() == 'true')
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(paciente__primer_nombre__icontains=search) |
                Q(paciente__primer_apellido__icontains=search) |
                Q(paciente__numero_identificacion__icontains=search)
            )
        return qs

    @action(detail=True, methods=['post'])
    def egresar(self, request, pk=None):
        """POST /api/ingresos/{id}/egresar/ — registra el egreso del paciente."""
        ingreso = self.get_object()
        if not ingreso.activo:
            return Response({'error': 'El paciente ya fue egresado.'}, status=400)
        if hasattr(ingreso, 'egreso'):
            return Response({'error': 'Ya existe un egreso para este ingreso.'}, status=400)
        ser = EgresoSerializer(data={**request.data, 'ingreso': str(ingreso.id)})
        ser.is_valid(raise_exception=True)
        egreso = ser.save()
        return Response(EgresoSerializer(egreso).data, status=201)


class EgresoViewSet(viewsets.ModelViewSet):
    serializer_class = EgresoSerializer

    def get_queryset(self):
        return Egreso.objects.select_related('ingreso__paciente', 'medico').all()


class HistoriaClinicaViewSet(viewsets.ModelViewSet):
    serializer_class = HistoriaClinicaSerializer

    def get_queryset(self):
        qs = HistoriaClinica.objects.select_related('paciente', 'medico', 'ingreso', 'consulta').all()
        paciente = self.request.query_params.get('paciente')
        ingreso  = self.request.query_params.get('ingreso')
        if paciente:
            qs = qs.filter(paciente=paciente)
        if ingreso:
            qs = qs.filter(ingreso=ingreso)
        return qs


# ── Catálogo de medicamentos (CUM) ────────────────────────────────────────────

class CatalogoMedicamentoSerializer(serializers.ModelSerializer):
    class Meta:
        from apps.catalogos.models import CatalogoMedicamento
        model  = CatalogoMedicamento
        fields = ['cum', 'principio_activo', 'concentracion', 'forma_farmaceutica',
                  'registro_sanitario', 'vigente']


class CatalogoMedicamentoViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CatalogoMedicamentoSerializer

    def get_queryset(self):
        from apps.catalogos.models import CatalogoMedicamento
        qs = CatalogoMedicamento.objects.all()
        search   = self.request.query_params.get('search', '').strip()
        vigentes = self.request.query_params.get('vigentes')
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(principio_activo__icontains=search) | Q(cum__icontains=search)
            )
        if vigentes is not None:
            qs = qs.filter(vigente=vigentes.lower() == 'true')
        return qs[:50]


# ── Medicamentos en Historia Clínica ─────────────────────────────────────────

class MedicamentoHCSerializer(serializers.ModelSerializer):
    class Meta:
        from apps.historia.models import MedicamentoHC
        model  = MedicamentoHC
        fields = [
            'id', 'historia', 'cum', 'principio_activo', 'concentracion',
            'forma_farmaceutica', 'dosis', 'frecuencia', 'via_administracion',
            'cantidad', 'dias_tratamiento', 'indicaciones',
            'genera_factura', 'valor_unitario', 'valor_dispensacion', 'creado_en',
        ]
        read_only_fields = ['id', 'creado_en']


class MedicamentoHCViewSet(viewsets.ModelViewSet):
    serializer_class = MedicamentoHCSerializer

    def get_queryset(self):
        from apps.historia.models import MedicamentoHC
        qs = MedicamentoHC.objects.select_related('historia').all()
        historia = self.request.query_params.get('historia')
        if historia:
            qs = qs.filter(historia=historia)
        return qs


class OrdenHCSerializer(serializers.ModelSerializer):
    tipo_label   = serializers.CharField(source='get_tipo_display', read_only=True)
    estado_label = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model  = OrdenHC
        fields = '__all__'
        read_only_fields = ['id', 'creado_en']


class OrdenHCViewSet(viewsets.ModelViewSet):
    serializer_class = OrdenHCSerializer

    def get_queryset(self):
        qs = OrdenHC.objects.select_related('historia__paciente').all()
        historia_id = self.request.query_params.get('historia')
        if historia_id:
            qs = qs.filter(historia_id=historia_id)
        estado = self.request.query_params.get('estado')
        if estado:
            qs = qs.filter(estado=estado)
        return qs


# ── Tarifas de medicamentos ───────────────────────────────────────────────────

class TarifaMedicamentoSerializer(serializers.ModelSerializer):
    valor_final = serializers.SerializerMethodField()

    class Meta:
        from apps.tarifas.models import TarifaMedicamento
        model  = TarifaMedicamento
        fields = [
            'id', 'manual', 'cum', 'principio_activo', 'concentracion',
            'forma_farmaceutica', 'valor_base', 'valor_dispensacion',
            'vigente', 'valor_final',
        ]

    def get_valor_final(self, obj):
        return float(obj.valor_final)


class TarifaMedicamentoViewSet(viewsets.ModelViewSet):
    serializer_class = TarifaMedicamentoSerializer

    def get_queryset(self):
        from apps.tarifas.models import TarifaMedicamento
        qs = TarifaMedicamento.objects.select_related('manual').all()
        manual  = self.request.query_params.get('manual')
        search  = self.request.query_params.get('search', '').strip()
        vigente = self.request.query_params.get('vigente')
        if manual:
            qs = qs.filter(manual=manual)
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(principio_activo__icontains=search) | Q(cum__icontains=search)
            )
        if vigente is not None:
            qs = qs.filter(vigente=vigente.lower() == 'true')
        return qs


# ═══════════════════════════════════════════════════════════════════════════════
# MÓDULO DE REPORTES
# ═══════════════════════════════════════════════════════════════════════════════

from rest_framework.views import APIView as _APIView
from apps.usuarios.permissions import EsAdminOSuperadmin as _EsAdmin


class ReportesView(_APIView):
    """
    GET /api/reportes/?tipo=...&fecha_desde=...&fecha_hasta=...
    Todos los métodos retornan estructura {tipo, periodo, items, ...KPIs}
    compatible con el frontend de reportes.
    """
    permission_classes = [IsAuthenticated, _EsAdmin]

    # alias cortos → nombre interno
    _ALIAS = {
        'resumen':    'resumen_general',
        'pendientes': 'pendientes_facturar',
        'glosas':     'glosas_errores',
    }

    def get(self, request):
        tipo        = request.query_params.get('tipo', 'resumen_general')
        tipo        = self._ALIAS.get(tipo, tipo)
        fecha_desde = request.query_params.get('fecha_desde', '')
        fecha_hasta = request.query_params.get('fecha_hasta', '')

        metodo = {
            'resumen_general':     self._resumen_general,
            'hc_facturacion':      self._hc_facturacion,
            'facturacion_periodo': self._facturacion_periodo,
            'pendientes_facturar': self._pendientes_facturar,
            'por_aseguradora':     self._por_aseguradora,
            'glosas_errores':      self._glosas_errores,
            'top_diagnosticos':    self._top_diagnosticos,
            'top_procedimientos':  self._top_procedimientos,
            'rips_estado':         self._rips_estado,
        }.get(tipo)

        if not metodo:
            return Response({'error': f'Tipo de reporte "{tipo}" no existe.'}, status=400)

        return Response(metodo(fecha_desde, fecha_hasta))

    # ── helpers ──────────────────────────────────────────────────────────────

    def _rango(self, qs, campo, fd, fh):
        if fd:
            qs = qs.filter(**{f'{campo}__date__gte': fd})
        if fh:
            qs = qs.filter(**{f'{campo}__date__lte': fh})
        return qs

    # ── 1. Resumen general ────────────────────────────────────────────────────

    def _resumen_general(self, fd, fh):
        from apps.historia.models import HistoriaClinica
        from apps.facturacion.models import Factura, EstadoFactura
        from apps.pacientes.models import Paciente
        from django.db.models import Sum

        hc_qs  = self._rango(HistoriaClinica.objects.all(), 'fecha_atencion', fd, fh)
        fev_qs = self._rango(Factura.objects.all(), 'creado_en', fd, fh)

        total_hc      = hc_qs.count()
        hc_facturadas = hc_qs.filter(facturas__isnull=False).distinct().count()
        hc_pendientes = total_hc - hc_facturadas
        fev_validadas = fev_qs.filter(estado=EstadoFactura.VALIDADA).count()
        fev_error     = fev_qs.filter(estado=EstadoFactura.ERROR).count()
        total_facturado = fev_qs.filter(estado=EstadoFactura.VALIDADA).aggregate(t=Sum('total'))['t'] or 0

        return {
            'tipo': 'resumen',
            'periodo': {'desde': fd, 'hasta': fh},
            'total_hc':           total_hc,
            'hc_facturadas':      hc_facturadas,
            'hc_pendientes':      hc_pendientes,
            'total_facturado':    float(total_facturado),
            'facturas_validadas': fev_validadas,
            'facturas_error':     fev_error,
            'total_pacientes':    Paciente.objects.count(),
            'pacientes_unicos':   Paciente.objects.count(),
        }

    # ── 2. HC con estado de facturación ───────────────────────────────────────

    def _hc_facturacion(self, fd, fh):
        from apps.historia.models import HistoriaClinica

        qs = self._rango(
            HistoriaClinica.objects.select_related('paciente')
            .prefetch_related('facturas'),
            'fecha_atencion', fd, fh
        ).order_by('-fecha_atencion')[:500]

        items = []
        for hc in qs:
            facturas = list(hc.facturas.all())
            if facturas:
                f = facturas[0]
                estado_factura = f.estado
                numero_factura = f.numero_factus or '—'
                valor_factura  = float(f.total)
                factura_id     = str(f.id)
            else:
                estado_factura = 'sin_factura'
                numero_factura = '—'
                valor_factura  = 0.0
                factura_id     = None

            items.append({
                'hc_id':         str(hc.id),
                'numero_hc':     f'HC-{str(hc.numero_hc).zfill(5)}' if hc.numero_hc else '—',
                'fecha_atencion': hc.fecha_atencion.strftime('%Y-%m-%d') if hc.fecha_atencion else '',
                'tipo_registro':  hc.get_tipo_registro_display() if hasattr(hc, 'get_tipo_registro_display') else hc.tipo_registro,
                'paciente':      str(hc.paciente),
                'documento':     hc.paciente.numero_identificacion,
                'diagnostico':   hc.diagnostico_principal or '—',
                'estado_factura': estado_factura,
                'numero_factura': numero_factura,
                'valor_factura':  valor_factura,
                'factura_id':    factura_id,
            })

        facturadas = sum(1 for r in items if r['estado_factura'] != 'sin_factura')
        return {
            'tipo': 'hc_facturacion',
            'periodo': {'desde': fd, 'hasta': fh},
            'count': len(items),
            'facturadas': facturadas,
            'pendientes': len(items) - facturadas,
            'items': items,
        }

    # ── 3. Facturas del período ───────────────────────────────────────────────

    def _facturacion_periodo(self, fd, fh):
        from apps.facturacion.models import Factura, EstadoFactura

        qs = self._rango(
            Factura.objects.select_related(
                'historia__paciente', 'consulta__paciente', 'convenio__aseguradora'
            ),
            'creado_en', fd, fh
        ).order_by('-creado_en')[:500]

        items = []
        for f in qs:
            if f.historia:
                pax    = str(f.historia.paciente)
                num_hc = f'HC-{str(f.historia.numero_hc).zfill(5)}' if f.historia.numero_hc else '—'
            elif f.consulta:
                pax    = str(f.consulta.paciente)
                num_hc = '—'
            else:
                pax = '—'; num_hc = '—'

            items.append({
                'factura_id':  str(f.id),
                'numero_factus': f.numero_factus or '—',
                'numero_hc':   num_hc,
                'fecha':       f.creado_en.strftime('%Y-%m-%d') if f.creado_en else '',
                'paciente':    pax,
                'aseguradora': f.convenio.aseguradora.nombre if f.convenio and f.convenio.aseguradora else 'Particular',
                'estado':      f.estado,
                'total':       float(f.total),
                'copago':      float(f.valor_copago),
                'cufe':        (f.cufe[:20] + '…') if f.cufe else '—',
                'tiene_cuv':   bool(f.cuv),
            })

        validadas = [r for r in items if r['estado'] == 'validada']
        return {
            'tipo':     'facturacion_periodo',
            'periodo':  {'desde': fd, 'hasta': fh},
            'count':    len(items),
            'total':    sum(r['total'] for r in validadas),
            'validadas': len(validadas),
            'error':    sum(1 for r in items if r['estado'] == 'error'),
            'anuladas': sum(1 for r in items if r['estado'] == 'anulada'),
            'items':    items,
        }

    # ── 4. HC sin factura ─────────────────────────────────────────────────────

    def _pendientes_facturar(self, fd, fh):
        from apps.historia.models import HistoriaClinica
        from django.utils import timezone

        qs = self._rango(
            HistoriaClinica.objects.select_related('paciente', 'paciente__aseguradora')
            .filter(facturas__isnull=True),
            'fecha_atencion', fd, fh
        ).order_by('fecha_atencion')[:500]

        hoy = timezone.now().date()
        items = []
        for hc in qs:
            fecha = hc.fecha_atencion.date() if hc.fecha_atencion else None
            dias  = (hoy - fecha).days if fecha else None
            items.append({
                'hc_id':              str(hc.id),
                'numero_hc':          f'HC-{str(hc.numero_hc).zfill(5)}' if hc.numero_hc else '—',
                'fecha_atencion':     str(fecha) if fecha else '',
                'dias_pendiente':     dias,
                'alerta':             'critico' if dias and dias > 30 else ('advertencia' if dias and dias > 15 else 'normal'),
                'paciente':           str(hc.paciente),
                'documento':          hc.paciente.numero_identificacion,
                'tipo':               hc.tipo_registro,
                'diagnostico_principal': hc.diagnostico_principal or '—',
                'aseguradora':        hc.paciente.aseguradora.nombre if hc.paciente.aseguradora else 'Particular',
            })

        return {
            'tipo':     'pendientes_facturar',
            'periodo':  {'desde': fd, 'hasta': fh},
            'count':    len(items),
            'criticos': sum(1 for r in items if r['alerta'] == 'critico'),
            'items':    items,
        }

    # ── 5. Facturación por aseguradora ────────────────────────────────────────

    def _por_aseguradora(self, fd, fh):
        from apps.facturacion.models import Factura, EstadoFactura

        qs = self._rango(
            Factura.objects.filter(estado=EstadoFactura.VALIDADA)
            .select_related('convenio__aseguradora'),
            'creado_en', fd, fh
        )

        resumen: dict = {}
        for f in qs:
            nombre = f.convenio.aseguradora.nombre if f.convenio and f.convenio.aseguradora else 'Particular'
            nit    = f.convenio.aseguradora.nit    if f.convenio and f.convenio.aseguradora else '—'
            if nombre not in resumen:
                resumen[nombre] = {
                    'aseguradora': nombre, 'nit': nit,
                    'facturas': 0, 'total': 0.0, 'copagos': 0.0,
                    'validadas': 0, 'pendientes': 0, 'glosas': 0,
                }
            resumen[nombre]['facturas']  += 1
            resumen[nombre]['total']     += float(f.total)
            resumen[nombre]['copagos']   += float(f.valor_copago)
            resumen[nombre]['validadas'] += 1

        items = sorted(resumen.values(), key=lambda x: x['total'], reverse=True)
        return {
            'tipo':          'por_aseguradora',
            'periodo':       {'desde': fd, 'hasta': fh},
            'total_general': sum(r['total'] for r in items),
            'items':         items,
        }

    # ── 6. Glosas y errores ───────────────────────────────────────────────────

    def _glosas_errores(self, fd, fh):
        from apps.facturacion.models import Factura, EstadoFactura

        qs = self._rango(
            Factura.objects.select_related(
                'historia__paciente', 'consulta__paciente', 'convenio__aseguradora'
            ).filter(estado__in=[EstadoFactura.ERROR, EstadoFactura.ANULADA]),
            'creado_en', fd, fh
        ).order_by('-creado_en')[:200]

        items = []
        for f in qs:
            if f.historia:
                pax    = str(f.historia.paciente)
                num_hc = f'HC-{str(f.historia.numero_hc).zfill(5)}' if f.historia.numero_hc else '—'
            elif f.consulta:
                pax    = str(f.consulta.paciente)
                num_hc = '—'
            else:
                pax = '—'; num_hc = '—'

            errores = f.errores_dian or []
            items.append({
                'factura_id':    str(f.id),
                'numero_factura': f.numero_factus or '—',
                'numero_hc':     num_hc,
                'paciente':      pax,
                'aseguradora':   f.convenio.aseguradora.nombre if f.convenio and f.convenio.aseguradora else 'Particular',
                'fecha':         f.creado_en.strftime('%Y-%m-%d') if f.creado_en else '',
                'estado':        f.estado,
                'total':         float(f.total),
                'error_detalle': '; '.join(errores) if isinstance(errores, list) else str(errores or f.observaciones or '—'),
            })

        return {
            'tipo':         'glosas_errores',
            'periodo':      {'desde': fd, 'hasta': fh},
            'total_glosas': len(items),
            'items':        items,
        }

    # ── 7. Top diagnósticos CIE-10 ────────────────────────────────────────────

    def _top_diagnosticos(self, fd, fh):
        from apps.historia.models import HistoriaClinica
        from django.db.models import Count

        qs = self._rango(
            HistoriaClinica.objects.exclude(diagnostico_principal__in=['', None]),
            'fecha_atencion', fd, fh
        )

        top = (qs.values('diagnostico_principal')
               .annotate(total=Count('id'), facturadas=Count('facturas'))
               .order_by('-total')[:20])

        return {
            'tipo':    'top_diagnosticos',
            'periodo': {'desde': fd, 'hasta': fh},
            'items': [{
                'cie10':       r['diagnostico_principal'],
                'descripcion': '',
                'total':       r['total'],
                'facturadas':  r['facturadas'],
            } for r in top],
        }

    # ── 8. Top procedimientos CUPS ────────────────────────────────────────────

    def _top_procedimientos(self, fd, fh):
        from apps.historia.models import OrdenHC
        from django.db.models import Count

        qs = self._rango(
            OrdenHC.objects.exclude(cups__in=['', None]),
            'creado_en', fd, fh
        )

        top = (qs.values('cups', 'descripcion_cups', 'tipo')
               .annotate(total=Count('id'),
                         ejecutadas=Count('id', filter=__import__('django.db.models', fromlist=['Q']).Q(estado='ejecutada')))
               .order_by('-total')[:20])

        return {
            'tipo':    'top_procedimientos',
            'periodo': {'desde': fd, 'hasta': fh},
            'items': [{
                'cups':       r['cups'],
                'descripcion': r['descripcion_cups'] or r['cups'],
                'tipo':       r['tipo'],
                'total':      r['total'],
                'ejecutadas': r['ejecutadas'],
            } for r in top],
        }

    # ── 9. Estado RIPS / CUV ─────────────────────────────────────────────────

    def _rips_estado(self, fd, fh):
        from apps.facturacion.models import Factura, EstadoFactura

        qs = self._rango(
            Factura.objects.filter(estado=EstadoFactura.VALIDADA)
            .select_related('historia__paciente', 'consulta__paciente', 'convenio__aseguradora'),
            'creado_en', fd, fh
        ).order_by('-creado_en')[:500]

        items = []
        for f in qs:
            if f.historia:
                pax    = str(f.historia.paciente)
                num_hc = f'HC-{str(f.historia.numero_hc).zfill(5)}' if f.historia.numero_hc else '—'
            elif f.consulta:
                pax    = str(f.consulta.paciente)
                num_hc = '—'
            else:
                pax = '—'; num_hc = '—'

            items.append({
                'factura_id':    str(f.id),
                'numero_factura': f.numero_factus or '—',
                'numero_hc':     num_hc,
                'paciente':      pax,
                'fecha':         f.creado_en.strftime('%Y-%m-%d') if f.creado_en else '',
                'total':         float(f.total),
                'cuv':           f.cuv or '—',
                'cucon':         f.convenio.cucon if f.convenio else '—',
                'estado_rips':   'Con CUV' if f.cuv else 'Sin CUV',
                'tiene_rips':    bool(f.rips_json),
            })

        con_cuv = sum(1 for r in items if r['cuv'] != '—')
        return {
            'tipo':          'rips_estado',
            'periodo':       {'desde': fd, 'hasta': fh},
            'cuv_validados': con_cuv,
            'cuv_pendientes': len(items) - con_cuv,
            'items':         items,
        }


# ════════════════════════════════════════════════════════════════════════════
#  MÓDULO SALUD — Especialidades, Notas Médicas, Programación CX,
#                 Descripción Quirúrgica, Ayudas Diagnósticas
# ════════════════════════════════════════════════════════════════════════════

from apps.catalogos.models import Especialidad
from apps.historia.models import (
    NotaMedica, ProgramacionCx, DescripcionQuirurgica,
    AyudaDiagnostica, ResultadoAD,
    Triage, ListaVerificacionQx, RegistroAnestesia,
    ConsentimientoInformado, NotaEnfermeria,
)
from django.contrib.auth import get_user_model as _get_user

_User = _get_user()


# ── Especialidad ─────────────────────────────────────────────────────────────

class EspecialidadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Especialidad
        fields = ['id', 'codigo', 'nombre', 'activa']


class EspecialidadViewSet(viewsets.ModelViewSet):
    serializer_class = EspecialidadSerializer
    queryset = Especialidad.objects.filter(activa=True)


# ── Usuario médico (datos profesionales) ─────────────────────────────────────

class MedicoProfesionalSerializer(serializers.ModelSerializer):
    """Serializer reducido para mostrar el médico en registros clínicos."""
    nombre_completo    = serializers.CharField(source='get_full_name', read_only=True)
    especialidad_nombre = serializers.CharField(
        source='especialidad_principal.nombre', read_only=True, default='')

    class Meta:
        model = _User
        fields = [
            'id', 'nombre_completo', 'email',
            'tarjeta_profesional', 'numero_rethus',
            'especialidad_principal', 'especialidad_nombre',
            'rol',
        ]


# ── Notas Médicas ─────────────────────────────────────────────────────────────

class NotaMedicaSerializer(serializers.ModelSerializer):
    medico_info = MedicoProfesionalSerializer(source='medico', read_only=True)

    class Meta:
        model = NotaMedica
        fields = [
            'id', 'ingreso', 'historia', 'tipo', 'medico', 'medico_info',
            'especialidad_nota', 'tarjeta_prof_nota', 'servicio',
            'fecha_hora', 'subjetivo', 'objetivo', 'analisis', 'plan',
            'resumen_hospitalizacion', 'diagnostico_egreso',
            'desc_diagnostico_egreso', 'condicion_al_egreso',
            'recomendaciones_egreso',
            'firmada', 'firmada_en', 'creado_en',
        ]
        read_only_fields = ['firmada_en', 'creado_en']

    def validate(self, attrs):
        # Una vez firmada no se puede editar
        instance = self.instance
        if instance and instance.firmada and not attrs.get('firmada') == instance.firmada:
            raise serializers.ValidationError(
                'Una nota firmada no puede modificarse. Agregue una nota aclaratoria.')
        if instance and instance.firmada:
            raise serializers.ValidationError(
                'Esta nota ya está firmada y es inmutable.')
        return attrs


class NotaMedicaViewSet(viewsets.ModelViewSet):
    serializer_class = NotaMedicaSerializer

    def get_queryset(self):
        qs = NotaMedica.objects.select_related('medico', 'medico__especialidad_principal')
        ingreso = self.request.query_params.get('ingreso')
        historia = self.request.query_params.get('historia')
        tipo = self.request.query_params.get('tipo')
        if ingreso:
            qs = qs.filter(ingreso=ingreso)
        if historia:
            qs = qs.filter(historia=historia)
        if tipo:
            qs = qs.filter(tipo=tipo)
        return qs

    @action(detail=True, methods=['post'])
    def firmar(self, request, pk=None):
        nota = self.get_object()
        if nota.firmada:
            return Response({'error': 'Ya está firmada.'}, status=400)
        medico = request.user
        # Snapshot anti-glosa: captura TP y especialidad al momento de la firma
        nota.firmada = True
        nota.firmada_en = timezone.now()
        nota.medico = medico
        nota.tarjeta_prof_nota = medico.tarjeta_profesional
        nota.especialidad_nota = medico.especialidad_principal.nombre if medico.especialidad_principal else ''
        nota.save()
        return Response(NotaMedicaSerializer(nota).data)


# ── Programación CX ───────────────────────────────────────────────────────────

class ProgramacionCxSerializer(serializers.ModelSerializer):
    cirujano_info     = MedicoProfesionalSerializer(source='cirujano', read_only=True)
    anestesiologo_info = MedicoProfesionalSerializer(source='anestesiologo', read_only=True)
    paciente_nombre   = serializers.CharField(source='paciente.__str__', read_only=True)

    class Meta:
        model = ProgramacionCx
        fields = [
            'id', 'numero_cx', 'ingreso', 'paciente', 'paciente_nombre',
            'cups_principal', 'descripcion_cups', 'diagnostico_preop',
            'desc_diagnostico_preop', 'tipo_cirugia',
            'cirujano', 'cirujano_info', 'anestesiologo', 'anestesiologo_info',
            'fecha_programada', 'duracion_estimada_min', 'quirofano',
            'tipo_anestesia', 'numero_autorizacion', 'requiere_autorizacion',
            'estado', 'observaciones_preop', 'creado_en',
        ]
        read_only_fields = ['numero_cx', 'creado_en']


class ProgramacionCxViewSet(viewsets.ModelViewSet):
    serializer_class = ProgramacionCxSerializer

    def get_queryset(self):
        qs = ProgramacionCx.objects.select_related(
            'paciente', 'cirujano', 'anestesiologo',
            'cirujano__especialidad_principal',
            'anestesiologo__especialidad_principal',
        )
        ingreso = self.request.query_params.get('ingreso')
        paciente = self.request.query_params.get('paciente')
        estado = self.request.query_params.get('estado')
        fecha = self.request.query_params.get('fecha')
        if ingreso:
            qs = qs.filter(ingreso=ingreso)
        if paciente:
            qs = qs.filter(paciente=paciente)
        if estado:
            qs = qs.filter(estado=estado)
        if fecha:
            qs = qs.filter(fecha_programada__date=fecha)
        return qs


# ── Descripción Quirúrgica ───────────────────────────────────────────────────

class DescripcionQuirurgicaSerializer(serializers.ModelSerializer):
    cirujano_info = MedicoProfesionalSerializer(source='cirujano', read_only=True)
    anestesiologo_info = MedicoProfesionalSerializer(source='anestesiologo', read_only=True)
    numero_formateado = serializers.SerializerMethodField()

    def get_numero_formateado(self, obj):
        return f'DQX-{str(obj.numero_dqx).zfill(5)}'

    class Meta:
        model = DescripcionQuirurgica
        fields = [
            'id', 'numero_dqx', 'numero_formateado', 'programacion', 'ingreso',
            'diagnostico_preoperatorio', 'desc_diag_preop',
            'diagnostico_postoperatorio', 'desc_diag_postop',
            'cups_principal', 'descripcion_procedimiento', 'tipo_anestesia',
            'cirujano', 'cirujano_info', 'cirujano_nombre', 'cirujano_tp',
            'cirujano_especialidad',
            'anestesiologo', 'anestesiologo_info', 'anestesiologo_nombre',
            'primer_ayudante', 'segundo_ayudante',
            'instrumentadora', 'enfermera_circulante',
            'fecha_hora_inicio', 'fecha_hora_fin', 'quirofano',
            'descripcion_tecnica', 'hallazgos', 'especimenes', 'implantes',
            'complicaciones', 'sangrado_estimado_ml', 'liquidos_administrados',
            'plan_postoperatorio',
            'firmada', 'firmada_en', 'creado_en',
        ]
        read_only_fields = ['numero_dqx', 'firmada_en', 'creado_en']

    def validate(self, attrs):
        instance = self.instance
        if instance and instance.firmada:
            raise serializers.ValidationError('Una descripción quirúrgica firmada es inmutable.')
        return attrs


class DescripcionQuirurgicaViewSet(viewsets.ModelViewSet):
    serializer_class = DescripcionQuirurgicaSerializer

    def get_queryset(self):
        qs = DescripcionQuirurgica.objects.select_related(
            'cirujano', 'anestesiologo', 'ingreso',
            'cirujano__especialidad_principal',
        )
        ingreso = self.request.query_params.get('ingreso')
        programacion = self.request.query_params.get('programacion')
        if ingreso:
            qs = qs.filter(ingreso=ingreso)
        if programacion:
            qs = qs.filter(programacion=programacion)
        return qs

    @action(detail=True, methods=['post'])
    def firmar(self, request, pk=None):
        dqx = self.get_object()
        if dqx.firmada:
            return Response({'error': 'Ya está firmada.'}, status=400)
        medico = request.user
        dqx.firmada = True
        dqx.firmada_en = timezone.now()
        # Snapshot anti-glosa
        if dqx.cirujano:
            dqx.cirujano_nombre    = dqx.cirujano.get_full_name()
            dqx.cirujano_tp        = dqx.cirujano.tarjeta_profesional
            dqx.cirujano_especialidad = (
                dqx.cirujano.especialidad_principal.nombre
                if dqx.cirujano.especialidad_principal else ''
            )
        dqx.save()
        return Response(DescripcionQuirurgicaSerializer(dqx).data)


# ── Ayudas Diagnósticas ───────────────────────────────────────────────────────

class ResultadoADSerializer(serializers.ModelSerializer):
    archivo_url = serializers.SerializerMethodField()

    def get_archivo_url(self, obj):
        if obj.archivo:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.archivo.url) if request else obj.archivo.url
        return None

    class Meta:
        model = ResultadoAD
        fields = [
            'id', 'ayuda', 'medico_interpreta', 'fecha_resultado',
            'resultado_texto', 'interpretacion', 'conclusion',
            'archivo', 'archivo_url', 'creado_en',
        ]
        read_only_fields = ['creado_en']
        extra_kwargs = {'archivo': {'write_only': True}}


class AyudaDiagnosticaSerializer(serializers.ModelSerializer):
    resultado = ResultadoADSerializer(read_only=True)
    medico_solicitante_nombre = serializers.CharField(
        source='medico_solicitante.get_full_name', read_only=True, default='')

    class Meta:
        model = AyudaDiagnostica
        fields = [
            'id', 'ingreso', 'historia', 'tipo', 'cups', 'descripcion',
            'indicacion_clinica', 'urgente',
            'medico_solicitante', 'medico_solicitante_nombre',
            'estado', 'fecha_solicitud', 'resultado',
        ]
        read_only_fields = ['fecha_solicitud']


class AyudaDiagnosticaViewSet(viewsets.ModelViewSet):
    serializer_class = AyudaDiagnosticaSerializer

    def get_queryset(self):
        qs = AyudaDiagnostica.objects.select_related(
            'medico_solicitante', 'resultado'
        ).prefetch_related()
        ingreso = self.request.query_params.get('ingreso')
        historia = self.request.query_params.get('historia')
        tipo = self.request.query_params.get('tipo')
        estado = self.request.query_params.get('estado')
        if ingreso:
            qs = qs.filter(ingreso=ingreso)
        if historia:
            qs = qs.filter(historia=historia)
        if tipo:
            qs = qs.filter(tipo=tipo)
        if estado:
            qs = qs.filter(estado=estado)
        return qs

    @action(detail=True, methods=['post'], url_path='resultado',
            parser_classes=[__import__('rest_framework.parsers', fromlist=['MultiPartParser']).MultiPartParser,
                            __import__('rest_framework.parsers', fromlist=['FormParser']).FormParser,
                            __import__('rest_framework.parsers', fromlist=['JSONParser']).JSONParser])
    def cargar_resultado(self, request, pk=None):
        ayuda = self.get_object()
        data = request.data.copy()
        data['ayuda'] = str(ayuda.id)
        # Update or create resultado
        try:
            resultado = ayuda.resultado
            ser = ResultadoADSerializer(resultado, data=data, partial=True,
                                         context={'request': request})
        except ResultadoAD.DoesNotExist:
            ser = ResultadoADSerializer(data=data, context={'request': request})
        ser.is_valid(raise_exception=True)
        ser.save()
        ayuda.estado = 'resultado'
        ayuda.save(update_fields=['estado'])
        return Response(AyudaDiagnosticaSerializer(ayuda, context={'request': request}).data)


# ── Censo (vista de ingresos activos) ─────────────────────────────────────────

class CensoIngresoSerializer(serializers.ModelSerializer):
    paciente_nombre = serializers.CharField(source='paciente.__str__', read_only=True)
    paciente_doc    = serializers.CharField(
        source='paciente.numero_identificacion', read_only=True)
    paciente_id     = serializers.UUIDField(source='paciente.id', read_only=True)
    dias_estancia   = serializers.SerializerMethodField()
    notas_count     = serializers.IntegerField(
        source='notas_medicas.count', read_only=True)
    ayudas_count    = serializers.IntegerField(
        source='ayudas_diagnosticas.count', read_only=True)
    cx_count        = serializers.IntegerField(
        source='programaciones_cx.count', read_only=True)
    tiene_egreso    = serializers.SerializerMethodField()

    def get_dias_estancia(self, obj):
        from django.utils import timezone as tz
        delta = tz.now() - obj.fecha_ingreso
        return delta.days

    def get_tiene_egreso(self, obj):
        return hasattr(obj, 'egreso')

    class Meta:
        from apps.historia.models import Ingreso as _Ingreso
        model = _Ingreso
        fields = [
            'id', 'numero_ingreso', 'paciente_id', 'paciente_nombre', 'paciente_doc',
            'fecha_ingreso', 'tipo_atencion', 'motivo_ingreso', 'activo',
            'dias_estancia', 'notas_count', 'ayudas_count', 'cx_count',
            'tiene_egreso',
        ]


# ════════════════════════════════════════════════════════════════════════════
#  PREFACTURA — Preliquidación interna
# ════════════════════════════════════════════════════════════════════════════

from apps.facturacion.models import Prefactura, ItemPrefactura
from apps.usuarios.permissions import PuedeFacturar as _PuedeFacturar


class ItemPrefacturaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemPrefactura
        fields = [
            'id', 'prefactura', 'tipo', 'descripcion', 'cups', 'cum',
            'cantidad', 'valor_unitario', 'descuento', 'valor_total',
            'destino', 'motivo_exclusion',
            'origen_tipo', 'origen_id', 'es_manual',
            'cie10', 'fecha_servicio', 'creado_en',
        ]
        read_only_fields = ['valor_total', 'creado_en']


class PrefacturaSerializer(serializers.ModelSerializer):
    items           = ItemPrefacturaSerializer(many=True, read_only=True)
    paciente_nombre = serializers.CharField(source='paciente.__str__', read_only=True)
    convenio_info   = serializers.SerializerMethodField()
    numero_formateado = serializers.SerializerMethodField()

    def get_numero_formateado(self, obj):
        return f'PRE-{str(obj.numero_prefactura).zfill(5)}'

    def get_convenio_info(self, obj):
        if not obj.convenio:
            return None
        return {
            'id':   str(obj.convenio.id),
            'nombre': obj.convenio.nombre if hasattr(obj.convenio, 'nombre') else '',
            'aseguradora_nombre': obj.convenio.aseguradora.nombre if obj.convenio.aseguradora else '',
        }

    class Meta:
        model = Prefactura
        fields = [
            'id', 'numero_prefactura', 'numero_formateado',
            'ingreso', 'historia', 'paciente', 'paciente_nombre',
            'convenio', 'convenio_info',
            'fecha_inicio', 'fecha_fin',
            'subtotal_eps', 'subtotal_paciente', 'subtotal_no_facturable', 'total',
            'estado', 'factura',
            'creado_por', 'revisado_por', 'observaciones',
            'creado_en', 'actualizado_en',
            'items',
        ]
        read_only_fields = [
            'numero_prefactura', 'subtotal_eps', 'subtotal_paciente',
            'subtotal_no_facturable', 'total', 'creado_en', 'actualizado_en',
        ]


class PrefacturaViewSet(viewsets.ModelViewSet):
    """
    Gestión de prefacturas (preliquidación interna).
    Requiere permiso puede_facturar.
    """
    serializer_class = PrefacturaSerializer
    permission_classes = [IsAuthenticated, _PuedeFacturar]

    def get_queryset(self):
        qs = Prefactura.objects.select_related(
            'paciente', 'convenio', 'convenio__aseguradora', 'factura'
        ).prefetch_related('items')
        ingreso  = self.request.query_params.get('ingreso')
        historia = self.request.query_params.get('historia')
        paciente = self.request.query_params.get('paciente')
        estado   = self.request.query_params.get('estado')
        if ingreso:  qs = qs.filter(ingreso=ingreso)
        if historia: qs = qs.filter(historia=historia)
        if paciente: qs = qs.filter(paciente=paciente)
        if estado:   qs = qs.filter(estado=estado)
        return qs

    def perform_create(self, serializer):
        serializer.save(creado_por=self.request.user)

    @action(detail=True, methods=['post'], url_path='autocargar')
    def autocargar(self, request, pk=None):
        """
        POST /api/facturacion/prefacturas/{id}/autocargar/
        Auto-carga ítems desde todos los módulos clínicos del episodio.
        Solo agrega ítems que no existen aún (evita duplicados por origen_id).
        """
        from apps.historia.models import (
            Ingreso, HistoriaClinica, OrdenHC, MedicamentoHC,
            AyudaDiagnostica, ProgramacionCx,
        )
        from apps.tarifas.models import ManualTarifario

        pre = self.get_object()
        if pre.estado not in ('borrador', 'en_revision'):
            return Response({'error': 'Solo se puede autocargar en estado borrador o en revisión.'}, status=400)

        creados = 0
        ids_existentes = set(pre.items.values_list('origen_id', flat=True))

        def ya_existe(origen_id):
            return str(origen_id) in ids_existentes

        def crear_item(**kwargs):
            nonlocal creados
            ItemPrefactura.objects.create(prefactura=pre, **kwargs)
            creados += 1

        # ── 1. Días de hospitalización ────────────────────────────────────────
        if pre.ingreso:
            ing = pre.ingreso
            origen_id_hoteleria = f'hoteleria_{ing.id}'
            if not ya_existe(origen_id_hoteleria):
                from django.utils import timezone as tz
                fecha_inicio = pre.fecha_inicio
                fecha_fin    = pre.fecha_fin
                dias = max(1, (fecha_fin - fecha_inicio).days + 1)
                crear_item(
                    tipo='hoteleria',
                    descripcion=f'Hospitalización — {ing.get_tipo_atencion_display()} ({dias} días)',
                    cups='890301',  # CUPS hospitalización general
                    cantidad=dias,
                    valor_unitario=0,  # el facturador ingresa la tarifa
                    destino='eps',
                    es_manual=False,
                    origen_tipo='Ingreso',
                    origen_id=str(ing.id),
                    fecha_servicio=fecha_inicio,
                )

        # ── 2. Órdenes médicas ejecutadas (HC) ────────────────────────────────
        hc_ids = []
        if pre.ingreso:
            hc_ids = list(HistoriaClinica.objects.filter(ingreso=pre.ingreso)
                          .values_list('id', flat=True))
        elif pre.historia:
            hc_ids = [pre.historia_id]

        for hc_id in hc_ids:
            for orden in OrdenHC.objects.filter(historia=hc_id, estado='ejecutada'):
                if ya_existe(str(orden.id)):
                    continue
                crear_item(
                    tipo='procedimiento',
                    descripcion=orden.descripcion_cups or orden.cups or orden.get_tipo_display(),
                    cups=orden.cups,
                    cantidad=orden.cantidad,
                    valor_unitario=float(orden.valor_unitario),
                    destino='eps',
                    cie10=orden.cie10_justificacion,
                    es_manual=False,
                    origen_tipo='OrdenHC',
                    origen_id=str(orden.id),
                )

        # ── 3. Medicamentos prescritos ────────────────────────────────────────
        for hc_id in hc_ids:
            for med in MedicamentoHC.objects.filter(historia=hc_id, genera_factura=True):
                if ya_existe(str(med.id)):
                    continue
                crear_item(
                    tipo='medicamento',
                    descripcion=f'{med.principio_activo} {med.concentracion}',
                    cum=med.cum,
                    cantidad=med.cantidad,
                    valor_unitario=float(med.valor_unitario),
                    destino='eps',
                    es_manual=False,
                    origen_tipo='MedicamentoHC',
                    origen_id=str(med.id),
                )

        # ── 4. Ayudas diagnósticas realizadas ────────────────────────────────
        ayudas_qs = AyudaDiagnostica.objects.filter(estado='resultado')
        if pre.ingreso:
            ayudas_qs = ayudas_qs.filter(ingreso=pre.ingreso)
        elif pre.historia:
            ayudas_qs = ayudas_qs.filter(historia=pre.historia)
        for ayuda in ayudas_qs:
            if ya_existe(str(ayuda.id)):
                continue
            crear_item(
                tipo='ayuda_diagnostica',
                descripcion=ayuda.descripcion,
                cups=ayuda.cups,
                cantidad=1,
                valor_unitario=0,
                destino='eps',
                es_manual=False,
                origen_tipo='AyudaDiagnostica',
                origen_id=str(ayuda.id),
            )

        # ── 5. Cirugías realizadas ────────────────────────────────────────────
        if pre.ingreso:
            for cx in ProgramacionCx.objects.filter(ingreso=pre.ingreso, estado='realizada'):
                if ya_existe(str(cx.id)):
                    continue
                # Derecho de sala
                crear_item(
                    tipo='derechos_sala',
                    descripcion=f'Derechos de sala — {cx.descripcion_cups or cx.cups_principal}',
                    cups=cx.cups_principal,
                    cantidad=1,
                    valor_unitario=0,
                    destino='eps',
                    es_manual=False,
                    origen_tipo='ProgramacionCx',
                    origen_id=str(cx.id),
                )
                # Anestesia
                if cx.anestesiologo_id:
                    crear_item(
                        tipo='anestesia',
                        descripcion=f'Anestesia {cx.tipo_anestesia} — {cx.descripcion_cups or cx.cups_principal}',
                        cups='',
                        cantidad=1,
                        valor_unitario=0,
                        destino='eps',
                        es_manual=False,
                        origen_tipo='ProgramacionCx_anestesia',
                        origen_id=f'anest_{cx.id}',
                    )

        pre.recalcular_totales()
        return Response({
            'message': f'{creados} ítems cargados automáticamente.',
            'prefactura': PrefacturaSerializer(pre).data,
        })

    @action(detail=True, methods=['post'], url_path='cambiar_estado')
    def cambiar_estado(self, request, pk=None):
        """POST /api/facturacion/prefacturas/{id}/cambiar_estado/ — avanza el estado."""
        pre = self.get_object()
        nuevo = request.data.get('estado')
        transiciones_validas = {
            'borrador':    ['en_revision'],
            'en_revision': ['aprobada', 'borrador'],
            'aprobada':    ['facturada', 'borrador'],
        }
        if nuevo not in transiciones_validas.get(pre.estado, []):
            return Response({'error': f'No se puede pasar de "{pre.estado}" a "{nuevo}".'}, status=400)
        if nuevo == 'en_revision':
            pre.revisado_por = request.user
        pre.estado = nuevo
        pre.recalcular_totales()
        pre.save(update_fields=['estado', 'revisado_por'])
        return Response(PrefacturaSerializer(pre).data)

    @action(detail=True, methods=['post'], url_path='recalcular')
    def recalcular(self, request, pk=None):
        """POST /api/facturacion/prefacturas/{id}/recalcular/ — recalcula totales."""
        pre = self.get_object()
        pre.recalcular_totales()
        return Response(PrefacturaSerializer(pre).data)


class ItemPrefacturaViewSet(viewsets.ModelViewSet):
    serializer_class = ItemPrefacturaSerializer
    permission_classes = [IsAuthenticated, _PuedeFacturar]

    def get_queryset(self):
        qs = ItemPrefactura.objects.all()
        prefactura = self.request.query_params.get('prefactura')
        if prefactura:
            qs = qs.filter(prefactura=prefactura)
        return qs

    def perform_update(self, serializer):
        item = serializer.save()
        item.prefactura.recalcular_totales()

    def perform_destroy(self, instance):
        pre = instance.prefactura
        instance.delete()
        pre.recalcular_totales()


# ═══════════════════════════════════════════════════════════
#  NOTA DE AJUSTE RIPS — Res. 948/2026
# ═══════════════════════════════════════════════════════════
from apps.facturacion.models import NotaAjusteRIPS

class NotaAjusteRIPSSerializer(serializers.ModelSerializer):
    factura_numero   = serializers.CharField(source='factura.numero_factus', read_only=True, default='')
    motivo_tipo_label = serializers.CharField(source='get_motivo_tipo_display', read_only=True)
    estado_label     = serializers.CharField(source='get_estado_display', read_only=True)
    creado_por_nombre = serializers.CharField(source='creado_por.nombre', read_only=True, default='')

    class Meta:
        model  = NotaAjusteRIPS
        fields = [
            'id', 'factura', 'factura_numero', 'cuv_original', 'numero_factus_original',
            'motivo_tipo', 'motivo_tipo_label', 'motivo_detalle',
            'datos_originales', 'datos_corregidos',
            'rips_ajuste_json', 'estado', 'estado_label',
            'cuv_ajuste', 'respuesta_factus',
            'creado_por', 'creado_por_nombre', 'creado_en', 'actualizado_en',
        ]
        read_only_fields = ['rips_ajuste_json', 'cuv_ajuste', 'respuesta_factus', 'creado_en', 'actualizado_en']


class NotaAjusteRIPSViewSet(viewsets.ModelViewSet):
    serializer_class   = NotaAjusteRIPSSerializer
    permission_classes = [IsAuthenticated, _PuedeFacturar]

    def get_queryset(self):
        qs = NotaAjusteRIPS.objects.select_related('factura', 'creado_por').all()
        factura = self.request.query_params.get('factura')
        if factura:
            qs = qs.filter(factura=factura)
        return qs

    def perform_create(self, serializer):
        factura = serializer.validated_data.get('factura')
        # Pre-cargar CUV y número original desde la factura
        cuv_orig    = factura.cuv or ''
        num_orig    = factura.numero_factus or ''
        serializer.save(
            creado_por=self.request.user,
            cuv_original=cuv_orig,
            numero_factus_original=num_orig,
        )

    @action(detail=True, methods=['post'], url_path='generar_rips')
    def generar_rips(self, request, pk=None):
        """
        Genera el JSON del RIPS de ajuste a partir de los datos_corregidos.
        El JSON resultante mantiene la estructura de Res. 948/2026 con los
        campos clínicos corregidos, listo para enviar a Factus.
        """
        nota = self.get_object()
        factura = nota.factura

        # Construir RIPS base desde la factura original
        try:
            from config.api import _generar_rips_json
            rips_base = _generar_rips_json(factura)
        except Exception:
            rips_base = {}

        # Mezclar con datos corregidos
        corregidos = nota.datos_corregidos or {}
        if corregidos:
            # Aplicar correcciones sobre el RIPS base
            def aplicar(obj, correcciones):
                if isinstance(obj, dict):
                    for k, v in correcciones.items():
                        if k in obj:
                            obj[k] = v
                    for v in obj.values():
                        aplicar(v, correcciones)
                elif isinstance(obj, list):
                    for item in obj:
                        aplicar(item, correcciones)
            aplicar(rips_base, corregidos)

        nota.rips_ajuste_json = rips_base
        nota.save(update_fields=['rips_ajuste_json'])
        return Response({
            'message': 'RIPS de ajuste generado. Revise y envíe a MinSalud vía Factus.',
            'nota': NotaAjusteRIPSSerializer(nota).data,
        })

    @action(detail=True, methods=['post'], url_path='marcar_enviada')
    def marcar_enviada(self, request, pk=None):
        """Registra que la nota fue enviada a MinSalud (manual o vía Factus)."""
        nota = self.get_object()
        cuv_ajuste = request.data.get('cuv_ajuste', '')
        nota.estado     = 'enviada'
        nota.cuv_ajuste = cuv_ajuste
        nota.respuesta_factus = request.data.get('respuesta_factus')
        nota.save(update_fields=['estado', 'cuv_ajuste', 'respuesta_factus'])
        return Response(NotaAjusteRIPSSerializer(nota).data)


# ═══════════════════════════════════════════════════════════
#  NOTA CRÉDITO / DÉBITO
# ═══════════════════════════════════════════════════════════
from apps.facturacion.models import NotaDocumento

class NotaDocumentoSerializer(serializers.ModelSerializer):
    factura_numero   = serializers.CharField(source='factura_referencia.numero_factus', read_only=True, default='')
    factura_cufe     = serializers.CharField(source='factura_referencia.cufe', read_only=True, default='')
    tipo_label       = serializers.CharField(source='get_tipo_display', read_only=True)
    estado_label     = serializers.CharField(source='get_estado_display', read_only=True)
    creado_por_nombre = serializers.CharField(source='creado_por.nombre', read_only=True, default='')

    class Meta:
        model  = NotaDocumento
        fields = [
            'id', 'tipo', 'tipo_label',
            'factura_referencia', 'factura_numero', 'factura_cufe',
            'concepto', 'descripcion_concepto',
            'subtotal', 'valor_descuento', 'total',
            'numero_factus', 'cufe', 'estado', 'estado_label',
            'errores_dian', 'respuesta_factus', 'observaciones',
            'creado_por', 'creado_por_nombre', 'creado_en', 'actualizado_en',
        ]
        read_only_fields = ['numero_factus', 'cufe', 'errores_dian', 'respuesta_factus', 'creado_en', 'actualizado_en']


class NotaDocumentoViewSet(viewsets.ModelViewSet):
    serializer_class   = NotaDocumentoSerializer
    permission_classes = [IsAuthenticated, _PuedeFacturar]

    def get_queryset(self):
        qs = NotaDocumento.objects.select_related('factura_referencia', 'creado_por').all()
        factura = self.request.query_params.get('factura')
        tipo    = self.request.query_params.get('tipo')
        estado  = self.request.query_params.get('estado')
        if factura: qs = qs.filter(factura_referencia=factura)
        if tipo:    qs = qs.filter(tipo=tipo)
        if estado:  qs = qs.filter(estado=estado)
        return qs

    def perform_create(self, serializer):
        serializer.save(creado_por=self.request.user)

    @action(detail=True, methods=['post'], url_path='enviar')
    def enviar(self, request, pk=None):
        """
        POST /api/facturacion/notas/{id}/enviar/
        Llama a Factus para transmitir la NC/ND a la DIAN.
        En esta versión guarda la respuesta cruda; integración Factus pendiente.
        """
        nota = self.get_object()
        if nota.estado not in ('borrador',):
            return Response({'error': 'Solo se pueden enviar notas en borrador.'}, status=400)

        # Construir payload para Factus
        factura = nota.factura_referencia
        payload = {
            'reference_id': str(nota.id),
            'document':     nota.tipo,
            'concept':      nota.concepto,
            'description':  nota.descripcion_concepto,
            'original_cufe': factura.cufe or '',
            'original_number': factura.numero_factus or '',
            'subtotal':     str(nota.subtotal),
            'total':        str(nota.total),
        }

        # Intentar llamar a Factus si está configurado
        try:
            from apps.tenants.models import ConfiguracionConsultorio
            config = ConfiguracionConsultorio.objects.first()
            if config and config.factus_api_key:
                import requests as _req
                endpoint = 'credit-notes' if nota.tipo == 'NC' else 'debit-notes'
                resp = _req.post(
                    f'https://api.factus.com.co/v1/{endpoint}',
                    json=payload,
                    headers={
                        'Authorization': f'Bearer {config.factus_api_key}',
                        'Content-Type': 'application/json',
                    },
                    timeout=30,
                )
                respdata = resp.json()
                if resp.ok and not respdata.get('errors'):
                    nota.numero_factus    = respdata.get('number', '')
                    nota.cufe             = respdata.get('cufe', '')
                    nota.estado           = 'validada'
                    nota.respuesta_factus = respdata
                else:
                    nota.estado           = 'rechazada'
                    nota.errores_dian     = respdata.get('errors', [respdata])
                    nota.respuesta_factus = respdata
            else:
                nota.estado = 'enviada'
                nota.respuesta_factus = payload
        except Exception as exc:
            nota.estado = 'enviada'
            nota.observaciones = f'Enviada manualmente. Error Factus: {exc}'

        nota.save()
        return Response(NotaDocumentoSerializer(nota).data)


# ═══════════════════════════════════════════════════════════════════════════════
# TRIAGE
# ═══════════════════════════════════════════════════════════════════════════════
class TriageSerializer(serializers.ModelSerializer):
    paciente_nombre = serializers.SerializerMethodField()
    nivel_display   = serializers.SerializerMethodField()
    estado_display  = serializers.SerializerMethodField()

    class Meta:
        model = Triage
        fields = '__all__'
        read_only_fields = ['id', 'hora_clasificacion', 'creado_en', 'actualizado_en']

    def get_paciente_nombre(self, obj):
        try:
            return f'{obj.paciente.primer_nombre} {obj.paciente.primer_apellido}'
        except Exception:
            return ''

    def get_nivel_display(self, obj):
        return obj.get_nivel_display()

    def get_estado_display(self, obj):
        return obj.get_estado_display()


class TriageViewSet(viewsets.ModelViewSet):
    serializer_class = TriageSerializer
    ordering = ['-hora_clasificacion']

    def get_queryset(self):
        qs = Triage.objects.select_related('paciente', 'clasificado_por', 'ingreso')
        nivel  = self.request.query_params.get('nivel')
        estado = self.request.query_params.get('estado')
        fecha  = self.request.query_params.get('fecha')
        if nivel:
            qs = qs.filter(nivel=nivel)
        if estado:
            qs = qs.filter(estado=estado)
        if fecha:
            qs = qs.filter(hora_clasificacion__date=fecha)
        return qs

    @action(detail=True, methods=['post'])
    def atender(self, request, pk=None):
        from django.utils import timezone
        t = self.get_object()
        t.estado = 'en_atencion'
        t.hora_atencion = timezone.now()
        t.save()
        return Response(self.get_serializer(t).data)

    @action(detail=True, methods=['post'])
    def cambiar_estado(self, request, pk=None):
        t = self.get_object()
        nuevo = request.data.get('estado')
        if nuevo not in dict(Triage.ESTADO_CHOICES):
            return Response({'error': 'Estado inválido'}, status=400)
        t.estado = nuevo
        t.save()
        return Response(self.get_serializer(t).data)


# ═══════════════════════════════════════════════════════════════════════════════
# LISTA DE VERIFICACIÓN QUIRÚRGICA
# ═══════════════════════════════════════════════════════════════════════════════
class ListaVerificacionQxSerializer(serializers.ModelSerializer):
    class Meta:
        model = ListaVerificacionQx
        fields = '__all__'
        read_only_fields = ['id', 'creado_en', 'actualizado_en']


class ListaVerificacionQxViewSet(viewsets.ModelViewSet):
    serializer_class = ListaVerificacionQxSerializer
    queryset = ListaVerificacionQx.objects.all()

    @action(detail=True, methods=['post'])
    def completar(self, request, pk=None):
        lista = self.get_object()
        lista.completada = True
        lista.save()
        return Response(self.get_serializer(lista).data)


# ═══════════════════════════════════════════════════════════════════════════════
# REGISTRO DE ANESTESIA
# ═══════════════════════════════════════════════════════════════════════════════
class RegistroAnestesiaSerializer(serializers.ModelSerializer):
    class Meta:
        model = RegistroAnestesia
        fields = '__all__'
        read_only_fields = ['id', 'creado_en', 'actualizado_en']

    def update(self, instance, validated_data):
        from django.utils import timezone
        if validated_data.get('firmado') and not instance.firmado:
            validated_data['firmado_en'] = timezone.now()
        return super().update(instance, validated_data)


class RegistroAnestesiaViewSet(viewsets.ModelViewSet):
    serializer_class = RegistroAnestesiaSerializer
    queryset = RegistroAnestesia.objects.all()


# ═══════════════════════════════════════════════════════════════════════════════
# CONSENTIMIENTO INFORMADO
# ═══════════════════════════════════════════════════════════════════════════════
class ConsentimientoSerializer(serializers.ModelSerializer):
    paciente_nombre = serializers.SerializerMethodField()
    tipo_display    = serializers.SerializerMethodField()

    class Meta:
        model = ConsentimientoInformado
        fields = '__all__'
        read_only_fields = ['id', 'creado_en', 'fecha_firma']

    def get_paciente_nombre(self, obj):
        try:
            return f'{obj.paciente.primer_nombre} {obj.paciente.primer_apellido}'
        except Exception:
            return ''

    def get_tipo_display(self, obj):
        return obj.get_tipo_display()


class ConsentimientoViewSet(viewsets.ModelViewSet):
    serializer_class = ConsentimientoSerializer
    ordering = ['-creado_en']

    def get_queryset(self):
        qs = ConsentimientoInformado.objects.select_related('paciente', 'ingreso', 'medico')
        paciente = self.request.query_params.get('paciente')
        ingreso  = self.request.query_params.get('ingreso')
        estado   = self.request.query_params.get('estado')
        if paciente:
            qs = qs.filter(paciente=paciente)
        if ingreso:
            qs = qs.filter(ingreso=ingreso)
        if estado:
            qs = qs.filter(estado=estado)
        return qs

    @action(detail=True, methods=['post'])
    def firmar(self, request, pk=None):
        from django.utils import timezone
        ci = self.get_object()
        ci.estado = 'firmado'
        ci.fecha_firma = timezone.now()
        ci.nombre_paciente_firmante = request.data.get('nombre_firmante', '')
        ci.nombre_acompanante = request.data.get('nombre_acompanante', '')
        ci.parentesco_acompanante = request.data.get('parentesco_acompanante', request.data.get('parentesco', ''))
        ci.firma_imagen = request.data.get('firma_imagen', '')
        ci.firma_acompanante_imagen = request.data.get('firma_acompanante_imagen', '')
        ci.medico = request.user
        ci.save()
        return Response(self.get_serializer(ci).data)

    @action(detail=True, methods=['post'])
    def rechazar(self, request, pk=None):
        ci = self.get_object()
        ci.estado = 'rechazado'
        ci.motivo_rechazo = request.data.get('motivo', '')
        ci.save()
        return Response(self.get_serializer(ci).data)


# ═══════════════════════════════════════════════════════════════════════════════
# NOTA DE ENFERMERÍA
# ═══════════════════════════════════════════════════════════════════════════════
class NotaEnfermeriaSerializer(serializers.ModelSerializer):
    turno_display = serializers.SerializerMethodField()
    enfermero_nombre = serializers.SerializerMethodField()

    class Meta:
        model = NotaEnfermeria
        fields = '__all__'
        read_only_fields = ['id', 'creado_en', 'firmada_en']

    def get_turno_display(self, obj):
        return obj.get_turno_display()

    def get_enfermero_nombre(self, obj):
        if obj.enfermero:
            return obj.enfermero.get_full_name() or obj.enfermero.username
        return ''

    def update(self, instance, validated_data):
        from django.utils import timezone
        if validated_data.get('firmada') and not instance.firmada:
            validated_data['firmada_en'] = timezone.now()
        return super().update(instance, validated_data)


class NotaEnfermeriaViewSet(viewsets.ModelViewSet):
    serializer_class = NotaEnfermeriaSerializer
    ordering = ['-fecha_hora']

    def get_queryset(self):
        qs = NotaEnfermeria.objects.select_related('ingreso', 'enfermero')
        ingreso = self.request.query_params.get('ingreso')
        turno   = self.request.query_params.get('turno')
        fecha   = self.request.query_params.get('fecha')
        if ingreso:
            qs = qs.filter(ingreso=ingreso)
        if turno:
            qs = qs.filter(turno=turno)
        if fecha:
            qs = qs.filter(fecha_hora__date=fecha)
        return qs

    def perform_create(self, serializer):
        serializer.save(enfermero=self.request.user)

# ═══════════════════════════════════════════════════════════════════════════════
# NUEVOS MÓDULOS CLÍNICOS: REFERENCIA, REHABILITACIÓN, ODONTOLOGÍA,
# TELEMEDICINA, UCI, BANCO DE SANGRE, FARMACIA, LABORATORIO
# ═══════════════════════════════════════════════════════════════════════════════

from apps.historia.models import (
    ReferenciaPaciente, PlanRehabilitacion, SesionRehabilitacion,
    HistoriaOdontologica, ProcedimientoOdontologico, SesionTelemedicina,
    CamaUCI, AdmisionUCI, MonitoreoUCI, UnidadHemoderivado, SolicitudHemoderivado,
)
from apps.farmacia.models import (
    MedicamentoFarmacia, LoteInventario, MovimientoInventario, DispensacionMedicamento,
)
from apps.laboratorio.models import (
    PanelLaboratorio, SolicitudLaboratorio, ResultadoLaboratorio,
)


# ── Referencia / Contrareferencia ─────────────────────────────────────────────

class ReferenciaPacienteSerializer(serializers.ModelSerializer):
    paciente_nombre = serializers.CharField(source='paciente.nombre_completo', read_only=True)
    tipo_label = serializers.CharField(source='get_tipo_display', read_only=True)
    estado_label = serializers.CharField(source='get_estado_display', read_only=True)
    prioridad_label = serializers.CharField(source='get_prioridad_display', read_only=True)

    class Meta:
        model = ReferenciaPaciente
        fields = '__all__'
        read_only_fields = ['id', 'fecha_referencia']


class ReferenciaPacienteViewSet(viewsets.ModelViewSet):
    serializer_class = ReferenciaPacienteSerializer

    def get_queryset(self):
        qs = ReferenciaPaciente.objects.select_related('paciente', 'ingreso', 'medico_remitente', 'creado_por')
        paciente = self.request.query_params.get('paciente')
        tipo = self.request.query_params.get('tipo')
        estado = self.request.query_params.get('estado')
        if paciente:
            qs = qs.filter(paciente=paciente)
        if tipo:
            qs = qs.filter(tipo=tipo)
        if estado:
            qs = qs.filter(estado=estado)
        return qs

    def perform_create(self, serializer):
        serializer.save(creado_por=self.request.user)

    @action(detail=True, methods=['post'])
    def responder(self, request, pk=None):
        """POST /api/salud/referencias/{id}/responder/ — registra la contrareferencia."""
        ref = self.get_object()
        ref.respuesta_diagnostico = request.data.get('respuesta_diagnostico', '')
        ref.respuesta_tratamiento = request.data.get('respuesta_tratamiento', '')
        ref.respuesta_recomendaciones = request.data.get('respuesta_recomendaciones', '')
        ref.medico_responde = request.data.get('medico_responde', '')
        ref.motivo_rechazo = request.data.get('motivo_rechazo', '')
        nuevo_estado = request.data.get('estado', 'respondida')
        ref.estado = nuevo_estado
        ref.fecha_respuesta = timezone.now()
        ref.save()
        return Response(self.get_serializer(ref).data)


# ── Plan de Rehabilitación ────────────────────────────────────────────────────

class PlanRehabilitacionSerializer(serializers.ModelSerializer):
    paciente_nombre = serializers.CharField(source='paciente.nombre_completo', read_only=True)
    tipo_terapia_label = serializers.CharField(source='get_tipo_terapia_display', read_only=True)

    class Meta:
        model = PlanRehabilitacion
        fields = '__all__'
        read_only_fields = ['id', 'creado_en']


class PlanRehabilitacionViewSet(viewsets.ModelViewSet):
    serializer_class = PlanRehabilitacionSerializer

    def get_queryset(self):
        qs = PlanRehabilitacion.objects.select_related('paciente', 'ingreso', 'terapeuta', 'medico_prescriptor')
        paciente = self.request.query_params.get('paciente')
        tipo_terapia = self.request.query_params.get('tipo_terapia')
        estado = self.request.query_params.get('estado')
        if paciente:
            qs = qs.filter(paciente=paciente)
        if tipo_terapia:
            qs = qs.filter(tipo_terapia=tipo_terapia)
        if estado:
            qs = qs.filter(estado=estado)
        return qs


# ── Sesión de Rehabilitación ──────────────────────────────────────────────────

class SesionRehabilitacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SesionRehabilitacion
        fields = '__all__'
        read_only_fields = ['id', 'creado_en']


class SesionRehabilitacionViewSet(viewsets.ModelViewSet):
    serializer_class = SesionRehabilitacionSerializer

    def get_queryset(self):
        qs = SesionRehabilitacion.objects.select_related('plan__paciente', 'terapeuta')
        plan = self.request.query_params.get('plan')
        if plan:
            qs = qs.filter(plan=plan)
        return qs

    def perform_create(self, serializer):
        serializer.save(terapeuta=self.request.user)


# ── Historia Odontológica ─────────────────────────────────────────────────────

class HistoriaOdontologicaSerializer(serializers.ModelSerializer):
    paciente_nombre = serializers.CharField(source='paciente.nombre_completo', read_only=True)

    class Meta:
        model = HistoriaOdontologica
        fields = '__all__'
        read_only_fields = ['id', 'creado_en', 'actualizado_en']


class HistoriaOdontologicaViewSet(viewsets.ModelViewSet):
    serializer_class = HistoriaOdontologicaSerializer

    def get_queryset(self):
        qs = HistoriaOdontologica.objects.select_related('paciente')
        paciente = self.request.query_params.get('paciente')
        if paciente:
            qs = qs.filter(paciente=paciente)
        return qs


# ── Procedimiento Odontológico ────────────────────────────────────────────────

class ProcedimientoOdontologicoSerializer(serializers.ModelSerializer):
    estado_label = serializers.CharField(source='get_estado_display', read_only=True)
    cara_label = serializers.CharField(source='get_cara_display', read_only=True)

    class Meta:
        model = ProcedimientoOdontologico
        fields = '__all__'
        read_only_fields = ['id', 'fecha']


class ProcedimientoOdontologicoViewSet(viewsets.ModelViewSet):
    serializer_class = ProcedimientoOdontologicoSerializer

    def get_queryset(self):
        qs = ProcedimientoOdontologico.objects.select_related('historia__paciente', 'odontologo')
        historia = self.request.query_params.get('historia')
        numero_diente = self.request.query_params.get('numero_diente')
        if historia:
            qs = qs.filter(historia=historia)
        if numero_diente:
            qs = qs.filter(numero_diente=numero_diente)
        return qs

    def perform_create(self, serializer):
        serializer.save(odontologo=self.request.user)


# ── Sesión Telemedicina ───────────────────────────────────────────────────────

class SesionTelemedicinaSserializer(serializers.ModelSerializer):
    paciente_nombre = serializers.CharField(source='paciente.nombre_completo', read_only=True)
    tipo_label = serializers.CharField(source='get_tipo_display', read_only=True)
    estado_label = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model = SesionTelemedicina
        fields = '__all__'
        read_only_fields = ['id', 'creado_en', 'actualizado_en']


class SesionTelemedicinaSViewSet(viewsets.ModelViewSet):
    serializer_class = SesionTelemedicinaSserializer

    def get_queryset(self):
        qs = SesionTelemedicina.objects.select_related('paciente', 'medico')
        paciente = self.request.query_params.get('paciente')
        estado = self.request.query_params.get('estado')
        if paciente:
            qs = qs.filter(paciente=paciente)
        if estado:
            qs = qs.filter(estado=estado)
        return qs

    def perform_create(self, serializer):
        serializer.save(medico=self.request.user)

    @action(detail=True, methods=['post'])
    def completar(self, request, pk=None):
        """POST /api/salud/telemedicina/{id}/completar/ — cierra la sesión con notas."""
        sesion = self.get_object()
        sesion.notas_clinicas = request.data.get('notas_clinicas', sesion.notas_clinicas)
        sesion.formula_medica = request.data.get('formula_medica', sesion.formula_medica)
        sesion.diagnostico_cie10 = request.data.get('diagnostico_cie10', sesion.diagnostico_cie10)
        sesion.incapacidad_dias = request.data.get('incapacidad_dias', sesion.incapacidad_dias)
        sesion.duracion_real_min = request.data.get('duracion_real_min', sesion.duracion_real_min)
        sesion.estado = 'completada'
        sesion.save()
        return Response(self.get_serializer(sesion).data)


# ── Cama UCI ──────────────────────────────────────────────────────────────────

class CamaUCISerializer(serializers.ModelSerializer):
    tipo_label = serializers.CharField(source='get_tipo_display', read_only=True)
    estado_label = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model = CamaUCI
        fields = '__all__'
        read_only_fields = ['id']


class CamaUCIViewSet(viewsets.ModelViewSet):
    serializer_class = CamaUCISerializer

    def get_queryset(self):
        qs = CamaUCI.objects.all()
        tipo = self.request.query_params.get('tipo')
        estado = self.request.query_params.get('estado')
        if tipo:
            qs = qs.filter(tipo=tipo)
        if estado:
            qs = qs.filter(estado=estado)
        return qs


# ── Admisión UCI ──────────────────────────────────────────────────────────────

class AdmisionUCISerializer(serializers.ModelSerializer):
    paciente_nombre = serializers.CharField(source='paciente.nombre_completo', read_only=True)
    motivo_label = serializers.CharField(source='get_motivo_ingreso_display', read_only=True)

    class Meta:
        model = AdmisionUCI
        fields = '__all__'
        read_only_fields = ['id', 'creado_en', 'dias_uci']


class AdmisionUCIViewSet(viewsets.ModelViewSet):
    serializer_class = AdmisionUCISerializer

    def get_queryset(self):
        qs = AdmisionUCI.objects.select_related('paciente', 'ingreso', 'cama', 'medico_responsable')
        paciente = self.request.query_params.get('paciente')
        activos = self.request.query_params.get('activos')
        if paciente:
            qs = qs.filter(paciente=paciente)
        if activos is not None:
            qs = qs.filter(fecha_egreso_uci__isnull=activos.lower() == 'true')
        return qs


# ── Monitoreo UCI ─────────────────────────────────────────────────────────────

class MonitoreoUCISerializer(serializers.ModelSerializer):
    class Meta:
        model = MonitoreoUCI
        fields = '__all__'
        read_only_fields = ['id']


class MonitoreoUCIViewSet(viewsets.ModelViewSet):
    serializer_class = MonitoreoUCISerializer

    def get_queryset(self):
        qs = MonitoreoUCI.objects.select_related('admision__paciente', 'registrado_por')
        admision = self.request.query_params.get('admision')
        if admision:
            qs = qs.filter(admision=admision)
        return qs

    def perform_create(self, serializer):
        serializer.save(registrado_por=self.request.user)


# ── Unidad Hemoderivado ───────────────────────────────────────────────────────

class UnidadHemoderivadoSerializer(serializers.ModelSerializer):
    tipo_label = serializers.CharField(source='get_tipo_display', read_only=True)
    estado_label = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model = UnidadHemoderivado
        fields = '__all__'
        read_only_fields = ['id', 'creado_en']


class UnidadHemoderivadoViewSet(viewsets.ModelViewSet):
    serializer_class = UnidadHemoderivadoSerializer

    def get_queryset(self):
        qs = UnidadHemoderivado.objects.all()
        tipo = self.request.query_params.get('tipo')
        grupo_sanguineo = self.request.query_params.get('grupo_sanguineo')
        estado = self.request.query_params.get('estado')
        if tipo:
            qs = qs.filter(tipo=tipo)
        if grupo_sanguineo:
            qs = qs.filter(grupo_sanguineo=grupo_sanguineo)
        if estado:
            qs = qs.filter(estado=estado)
        return qs


# ── Solicitud Hemoderivado ────────────────────────────────────────────────────

class SolicitudHemoderivadoSerializer(serializers.ModelSerializer):
    paciente_nombre = serializers.CharField(source='paciente.nombre_completo', read_only=True)
    tipo_label = serializers.CharField(source='get_tipo_solicitado_display', read_only=True)

    class Meta:
        model = SolicitudHemoderivado
        fields = '__all__'
        read_only_fields = ['id', 'fecha_solicitud']


class SolicitudHemoderivadoViewSet(viewsets.ModelViewSet):
    serializer_class = SolicitudHemoderivadoSerializer

    def get_queryset(self):
        qs = SolicitudHemoderivado.objects.select_related('paciente', 'ingreso', 'medico_solicitante').prefetch_related('unidades_asignadas')
        paciente = self.request.query_params.get('paciente')
        estado = self.request.query_params.get('estado')
        if paciente:
            qs = qs.filter(paciente=paciente)
        if estado:
            qs = qs.filter(estado=estado)
        return qs

    def perform_create(self, serializer):
        serializer.save(medico_solicitante=self.request.user)

    @action(detail=True, methods=['post'])
    def asignar_unidad(self, request, pk=None):
        """POST /api/salud/banco-sangre/solicitudes/{id}/asignar_unidad/
        Body: { unidad_id: uuid }
        """
        solicitud = self.get_object()
        unidad_id = request.data.get('unidad_id')
        if not unidad_id:
            return Response({'error': 'unidad_id requerido.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            unidad = UnidadHemoderivado.objects.get(pk=unidad_id)
        except UnidadHemoderivado.DoesNotExist:
            return Response({'error': 'Unidad no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        if unidad.estado != 'disponible':
            return Response({'error': f'La unidad no está disponible (estado: {unidad.estado}).'}, status=status.HTTP_400_BAD_REQUEST)
        solicitud.unidades_asignadas.add(unidad)
        unidad.estado = 'reservada'
        unidad.save(update_fields=['estado'])
        solicitud.estado = 'en_reserva'
        solicitud.save(update_fields=['estado'])
        return Response(self.get_serializer(solicitud).data)


# ── Medicamento Farmacia ──────────────────────────────────────────────────────

class MedicamentoFarmaciaSerializer(serializers.ModelSerializer):
    stock_bajo = serializers.BooleanField(read_only=True)

    class Meta:
        model = MedicamentoFarmacia
        fields = '__all__'
        read_only_fields = ['id', 'creado_en', 'actualizado_en']


class MedicamentoFarmaciaViewSet(viewsets.ModelViewSet):
    serializer_class = MedicamentoFarmaciaSerializer

    def get_queryset(self):
        from django.db.models import Q
        qs = MedicamentoFarmacia.objects.all()
        activo = self.request.query_params.get('activo')
        search = self.request.query_params.get('search', '').strip()
        if activo is not None:
            qs = qs.filter(activo=activo.lower() == 'true')
        if search:
            qs = qs.filter(
                Q(nombre_generico__icontains=search) |
                Q(nombre_comercial__icontains=search) |
                Q(cum__icontains=search)
            )
        return qs


# ── Lote Inventario ───────────────────────────────────────────────────────────

class LoteInventarioSerializer(serializers.ModelSerializer):
    medicamento_nombre = serializers.CharField(source='medicamento.nombre_generico', read_only=True)

    class Meta:
        model = LoteInventario
        fields = '__all__'
        read_only_fields = ['id', 'fecha_ingreso']


class LoteInventarioViewSet(viewsets.ModelViewSet):
    serializer_class = LoteInventarioSerializer

    def get_queryset(self):
        qs = LoteInventario.objects.select_related('medicamento', 'ingresado_por')
        medicamento = self.request.query_params.get('medicamento')
        if medicamento:
            qs = qs.filter(medicamento=medicamento)
        return qs

    def perform_create(self, serializer):
        serializer.save(ingresado_por=self.request.user)


# ── Dispensación Medicamento ──────────────────────────────────────────────────

class DispensacionMedicamentoSerializer(serializers.ModelSerializer):
    paciente_nombre = serializers.CharField(source='paciente.nombre_completo', read_only=True)
    medicamento_nombre = serializers.CharField(source='medicamento.nombre_generico', read_only=True)

    class Meta:
        model = DispensacionMedicamento
        fields = '__all__'
        read_only_fields = ['id', 'fecha_prescripcion', 'valor_total']


class DispensacionMedicamentoViewSet(viewsets.ModelViewSet):
    serializer_class = DispensacionMedicamentoSerializer

    def get_queryset(self):
        qs = DispensacionMedicamento.objects.select_related(
            'paciente', 'ingreso', 'medicamento', 'lote',
            'medico_prescriptor', 'dispensado_por',
        )
        paciente = self.request.query_params.get('paciente')
        ingreso = self.request.query_params.get('ingreso')
        estado = self.request.query_params.get('estado')
        if paciente:
            qs = qs.filter(paciente=paciente)
        if ingreso:
            qs = qs.filter(ingreso=ingreso)
        if estado:
            qs = qs.filter(estado=estado)
        return qs

    def perform_create(self, serializer):
        serializer.save(medico_prescriptor=self.request.user)

    @action(detail=True, methods=['post'])
    def dispensar(self, request, pk=None):
        """POST /api/farmacia/dispensaciones/{id}/dispensar/ — marca como dispensado."""
        disp = self.get_object()
        if disp.estado != 'pendiente':
            return Response({'error': f'No se puede dispensar (estado actual: {disp.estado}).'}, status=status.HTTP_400_BAD_REQUEST)
        disp.estado = 'dispensado'
        disp.dispensado_por = request.user
        disp.fecha_dispensacion = timezone.now()
        observaciones = request.data.get('observaciones', '')
        if observaciones:
            disp.observaciones = observaciones
        disp.save()
        return Response(self.get_serializer(disp).data)


# ── Solicitud Laboratorio ─────────────────────────────────────────────────────

class SolicitudLaboratorioSerializer(serializers.ModelSerializer):
    paciente_nombre = serializers.CharField(source='paciente.nombre_completo', read_only=True)
    estado_label = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model = SolicitudLaboratorio
        fields = '__all__'
        read_only_fields = ['id', 'fecha_solicitud']


class SolicitudLaboratorioViewSet(viewsets.ModelViewSet):
    serializer_class = SolicitudLaboratorioSerializer

    def get_queryset(self):
        qs = SolicitudLaboratorio.objects.select_related(
            'paciente', 'ingreso', 'medico_solicitante', 'tomado_por',
        )
        paciente = self.request.query_params.get('paciente')
        ingreso = self.request.query_params.get('ingreso')
        estado = self.request.query_params.get('estado')
        urgente = self.request.query_params.get('urgente')
        if paciente:
            qs = qs.filter(paciente=paciente)
        if ingreso:
            qs = qs.filter(ingreso=ingreso)
        if estado:
            qs = qs.filter(estado=estado)
        if urgente is not None:
            qs = qs.filter(urgente=urgente.lower() == 'true')
        return qs

    def perform_create(self, serializer):
        serializer.save(medico_solicitante=self.request.user)

    @action(detail=True, methods=['post'])
    def marcar_tomada(self, request, pk=None):
        """POST /api/laboratorio/solicitudes/{id}/marcar_tomada/ — registra toma de muestra."""
        sol = self.get_object()
        sol.estado = 'tomada'
        sol.tomado_por = request.user
        sol.fecha_toma_muestra = timezone.now()
        observaciones = request.data.get('observaciones', '')
        if observaciones:
            sol.observaciones = observaciones
        sol.save()
        return Response(self.get_serializer(sol).data)


# ── Resultado Laboratorio ─────────────────────────────────────────────────────

class ResultadoLaboratorioSerializer(serializers.ModelSerializer):
    estado_label = serializers.CharField(source='get_estado_resultado_display', read_only=True)

    class Meta:
        model = ResultadoLaboratorio
        fields = '__all__'
        read_only_fields = ['id']


class ResultadoLaboratorioViewSet(viewsets.ModelViewSet):
    serializer_class = ResultadoLaboratorioSerializer

    def get_queryset(self):
        qs = ResultadoLaboratorio.objects.select_related(
            'solicitud__paciente', 'laboratorista', 'validado_por',
        )
        solicitud = self.request.query_params.get('solicitud')
        if solicitud:
            qs = qs.filter(solicitud=solicitud)
        return qs

    def perform_create(self, serializer):
        serializer.save(laboratorista=self.request.user)

    @action(detail=True, methods=['post'])
    def validar(self, request, pk=None):
        """POST /api/laboratorio/resultados/{id}/validar/ — valida el resultado."""
        resultado = self.get_object()
        if resultado.validado:
            return Response({'error': 'El resultado ya está validado.'}, status=status.HTTP_400_BAD_REQUEST)
        resultado.validado = True
        resultado.validado_por = request.user
        resultado.save(update_fields=['validado', 'validado_por'])
        # Actualizar estado de solicitud si todos los resultados están validados
        solicitud = resultado.solicitud
        if not solicitud.resultados.filter(validado=False).exists():
            solicitud.estado = 'resultado'
            solicitud.save(update_fields=['estado'])
        return Response(self.get_serializer(resultado).data)


# ════════════════════════════════════════════════════════════════════════════
# PHASE 5 — RRHH, OPERACIONES, EPIDEMIOLOGÍA, CONTABILIDAD
# ════════════════════════════════════════════════════════════════════════════

from apps.rrhh.models import Cargo, ContratoEmpleado, Turno, LiquidacionNomina, Incapacidad
from apps.operaciones.models import (
    EquipoEsterilizable, CicloEsterilizacion,
    EquipoBiomedico, OrdenMantenimiento, DietaTerapeutica,
)
from apps.epidemiologia.models import NotificacionSIVIGILA, BrotEpidemico
from apps.contabilidad.models import CuentaContable, AsientoContable, LineaAsiento, PresupuestoAnual


# ── RRHH ──────────────────────────────────────────────────────────────────────

class CargoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cargo
        fields = '__all__'
        read_only_fields = ['id']


class CargoViewSet(viewsets.ModelViewSet):
    serializer_class = CargoSerializer
    queryset = Cargo.objects.all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nombre', 'departamento']


class ContratoEmpleadoSerializer(serializers.ModelSerializer):
    empleado_nombre = serializers.CharField(source='empleado.get_full_name', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model = ContratoEmpleado
        fields = '__all__'
        read_only_fields = ['id', 'creado_en']


class ContratoEmpleadoViewSet(viewsets.ModelViewSet):
    serializer_class = ContratoEmpleadoSerializer

    def get_queryset(self):
        qs = ContratoEmpleado.objects.select_related('empleado', 'cargo')
        emp = self.request.query_params.get('empleado')
        if emp:
            qs = qs.filter(empleado=emp)
        est = self.request.query_params.get('estado')
        if est:
            qs = qs.filter(estado=est)
        return qs


class TurnoSerializer(serializers.ModelSerializer):
    empleado_nombre = serializers.CharField(source='empleado.get_full_name', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model = Turno
        fields = '__all__'
        read_only_fields = ['id']


class TurnoViewSet(viewsets.ModelViewSet):
    serializer_class = TurnoSerializer

    def get_queryset(self):
        qs = Turno.objects.select_related('empleado')
        emp = self.request.query_params.get('empleado')
        if emp:
            qs = qs.filter(empleado=emp)
        fecha = self.request.query_params.get('fecha')
        if fecha:
            qs = qs.filter(fecha=fecha)
        tipo = self.request.query_params.get('tipo')
        if tipo:
            qs = qs.filter(tipo=tipo)
        return qs

    @action(detail=False, methods=['post'], url_path='programar-semana')
    def programar_semana(self, request):
        """POST /api/rrhh/turnos/programar-semana/ — crea/actualiza turnos en lote para una semana.
        Body: { turnos: [ {empleado, fecha, tipo, hora_inicio, hora_fin, servicio}, ... ] }
        """
        turnos_data = request.data.get('turnos', [])
        if not turnos_data:
            return Response({'error': 'Se requiere la lista de turnos.'}, status=status.HTTP_400_BAD_REQUEST)
        creados = 0
        actualizados = 0
        errores = []
        for item in turnos_data:
            try:
                empleado_id = item.get('empleado')
                fecha = item.get('fecha')
                defaults = {k: v for k, v in item.items() if k not in ('empleado', 'fecha')}
                _, created = Turno.objects.update_or_create(
                    empleado_id=empleado_id, fecha=fecha, defaults=defaults,
                )
                if created:
                    creados += 1
                else:
                    actualizados += 1
            except Exception as exc:
                errores.append({'data': item, 'error': str(exc)})
        return Response(
            {'creados': creados, 'actualizados': actualizados, 'errores': errores},
            status=status.HTTP_201_CREATED,
        )


class LiquidacionNominaSerializer(serializers.ModelSerializer):
    empleado_nombre = serializers.CharField(source='empleado.get_full_name', read_only=True)

    class Meta:
        model = LiquidacionNomina
        fields = '__all__'
        read_only_fields = ['id', 'total_devengado', 'total_descuentos', 'neto_pagar', 'creado_en']


class LiquidacionNominaViewSet(viewsets.ModelViewSet):
    serializer_class = LiquidacionNominaSerializer

    def get_queryset(self):
        qs = LiquidacionNomina.objects.select_related('empleado', 'contrato')
        emp = self.request.query_params.get('empleado')
        if emp:
            qs = qs.filter(empleado=emp)
        est = self.request.query_params.get('estado')
        if est:
            qs = qs.filter(estado=est)
        return qs

    @action(detail=True, methods=['post'])
    def aprobar(self, request, pk=None):
        """POST /api/rrhh/nomina/{id}/aprobar/ — aprueba la liquidación."""
        liq = self.get_object()
        if liq.estado != 'borrador':
            return Response({'error': 'Solo se pueden aprobar liquidaciones en borrador.'}, status=status.HTTP_400_BAD_REQUEST)
        liq.estado = 'aprobada'
        liq.save(update_fields=['estado'])
        return Response(self.get_serializer(liq).data)

    @action(detail=True, methods=['post'])
    def pagar(self, request, pk=None):
        """POST /api/rrhh/nomina/{id}/pagar/ — registra la liquidación como pagada."""
        liq = self.get_object()
        if liq.estado != 'aprobada':
            return Response({'error': 'Solo se pueden pagar liquidaciones aprobadas.'}, status=status.HTTP_400_BAD_REQUEST)
        liq.estado = 'pagada'
        liq.save(update_fields=['estado'])
        return Response(self.get_serializer(liq).data)


class IncapacidadSerializer(serializers.ModelSerializer):
    empleado_nombre = serializers.CharField(source='empleado.get_full_name', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model = Incapacidad
        fields = '__all__'
        read_only_fields = ['id', 'dias', 'creado_en']


class IncapacidadViewSet(viewsets.ModelViewSet):
    serializer_class = IncapacidadSerializer

    def get_queryset(self):
        qs = Incapacidad.objects.select_related('empleado')
        emp = self.request.query_params.get('empleado')
        if emp:
            qs = qs.filter(empleado=emp)
        return qs


# ── ESTERILIZACIÓN ────────────────────────────────────────────────────────────

class EquipoEsterilizableSerializer(serializers.ModelSerializer):
    class Meta:
        model = EquipoEsterilizable
        fields = '__all__'
        read_only_fields = ['id']


class EquipoEsterilizableViewSet(viewsets.ModelViewSet):
    serializer_class = EquipoEsterilizableSerializer
    queryset = EquipoEsterilizable.objects.all()
    filter_backends = [filters.SearchFilter]
    search_fields = ['codigo', 'nombre']


class CicloEsterilizacionSerializer(serializers.ModelSerializer):
    metodo_display = serializers.CharField(source='get_metodo_display', read_only=True)
    operador_nombre = serializers.CharField(source='operador.get_full_name', read_only=True)

    class Meta:
        model = CicloEsterilizacion
        fields = '__all__'
        read_only_fields = ['id', 'numero_ciclo', 'creado_en']


class CicloEsterilizacionViewSet(viewsets.ModelViewSet):
    serializer_class = CicloEsterilizacionSerializer

    def get_queryset(self):
        qs = CicloEsterilizacion.objects.select_related('operador').prefetch_related('equipos')
        resultado = self.request.query_params.get('resultado')
        if resultado:
            qs = qs.filter(resultado=resultado)
        return qs


# ── MANTENIMIENTO BIOMÉDICO ────────────────────────────────────────────────────

class EquipoBiomedicoSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model = EquipoBiomedico
        fields = '__all__'
        read_only_fields = ['id']


class EquipoBiomedicoViewSet(viewsets.ModelViewSet):
    serializer_class = EquipoBiomedicoSerializer
    queryset = EquipoBiomedico.objects.all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['codigo_inventario', 'nombre', 'serial', 'marca']


class OrdenMantenimientoSerializer(serializers.ModelSerializer):
    equipo_nombre = serializers.CharField(source='equipo.nombre', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model = OrdenMantenimiento
        fields = '__all__'
        read_only_fields = ['id', 'numero_orden', 'fecha_solicitud']


class OrdenMantenimientoViewSet(viewsets.ModelViewSet):
    serializer_class = OrdenMantenimientoSerializer

    def get_queryset(self):
        qs = OrdenMantenimiento.objects.select_related('equipo', 'solicitado_por')
        equipo = self.request.query_params.get('equipo')
        if equipo:
            qs = qs.filter(equipo=equipo)
        est = self.request.query_params.get('estado')
        if est:
            qs = qs.filter(estado=est)
        return qs

    def perform_create(self, serializer):
        serializer.save(solicitado_por=self.request.user)


# ── NUTRICIÓN ─────────────────────────────────────────────────────────────────

class DietaTerapeuticaSerializer(serializers.ModelSerializer):
    tipo_dieta_display = serializers.CharField(source='get_tipo_dieta_display', read_only=True)

    class Meta:
        model = DietaTerapeutica
        fields = '__all__'
        read_only_fields = ['id', 'creado_en']


class DietaTerapeuticaViewSet(viewsets.ModelViewSet):
    serializer_class = DietaTerapeuticaSerializer

    def get_queryset(self):
        qs = DietaTerapeutica.objects.select_related('paciente', 'ingreso', 'medico_prescriptor')
        paciente = self.request.query_params.get('paciente')
        if paciente:
            qs = qs.filter(paciente=paciente)
        ingreso = self.request.query_params.get('ingreso')
        if ingreso:
            qs = qs.filter(ingreso=ingreso)
        return qs


# ── EPIDEMIOLOGÍA / SIVIGILA ───────────────────────────────────────────────────

class NotificacionSIVIGILASerializer(serializers.ModelSerializer):
    evento_display = serializers.CharField(source='get_evento_display', read_only=True)
    clasificacion_display = serializers.CharField(source='get_clasificacion_display', read_only=True)
    paciente_nombre = serializers.CharField(source='paciente.__str__', read_only=True)

    class Meta:
        model = NotificacionSIVIGILA
        fields = '__all__'
        read_only_fields = ['id', 'creado_en', 'actualizado_en']


class NotificacionSIVIGILAViewSet(viewsets.ModelViewSet):
    serializer_class = NotificacionSIVIGILASerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['evento', 'numero_sivigila']

    def get_queryset(self):
        qs = NotificacionSIVIGILA.objects.select_related('paciente', 'notificado_por')
        evento = self.request.query_params.get('evento')
        if evento:
            qs = qs.filter(evento=evento)
        estado = self.request.query_params.get('estado')
        if estado:
            qs = qs.filter(estado=estado)
        return qs

    def perform_create(self, serializer):
        serializer.save(notificado_por=self.request.user)


class BrotEpidemicoSerializer(serializers.ModelSerializer):
    evento_display = serializers.CharField(source='get_evento_display', read_only=True)

    class Meta:
        model = BrotEpidemico
        fields = '__all__'
        read_only_fields = ['id', 'creado_en']


class BrotEpidemicoViewSet(viewsets.ModelViewSet):
    serializer_class = BrotEpidemicoSerializer

    def get_queryset(self):
        return BrotEpidemico.objects.prefetch_related('notificaciones').select_related('responsable')


# ── CONTABILIDAD ──────────────────────────────────────────────────────────────

class CuentaContableSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model = CuentaContable
        fields = '__all__'
        read_only_fields = ['id']


class CuentaContableViewSet(viewsets.ModelViewSet):
    serializer_class = CuentaContableSerializer
    queryset = CuentaContable.objects.all()
    filter_backends = [filters.SearchFilter]
    search_fields = ['codigo', 'nombre']


class LineaAsientoSerializer(serializers.ModelSerializer):
    class Meta:
        model = LineaAsiento
        fields = '__all__'
        read_only_fields = ['id']


class AsientoContableSerializer(serializers.ModelSerializer):
    lineas = LineaAsientoSerializer(many=True, required=False)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model = AsientoContable
        fields = '__all__'
        read_only_fields = ['id', 'numero', 'creado_en']

    def create(self, validated_data):
        lineas_data = validated_data.pop('lineas', [])
        asiento = AsientoContable.objects.create(**validated_data)
        for linea in lineas_data:
            LineaAsiento.objects.create(asiento=asiento, **linea)
        return asiento


class AsientoContableViewSet(viewsets.ModelViewSet):
    serializer_class = AsientoContableSerializer

    def get_queryset(self):
        qs = AsientoContable.objects.prefetch_related('lineas').select_related('creado_por')
        tipo = self.request.query_params.get('tipo')
        if tipo:
            qs = qs.filter(tipo=tipo)
        estado = self.request.query_params.get('estado')
        if estado:
            qs = qs.filter(estado=estado)
        return qs

    def perform_create(self, serializer):
        serializer.save(creado_por=self.request.user)


class PresupuestoAnualSerializer(serializers.ModelSerializer):
    class Meta:
        model = PresupuestoAnual
        fields = '__all__'
        read_only_fields = ['id', 'creado_en']


class PresupuestoAnualViewSet(viewsets.ModelViewSet):
    serializer_class = PresupuestoAnualSerializer
    queryset = PresupuestoAnual.objects.all()

