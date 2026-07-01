"""
Carga masiva de puntos UVR (ISS 2001) y/o grupo quirúrgico SOAT
al catálogo nacional de CUPS.

Formato CSV (con encabezado, separador coma o punto y coma):
    codigo,uvr,grupo_soat
    319003,80,7
    314103,40,5

Las columnas uvr y grupo_soat son opcionales (se actualiza lo que venga).

Uso:
    python manage.py importar_uvr archivo.csv
    python manage.py importar_uvr archivo.csv --dry-run
"""
import csv
from decimal import Decimal, InvalidOperation
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Importa puntos UVR y grupo SOAT al catálogo CUPS desde un CSV'

    def add_arguments(self, parser):
        parser.add_argument('archivo', help='Ruta del archivo CSV')
        parser.add_argument('--dry-run', action='store_true',
                            help='Solo validar, sin guardar cambios')

    def handle(self, *args, **options):
        from apps.catalogos.models import CodigoCUPS

        ruta = options['archivo']
        try:
            contenido = open(ruta, encoding='utf-8-sig').read()
        except OSError as e:
            raise CommandError(f'No se pudo leer el archivo: {e}')

        delim = ';' if contenido.splitlines()[0].count(';') > contenido.splitlines()[0].count(',') else ','
        reader = csv.DictReader(contenido.splitlines(), delimiter=delim)
        if not reader.fieldnames or 'codigo' not in [f.strip().lower() for f in reader.fieldnames]:
            raise CommandError('El CSV debe tener encabezado con la columna "codigo" (y uvr y/o grupo_soat).')

        actualizados = no_encontrados = errores = 0
        for n, fila in enumerate(reader, start=2):
            fila = {(k or '').strip().lower(): (v or '').strip() for k, v in fila.items()}
            codigo = fila.get('codigo', '').strip()
            if not codigo:
                continue
            cups = CodigoCUPS.objects.filter(codigo=codigo).first()
            if not cups:
                no_encontrados += 1
                self.stdout.write(self.style.WARNING(f'  Línea {n}: CUPS {codigo} no existe en el catálogo'))
                continue

            cambios = []
            uvr_raw = fila.get('uvr', '').replace(',', '.')
            if uvr_raw:
                try:
                    cups.uvr = Decimal(uvr_raw)
                    cambios.append('uvr')
                except InvalidOperation:
                    errores += 1
                    self.stdout.write(self.style.ERROR(f'  Línea {n}: UVR inválido "{uvr_raw}"'))
                    continue
            grupo_raw = fila.get('grupo_soat', '')
            if grupo_raw:
                try:
                    grupo = int(grupo_raw)
                    if grupo not in list(range(2, 14)) + [20, 21, 22, 23]:
                        raise ValueError
                    cups.grupo_soat = grupo
                    cambios.append('grupo_soat')
                except ValueError:
                    errores += 1
                    self.stdout.write(self.style.ERROR(f'  Línea {n}: grupo SOAT inválido "{grupo_raw}" (válidos: 2-13, 20-23)'))
                    continue

            if cambios:
                if not options['dry_run']:
                    cups.save(update_fields=cambios)
                actualizados += 1

        accion = 'Validados' if options['dry_run'] else 'Actualizados'
        self.stdout.write(self.style.SUCCESS(
            f'\n✓ {accion}: {actualizados} · No encontrados: {no_encontrados} · Errores: {errores}'
        ))
        if options['dry_run']:
            self.stdout.write('  (dry-run: no se guardó nada)')
