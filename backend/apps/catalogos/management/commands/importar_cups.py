"""
Carga el homologador CUPS al schema público.

Por defecto lee el archivo comprimido que viene incluido en el repositorio
(apps/catalogos/data/cups_homologador.json.gz, ~10.000 códigos).

Uso:
    python manage.py importar_cups
    python manage.py importar_cups --archivo ruta/al/SUPERHOMOLOGADOR.xlsm
"""
import gzip
import json
import os

from django.core.management.base import BaseCommand
from django_tenants.utils import schema_context

from apps.catalogos.models import CodigoCUPS

DATA_GZ = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    'data', 'cups_homologador.json.gz'
)


def _leer_json_gz(ruta):
    with gzip.open(ruta, 'rt', encoding='utf-8') as f:
        return json.load(f)


def _leer_xlsm(ruta):
    """Lee la hoja 'HOMOLOGADOR CON REPS' de un .xlsm original."""
    import openpyxl
    wb = openpyxl.load_workbook(ruta, read_only=True, data_only=True)
    ws = wb['HOMOLOGADOR CON REPS']

    def clean(v):
        return '' if v is None else str(v).strip()

    out, seen = [], set()
    for r in ws.iter_rows(min_row=3, values_only=True):
        cups = clean(r[0])
        if not cups:
            continue
        if cups.isdigit() and len(cups) < 6:
            cups = cups.zfill(6)
        desc = clean(r[4])
        if not desc or cups in seen:
            continue
        seen.add(cups)
        out.append({'c': cups, 'd': desc, 'n': clean(r[3]), 'g': clean(r[2]),
                    'cob': clean(r[5]), 'reps': clean(r[1]), 'grips': clean(r[9])})
    return out


class Command(BaseCommand):
    help = 'Importa el homologador CUPS al schema público'

    def add_arguments(self, parser):
        parser.add_argument('--archivo', help='Ruta a un .xlsm o .json.gz alternativo')

    def handle(self, *args, **opts):
        ruta = opts.get('archivo') or DATA_GZ
        if not os.path.exists(ruta):
            self.stderr.write(self.style.ERROR(f'No existe el archivo: {ruta}'))
            return

        if ruta.endswith('.xlsm') or ruta.endswith('.xlsx'):
            registros = _leer_xlsm(ruta)
        else:
            registros = _leer_json_gz(ruta)

        self.stdout.write(f'Leídos {len(registros)} códigos CUPS de {os.path.basename(ruta)}')

        objetos = [
            CodigoCUPS(
                codigo=item['c'],
                descripcion=item['d'],
                nombre_servicio=item.get('n', ''),
                grupo_servicio=item.get('g', ''),
                cobertura=item.get('cob', ''),
                codigo_reps=item.get('reps', ''),
                grupo_rips=item.get('grips', ''),
            )
            for item in registros
        ]

        # El catálogo es compartido: siempre en el schema público.
        with schema_context('public'):
            CodigoCUPS.objects.all().delete()
            CodigoCUPS.objects.bulk_create(objetos, batch_size=1000)
            total = CodigoCUPS.objects.count()

        self.stdout.write(self.style.SUCCESS(f'✓ {total} códigos CUPS cargados en el schema público'))
