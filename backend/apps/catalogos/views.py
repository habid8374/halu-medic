import csv
import io
from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def plantilla_cups_rips(request):
    """Descarga plantilla CSV para carga masiva de CUPS con campos RIPS."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'codigo_cups', 'descripcion',
        'modalidad_rips',       # 01=Intramural, 02=Extramural, 05=Telemedicina
        'grupo_servicios_rips', # 01=Consulta, 02=Urgencias, 04=Cirugía, 05=Procedimientos
        'finalidad_rips',       # 10=Dx, 11=Tto, 13=Dx+Tto
        'via_ingreso_rips',     # 1=Urgencias, 2=Consulta externa, 5=Electiva
        'cod_servicio_rips',    # Código REPS del servicio habilitado
        'personal_atiende',     # 01=Med esp, 02=Med gral
        'ambito_rips',          # 1=Ambulatorio, 2=Hospitalario
    ])
    # Filas de ejemplo
    examples = [
        ['890201', 'CONSULTA DE PRIMERA VEZ POR MEDICINA GENERAL', '01', '01', '13', '2', '1', '02', '1'],
        ['890202', 'CONSULTA DE CONTROL O DE SEGUIMIENTO POR MEDICINA GENERAL', '01', '01', '13', '2', '1', '02', '1'],
        ['890401', 'CONSULTA DE PRIMERA VEZ POR MEDICINA ESPECIALIZADA', '01', '01', '13', '2', '1', '01', '1'],
        ['890402', 'CONSULTA DE CONTROL O DE SEGUIMIENTO POR MEDICINA ESPECIALIZADA', '01', '01', '13', '2', '1', '01', '1'],
    ]
    writer.writerows(examples)
    response = HttpResponse(output.getvalue(), content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = 'attachment; filename="plantilla_cups_rips.csv"'
    return response


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def importar_cups_rips(request):
    """Importa CSV con campos RIPS para CUPS existentes."""
    from apps.catalogos.models import CodigoCUPS
    archivo = request.FILES.get('archivo')
    if not archivo:
        return Response({'error': 'Se requiere el archivo CSV'}, status=400)

    content = archivo.read().decode('utf-8-sig')
    reader = csv.DictReader(io.StringIO(content))
    actualizados = 0
    errores = []

    for i, row in enumerate(reader, 1):
        codigo = row.get('codigo_cups', '').strip()
        if not codigo:
            continue
        try:
            cups = CodigoCUPS.objects.get(codigo=codigo)
            cups.modalidad_rips       = row.get('modalidad_rips', '').strip()
            cups.grupo_servicios_rips = row.get('grupo_servicios_rips', '').strip()
            cups.finalidad_rips       = row.get('finalidad_rips', '').strip()
            cups.via_ingreso_rips     = row.get('via_ingreso_rips', '').strip()
            cups.cod_servicio_rips    = row.get('cod_servicio_rips', '').strip()
            cups.personal_atiende     = row.get('personal_atiende', '').strip()
            cups.ambito_rips          = row.get('ambito_rips', '').strip()
            cups.save()
            actualizados += 1
        except CodigoCUPS.DoesNotExist:
            errores.append(f'Fila {i}: CUPS {codigo} no existe en el catálogo')
        except Exception as e:
            errores.append(f'Fila {i}: {e}')

    return Response({'actualizados': actualizados, 'errores': errores})
