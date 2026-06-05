"""
Carga el catálogo CIE-10 al schema público.

El archivo comprimido cie10.json.gz (~12.634 diagnósticos) está incluido
en el repositorio dentro de apps/catalogos/data/.

Uso:
    python manage.py importar_cie10
    python manage.py importar_cie10 --archivo ruta/TablaReferencia_CIE10.xlsx
"""
import gzip
import json
import os

from django.core.management.base import BaseCommand
from django_tenants.utils import schema_context

from apps.catalogos.models import CodigoCIE10

DATA_GZ = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    'data', 'cie10.json.gz'
)


def _leer_json_gz(ruta):
    with gzip.open(ruta, 'rt', encoding='utf-8') as f:
        return json.load(f)


def _leer_xlsx(ruta):
    import openpyxl
    wb = openpyxl.load_workbook(ruta, read_only=True, data_only=True)
    ws = wb['Table']

    def clean(v):
        return '' if v is None else str(v).strip()

    out, seen = [], set()
    for r in ws.iter_rows(min_row=2, values_only=True):
        cod = clean(r[1])
        if not cod or cod in seen:
            continue
        seen.add(cod)
        out.append({
            'c': cod, 'n': clean(r[2]), 'd': clean(r[3]), 'h': clean(r[4]),
            'cap': clean(r[13]), 'cap_d': clean(r[12]),
            'sexo': clean(r[17]), 'e_min': clean(r[9]), 'e_max': clean(r[10]),
        })
    return out


def _to_int(v, default):
    try:
        return int(v)
    except (TypeError, ValueError):
        return default


class Command(BaseCommand):
    help = 'Importa el catálogo CIE-10 al schema público'

    def add_arguments(self, parser):
        parser.add_argument('--archivo', help='Ruta a un .xlsx o .json.gz alternativo')

    def handle(self, *args, **opts):
        ruta = opts.get('archivo') or DATA_GZ
        if not os.path.exists(ruta):
            self.stderr.write(self.style.ERROR(f'No existe el archivo: {ruta}'))
            return

        if ruta.endswith('.xlsx') or ruta.endswith('.xls'):
            registros = _leer_xlsx(ruta)
        else:
            registros = _leer_json_gz(ruta)

        self.stdout.write(f'Leídos {len(registros)} diagnósticos CIE-10 de {os.path.basename(ruta)}')

        objetos = [
            CodigoCIE10(
                codigo=item['c'],
                nombre=item['n'],
                descripcion=item.get('d', ''),
                capitulo_codigo=item.get('cap', ''),
                capitulo_desc=item.get('cap_d', ''),
                habilitado=(item.get('h', 'SI').upper() == 'SI'),
                sexo=item.get('sexo', 'A') or 'A',
                edad_minima=_to_int(item.get('e_min'), 0),
                edad_maxima=_to_int(item.get('e_max'), 999),
            )
            for item in registros
        ]

        with schema_context('public'):
            CodigoCIE10.objects.all().delete()
            CodigoCIE10.objects.bulk_create(objetos, batch_size=1000)
            total = CodigoCIE10.objects.count()

        self.stdout.write(self.style.SUCCESS(f'✓ {total} diagnósticos CIE-10 cargados en el schema público'))
