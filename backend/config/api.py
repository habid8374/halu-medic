"""
API REST — Serializers y ViewSets principales
Endpoints disponibles:
  /api/pacientes/
  /api/citas/
  /api/consultas/
  /api/facturacion/facturas/
  /api/facturacion/facturas/{id}/emitir/
"""
from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone

# ── PACIENTES ─────────────────────────────────────────────────────────────────

from apps.pacientes.models import Paciente, Aseguradora
from apps.tarifas.models import ManualTarifario


class AseguradoraSerializer(serializers.ModelSerializer):
    class Meta:
        model = Aseguradora
        fields = ['id', 'nombre', 'nit', 'codigo', 'tipo']


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

from apps.consultas.models import Consulta, Procedimiento
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

    class Meta:
        model = Factura
        fields = [
            'id', 'consulta', 'consulta_info', 'convenio',
            'numero_factus', 'cufe', 'qr_url',
            'subtotal', 'descuento', 'iva', 'total', 'valor_copago',
            'estado', 'errores_dian', 'tiene_rips', 'cuv',
            'fecha_validacion', 'creado_en',
        ]
        read_only_fields = [
            'id', 'numero_factus', 'cufe', 'qr_url', 'pdf_base64',
            'estado', 'errores_dian', 'cuv', 'fecha_validacion', 'creado_en',
        ]

    def get_consulta_info(self, obj):
        return {
            'paciente': obj.consulta.paciente.nombre_completo,
            'fecha': obj.consulta.fecha_atencion,
            'cups': obj.consulta.cups_principal,
            'diagnostico': obj.consulta.diagnostico_principal,
        }

    def get_tiene_rips(self, obj):
        return obj.rips_json is not None


class FacturaViewSet(viewsets.ModelViewSet):
    serializer_class = FacturaSerializer
    ordering = ['-creado_en']
    search_fields = ['numero_factus', 'cufe', 'consulta__paciente__numero_identificacion']

    def get_queryset(self):
        return Factura.objects.select_related('consulta__paciente', 'convenio')

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
        Devuelve el JSON RIPS generado para esta factura.
        """
        factura = self.get_object()
        if not factura.rips_json:
            return Response(
                {'error': 'RIPS aún no generado para esta factura.'},
                status=status.HTTP_404_NOT_FOUND
            )
        return Response(factura.rips_json)

    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        """
        GET /api/facturacion/facturas/{id}/pdf/
        Devuelve el PDF en base64 para descarga en el frontend.
        """
        factura = self.get_object()
        if not factura.pdf_base64:
            return Response(
                {'error': 'PDF no disponible. La factura aún no ha sido validada.'},
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
        Resetea el estado a BORRADOR y reenvía a Factus.
        Útil cuando la factura quedó en ERROR o ENVIADA sin respuesta.
        """
        factura = self.get_object()

        if factura.estado == EstadoFactura.VALIDADA:
            return Response(
                {'error': 'La factura ya fue validada por la DIAN. No se puede reintentar.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if factura.estado == EstadoFactura.ANULADA:
            return Response(
                {'error': 'No se puede reintentar una factura anulada.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Resetear estado para permitir el reenvío
        factura.estado = EstadoFactura.BORRADOR
        factura.errores_dian = []
        factura.save(update_fields=['estado', 'errores_dian'])

        from apps.facturacion.factus_salud import FactusSaludClient, construir_payload_auto
        from apps.facturacion.factus_client import FactusAPIError
        from apps.rips.generador import GeneradorRIPS
        from django.utils import timezone as tz

        try:
            gen  = GeneradorRIPS(factura)
            rips = gen.generar()
            errs = gen.validar(rips)
            if errs:
                factura.estado      = EstadoFactura.ERROR
                factura.errores_dian = errs
                factura.save(update_fields=['estado', 'errores_dian'])
                return Response({'error': 'RIPS inválido', 'detalles': errs}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

            factura.rips_json = rips
            factura.estado    = EstadoFactura.ENVIADA
            factura.save(update_fields=['rips_json', 'estado'])

            payload = construir_payload_auto(factura)
            with FactusSaludClient() as client:
                resultado = client.crear_factura_salud(payload)

            factura.numero_factus    = resultado.get('number', '')
            factura.cufe             = resultado.get('cufe', '')
            factura.qr_url           = resultado.get('qr', '')
            factura.pdf_base64       = resultado.get('pdf_base_64', '') or resultado.get('qr_image', '')
            factura.xml_base64       = resultado.get('xml_base_64', '')
            factura.estado           = EstadoFactura.VALIDADA if not resultado.get('errors') else EstadoFactura.ERROR
            factura.fecha_validacion = tz.now()
            factura.errores_dian     = resultado.get('errors', [])
            factura.save()

            if factura.estado == EstadoFactura.VALIDADA:
                factura.consulta.estado = 'facturada'
                factura.consulta.save(update_fields=['estado'])

            return Response({
                'mensaje': 'Factura reenviada a Factus.',
                'estado': factura.estado,
                'numero': factura.numero_factus,
                'cufe': factura.cufe,
            }, status=status.HTTP_200_OK)

        except FactusAPIError as e:
            factura.estado = EstadoFactura.ERROR
            factura.errores_dian = [str(e)]
            factura.save(update_fields=['estado', 'errores_dian'])
            return Response({'error': f'Error Factus: {str(e)}'}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as e:
            factura.estado = EstadoFactura.ERROR
            factura.errores_dian = [str(e)]
            factura.save(update_fields=['estado', 'errores_dian'])
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
