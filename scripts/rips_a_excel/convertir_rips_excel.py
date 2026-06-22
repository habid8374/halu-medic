# -*- coding: utf-8 -*-
"""
Convertir RIPS (JSON Res.948/2275 y TXT Res.3374) a Excel por EPS y año
=======================================================================

Recorre una o varias carpetas de RIPS con la estructura:

    <ORIGEN>/  (ej. "D:/RIPS 2026")
        RIPS ENERO 2026/
            NUEVA EPS/
                *.json   ó   AF*.txt, US*.txt, AC*.txt, ...
            SALUD TOTAL/
                ...
        RIPS FEBRERO 2026/
            ...

…y genera UN archivo Excel por cada (EPS, AÑO) con una hoja por tipo de
servicio (Consultas, Procedimientos, Medicamentos, Urgencias, etc.) más una
hoja "Resumen" para el informe.

Soporta los dos formatos de RIPS que conviven en Colombia:
  • JSON  → Resolución 948 de 2026 / 2275 de 2023 (estructura anidada por usuario)
  • TXT   → Resolución 3374 de 2000 (archivos AF, US, AC, AP, AU, AH, AN, AM, AT, CT)

La EPS se toma del nombre de la subcarpeta (mes → EPS → archivos).
El año y el mes se toman del nombre de la carpeta del mes ("RIPS ENERO 2026").

USO (desde la terminal de Windows / PowerShell):
    python convertir_rips_excel.py --origen "D:\\RIPS 2026"
    python convertir_rips_excel.py --origen "D:\\RIPS 2024" --origen "D:\\RIPS 2025" --origen "D:\\RIPS 2026"
    python convertir_rips_excel.py --origen "D:\\RIPS 2026" --salida "D:\\RIPS 2026\\_EXCEL"

Requisitos:
    pip install pandas openpyxl
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import unicodedata
from collections import defaultdict
from datetime import datetime
from pathlib import Path

try:
    import pandas as pd
except ImportError:
    print("\n[ERROR] Falta la librería 'pandas'. Instálala con:\n"
          "        pip install pandas openpyxl\n")
    sys.exit(1)


# ────────────────────────────────────────────────────────────────────────────
# Tablas de apoyo
# ────────────────────────────────────────────────────────────────────────────

MESES = {
    'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4, 'MAYO': 5, 'JUNIO': 6,
    'JULIO': 7, 'AGOSTO': 8, 'SEPTIEMBRE': 9, 'SETIEMBRE': 9, 'OCTUBRE': 10,
    'NOVIEMBRE': 11, 'DICIEMBRE': 12,
}
MES_NOMBRE = {v: k for k, v in MESES.items() if k != 'SETIEMBRE'}

# Prefijos de los archivos TXT de RIPS (Res. 3374/2000) → hoja destino
PREFIJOS_TXT = {
    'AF': 'Facturas',
    'US': 'Usuarios',
    'AC': 'Consultas',
    'AP': 'Procedimientos',
    'AU': 'Urgencias',
    'AH': 'Hospitalizacion',
    'AN': 'RecienNacidos',
    'AM': 'Medicamentos',
    'AT': 'OtrosServicios',
    'AD': 'OtrosServicios',   # algunas variantes nombran "AD" otros servicios
    # 'CT' (control) se ignora — solo lleva totales de cuadre
}

# Orden de hojas en el libro
ORDEN_HOJAS = [
    'Resumen', 'Facturas', 'Usuarios', 'Consultas', 'Procedimientos',
    'Urgencias', 'Hospitalizacion', 'RecienNacidos', 'Medicamentos',
    'OtrosServicios',
]


# ────────────────────────────────────────────────────────────────────────────
# Utilidades de detección (año, mes, EPS, encoding)
# ────────────────────────────────────────────────────────────────────────────

def buscar_anio(texto: str) -> int | None:
    m = re.search(r'(20\d{2})', texto or '')
    return int(m.group(1)) if m else None


def buscar_mes(texto: str) -> int | None:
    t = quitar_tildes((texto or '').upper())
    for nombre, num in MESES.items():
        if nombre in t:
            return num
    return None


def quitar_tildes(s: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFKD', s)
                   if not unicodedata.combining(c))


def anio_de_ancestros(carpeta: Path) -> int | None:
    """Busca un año en el nombre de la carpeta o de sus carpetas padre."""
    for p in [carpeta, *carpeta.parents]:
        a = buscar_anio(p.name)
        if a:
            return a
    return None


def nombre_eps_limpio(nombre: str) -> str:
    """Normaliza el nombre de la EPS para agrupar (mayúsculas, sin espacios extra)."""
    n = re.sub(r'\s+', ' ', (nombre or '').strip()).upper()
    return n or 'SIN_CLASIFICAR'


def eps_para_archivo(nombre: str) -> str:
    """Convierte el nombre de la EPS en algo válido como nombre de archivo."""
    n = quitar_tildes(nombre_eps_limpio(nombre))
    n = re.sub(r'[^A-Z0-9]+', '_', n).strip('_')
    return n or 'SIN_CLASIFICAR'


def leer_texto(path: Path) -> str:
    """Lee un archivo de texto probando varios encodings habituales en Colombia."""
    for enc in ('utf-8-sig', 'utf-8', 'latin-1', 'cp1252'):
        try:
            return path.read_text(encoding=enc)
        except (UnicodeDecodeError, UnicodeError):
            continue
    return path.read_text(encoding='latin-1', errors='replace')


def a_numero(v):
    """Convierte a número si se puede, si no devuelve el valor original limpio."""
    if v is None:
        return None
    s = str(v).strip()
    if s == '' or s.upper() in ('NULL', 'NONE', 'NA'):
        return None
    try:
        if re.fullmatch(r'-?\d+', s):
            return int(s)
        return float(s.replace(',', '.')) if re.fullmatch(r'-?\d+[.,]\d+', s) else s
    except ValueError:
        return s


# ────────────────────────────────────────────────────────────────────────────
# Parser JSON (Res. 948 / 2275)
# ────────────────────────────────────────────────────────────────────────────

# (clave en JSON  ->  hoja destino)
SERVICIOS_JSON = {
    'consultas': 'Consultas',
    'procedimientos': 'Procedimientos',
    'urgencias': 'Urgencias',
    'hospitalizacion': 'Hospitalizacion',
    'recienNacidos': 'RecienNacidos',
    'medicamentos': 'Medicamentos',
    'otrosServicios': 'OtrosServicios',
}


def _iter_transacciones(data):
    """Devuelve una lista de transacciones RIPS sin importar cómo venga el JSON."""
    if isinstance(data, list):
        for item in data:
            yield from _iter_transacciones(item)
    elif isinstance(data, dict):
        if 'usuarios' in data:
            yield data
        # algunos JSON envuelven el RIPS dentro de otra llave (ej. "rips", "JsonRips")
        else:
            for v in data.values():
                if isinstance(v, dict) and 'usuarios' in v:
                    yield v
                elif isinstance(v, list):
                    yield from _iter_transacciones(v)


def parsear_json(path: Path, meta: dict, acumular):
    try:
        data = json.loads(leer_texto(path))
    except json.JSONDecodeError as e:
        print(f"    [!] JSON inválido, se omite: {path.name} ({e})")
        return 0

    n = 0
    for trans in _iter_transacciones(data):
        cab = {
            'num_factura': trans.get('numFactura') or trans.get('numNota') or '',
            'numDocumentoIdObligado': trans.get('numDocumentoIdObligado', ''),
            'tipoNota': trans.get('tipoNota'),
            'numNota': trans.get('numNota'),
            'cucon': trans.get('cucon', ''),
        }

        # Hoja Facturas (una fila por transacción)
        fila_fac = {**meta, **cab, 'formato': 'JSON'}
        acumular(meta, 'Facturas', fila_fac)

        for usuario in trans.get('usuarios', []) or []:
            base_user = {
                'tipoDocumentoIdentificacion': usuario.get('tipoDocumentoIdentificacion', ''),
                'numDocumentoIdentificacion': usuario.get('numDocumentoIdentificacion', ''),
            }
            # Hoja Usuarios (una fila por usuario)
            fila_user = {
                **meta, 'formato': 'JSON', 'num_factura': cab['num_factura'],
                **base_user,
                'tipoUsuario': usuario.get('tipoUsuario', ''),
                'fechaNacimiento': usuario.get('fechaNacimiento', ''),
                'codSexo': usuario.get('codSexo', ''),
                'codMunicipioResidencia': usuario.get('codMunicipioResidencia', ''),
                'codZonaTerritorialResidencia': usuario.get('codZonaTerritorialResidencia', ''),
            }
            acumular(meta, 'Usuarios', fila_user)

            for clave, hoja in SERVICIOS_JSON.items():
                for serv in usuario.get(clave, []) or []:
                    fila = {
                        **meta,
                        'formato': 'JSON',
                        'num_factura': cab['num_factura'],
                        **base_user,
                    }
                    # volcamos todos los campos del servicio tal cual vienen
                    for k, v in serv.items():
                        fila[k] = a_numero(v) if isinstance(v, (str, int, float)) else v
                    acumular(meta, hoja, fila)
                    n += 1
    return n


# ────────────────────────────────────────────────────────────────────────────
# Parser TXT (Res. 3374) — archivos separados por comas
# ────────────────────────────────────────────────────────────────────────────

# Mapas posicionales (índice de columna -> nombre de campo) por tipo de archivo.
CAMPOS_TXT = {
    'AF': ['codPrestador', 'razonSocial', 'tipoDocPrestador', 'numDocPrestador',
           'num_factura', 'fechaExpedicion', 'fechaInicio', 'fechaFinal',
           'codEntidadAdmin', 'nombreEntidadAdmin', 'numContrato', 'planBeneficios',
           'numPoliza', 'valorCopago', 'valorComision', 'valorDescuentos', 'valorNeto'],
    'US': ['tipoDocumentoIdentificacion', 'numDocumentoIdentificacion', 'codEntidadAdmin',
           'tipoUsuario', 'primerApellido', 'segundoApellido', 'primerNombre',
           'segundoNombre', 'edad', 'unidadEdad', 'codSexo', 'codDepartamento',
           'codMunicipioResidencia', 'zonaResidencia'],
    'AC': ['num_factura', 'codPrestador', 'tipoDocumentoIdentificacion',
           'numDocumentoIdentificacion', 'fechaInicioAtencion', 'numAutorizacion',
           'codConsulta', 'finalidadTecnologiaSalud', 'causaMotivoAtencion',
           'codDiagnosticoPrincipal', 'codDiagnosticoRelacionado1',
           'codDiagnosticoRelacionado2', 'codDiagnosticoRelacionado3',
           'tipoDiagnosticoPrincipal', 'vrServicio', 'valorPagoModerador', 'valorNeto'],
    'AP': ['num_factura', 'codPrestador', 'tipoDocumentoIdentificacion',
           'numDocumentoIdentificacion', 'fechaInicioAtencion', 'numAutorizacion',
           'codProcedimiento', 'ambitoRealizacion', 'finalidadTecnologiaSalud',
           'personalAtiende', 'codDiagnosticoPrincipal', 'codDiagnosticoRelacionado1',
           'codComplicacion', 'formaRealizacion', 'vrServicio'],
    'AU': ['num_factura', 'codPrestador', 'tipoDocumentoIdentificacion',
           'numDocumentoIdentificacion', 'fechaInicioAtencion', 'horaIngreso',
           'numAutorizacion', 'causaMotivoAtencion', 'codDiagnosticoSalida',
           'codDiagnosticoRelacionado1', 'codDiagnosticoRelacionado2',
           'codDiagnosticoRelacionado3', 'destinoSalida', 'estadoSalida',
           'codDiagnosticoMuerte', 'fechaSalida', 'horaSalida'],
    'AH': ['num_factura', 'codPrestador', 'tipoDocumentoIdentificacion',
           'numDocumentoIdentificacion', 'viaIngreso', 'fechaInicioAtencion',
           'horaIngreso', 'numAutorizacion', 'causaMotivoAtencion',
           'codDiagnosticoPrincipalIngreso', 'codDiagnosticoPrincipalEgreso',
           'codDiagnosticoRelacionado1', 'codDiagnosticoRelacionado2',
           'codDiagnosticoRelacionado3', 'codComplicacion', 'estadoSalida',
           'codDiagnosticoMuerte', 'fechaEgreso', 'horaEgreso'],
    'AN': ['num_factura', 'codPrestador', 'tipoDocumentoIdentificacionMadre',
           'numDocumentoIdentificacionMadre', 'fechaNacimiento', 'horaNacimiento',
           'edadGestacional', 'controlPrenatal', 'codSexo', 'peso',
           'codDiagnosticoRecienNacido', 'codDiagnosticoMuerte', 'fechaMuerte',
           'horaMuerte'],
    'AM': ['num_factura', 'codPrestador', 'tipoDocumentoIdentificacion',
           'numDocumentoIdentificacion', 'numAutorizacion', 'codTecnologiaSalud',
           'tipoMedicamento', 'nomTecnologiaSalud', 'formaFarmaceutica',
           'concentracionMedicamento', 'unidadMedida', 'cantidadMedicamento',
           'vrUnitMedicamento', 'vrServicio'],
    'AT': ['num_factura', 'codPrestador', 'tipoDocumentoIdentificacion',
           'numDocumentoIdentificacion', 'numAutorizacion', 'tipoServicio',
           'codTecnologiaSalud', 'nomTecnologiaSalud', 'cantidad',
           'vrUnitServicio', 'vrServicio'],
}
CAMPOS_TXT['AD'] = CAMPOS_TXT['AT']

# Campos numéricos a convertir para los totales del resumen
CAMPOS_VALOR = {'vrServicio', 'valorNeto', 'valorCopago', 'vrUnitMedicamento',
                'valorPagoModerador', 'vrUnitServicio'}


def prefijo_txt(nombre_archivo: str) -> str | None:
    base = nombre_archivo.upper()
    for pref in PREFIJOS_TXT:
        if base.startswith(pref):
            return pref
    return None


def parsear_txt(path: Path, meta: dict, acumular) -> int:
    pref = prefijo_txt(path.name)
    if pref is None or pref not in CAMPOS_TXT:
        return 0
    hoja = PREFIJOS_TXT[pref]
    campos = CAMPOS_TXT[pref]

    texto = leer_texto(path)
    # Detecta delimitador (RIPS estándar = coma; algunos usan punto y coma)
    delim = ';' if texto.count(';') > texto.count(',') else ','

    n = 0
    reader = csv.reader(texto.splitlines(), delimiter=delim)
    for partes in reader:
        if not partes or all(p.strip() == '' for p in partes):
            continue
        fila = {**meta, 'formato': 'TXT'}
        for i, nombre in enumerate(campos):
            valor = partes[i].strip() if i < len(partes) else ''
            fila[nombre] = a_numero(valor) if nombre in CAMPOS_VALOR else valor
        acumular(meta, hoja, fila)
        n += 1
    return n


# ────────────────────────────────────────────────────────────────────────────
# Recorrido de carpetas
# ────────────────────────────────────────────────────────────────────────────

def recolectar(origenes: list[Path], acumular) -> dict:
    """Recorre los orígenes, identifica carpetas de mes y EPS, y procesa archivos."""
    stats = {'archivos': 0, 'json': 0, 'txt': 0, 'omitidos': 0, 'registros': 0}

    for origen in origenes:
        if not origen.exists():
            print(f"[!] No existe la ruta: {origen}")
            continue
        print(f"\n=== Procesando origen: {origen} ===")

        # Identifica TODAS las carpetas de "mes" en el árbol
        carpetas_mes = []
        for sub in origen.rglob('*'):
            if sub.is_dir() and buscar_mes(sub.name):
                carpetas_mes.append(sub)
        # si el propio origen es una carpeta de mes
        if buscar_mes(origen.name):
            carpetas_mes.append(origen)

        if not carpetas_mes:
            print(f"    [i] No se hallaron carpetas de mes; se procesa todo bajo "
                  f"'{origen.name}' como un único bloque.")
            carpetas_mes = [origen]

        for mes_dir in sorted(set(carpetas_mes)):
            anio = buscar_anio(mes_dir.name) or anio_de_ancestros(mes_dir)
            mes = buscar_mes(mes_dir.name)
            eps_dirs = [d for d in mes_dir.iterdir() if d.is_dir()]
            archivos_directos = [f for f in mes_dir.iterdir() if f.is_file()]

            destinos = [(d.name, d) for d in eps_dirs]
            if archivos_directos:
                # archivos sueltos en la carpeta del mes (sin subcarpeta de EPS)
                destinos.append(('SIN_CLASIFICAR', mes_dir))

            for eps_nombre, carpeta in destinos:
                eps = nombre_eps_limpio(eps_nombre)
                meta_base = {'eps': eps, 'anio': anio,
                             'mes': MES_NOMBRE.get(mes, '') if mes else ''}
                # todos los archivos bajo la carpeta de la EPS (recursivo)
                iterador = (carpeta.rglob('*') if carpeta != mes_dir
                            else (f for f in mes_dir.iterdir() if f.is_file()))
                for f in iterador:
                    if not f.is_file():
                        continue
                    ext = f.suffix.lower()
                    meta = dict(meta_base)
                    if ext == '.json':
                        stats['archivos'] += 1
                        stats['json'] += 1
                        stats['registros'] += parsear_json(f, meta, acumular)
                    elif ext == '.txt':
                        pref = prefijo_txt(f.name)
                        if pref is None:
                            stats['omitidos'] += 1
                            continue
                        stats['archivos'] += 1
                        stats['txt'] += 1
                        stats['registros'] += parsear_txt(f, meta, acumular)
    return stats


# ────────────────────────────────────────────────────────────────────────────
# Escritura de Excel
# ────────────────────────────────────────────────────────────────────────────

# Orden preferente de columnas por hoja (las demás se anexan al final)
COLS_META = ['eps', 'anio', 'mes', 'formato', 'num_factura']


def construir_resumen(libro: dict) -> pd.DataFrame:
    """Tabla resumen: registros y valor total por hoja/servicio y por mes."""
    filas = []
    for hoja, registros in libro.items():
        if hoja == 'Resumen' or not registros:
            continue
        df = pd.DataFrame(registros)
        col_valor = next((c for c in ('vrServicio', 'valorNeto') if c in df.columns), None)
        total = 0.0
        if col_valor:
            total = pd.to_numeric(df[col_valor], errors='coerce').fillna(0).sum()
        filas.append({
            'Servicio / Archivo': hoja,
            'Registros': len(df),
            'Valor total': round(float(total), 2),
        })
    resumen = pd.DataFrame(filas).sort_values('Servicio / Archivo') if filas else \
        pd.DataFrame(columns=['Servicio / Archivo', 'Registros', 'Valor total'])
    return resumen


def ordenar_columnas(df: pd.DataFrame) -> pd.DataFrame:
    cols = [c for c in COLS_META if c in df.columns]
    resto = [c for c in df.columns if c not in cols]
    return df[cols + resto]


def escribir_libro(ruta: Path, libro: dict):
    ruta.parent.mkdir(parents=True, exist_ok=True)
    with pd.ExcelWriter(ruta, engine='openpyxl') as writer:
        # Resumen primero
        construir_resumen(libro).to_excel(writer, sheet_name='Resumen', index=False)

        for hoja in ORDEN_HOJAS:
            if hoja == 'Resumen':
                continue
            registros = libro.get(hoja)
            if not registros:
                continue
            df = ordenar_columnas(pd.DataFrame(registros))
            df.to_excel(writer, sheet_name=hoja[:31], index=False)

        # Ajuste sencillo de ancho de columnas
        for ws in writer.book.worksheets:
            for col in ws.columns:
                ancho = max((len(str(c.value)) for c in col if c.value is not None),
                            default=10)
                letra = col[0].column_letter
                ws.column_dimensions[letra].width = min(max(ancho + 2, 10), 50)


# ────────────────────────────────────────────────────────────────────────────
# Main
# ────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description='Convierte RIPS (JSON y TXT) a Excel por EPS y año.')
    parser.add_argument('--origen', action='append', required=True,
                        help='Carpeta raíz de RIPS (puede repetirse para varios años).')
    parser.add_argument('--salida', default=None,
                        help='Carpeta de salida de los Excel. Por defecto: '
                             '<primer origen>\\_EXCEL_RIPS')
    args = parser.parse_args()

    origenes = [Path(o) for o in args.origen]
    salida = Path(args.salida) if args.salida else origenes[0] / '_EXCEL_RIPS'

    # Acumulador:  (eps, anio) -> { hoja -> [filas] }
    datos: dict[tuple, dict[str, list]] = defaultdict(lambda: defaultdict(list))

    def acumular(meta: dict, hoja: str, fila: dict):
        clave = (meta['eps'], meta['anio'])
        datos[clave][hoja].append(fila)

    stats = recolectar(origenes, acumular)

    print("\n=== Generando archivos Excel ===")
    if not datos:
        print("[!] No se encontraron RIPS para procesar. Revisa la ruta y la estructura.")
        return

    generados = 0
    for (eps, anio), libro in sorted(datos.items(), key=lambda x: (str(x[0][1]), x[0][0])):
        anio_txt = anio if anio else 'SIN_ANIO'
        nombre = f"{eps_para_archivo(eps)}_{anio_txt}.xlsx"
        ruta = salida / nombre
        escribir_libro(ruta, libro)
        total_regs = sum(len(v) for k, v in libro.items())
        print(f"  ✔ {nombre}  ({total_regs} registros)")
        generados += 1

    print("\n────────────────────── RESUMEN ──────────────────────")
    print(f"  Archivos leídos : {stats['archivos']}  "
          f"(JSON: {stats['json']}, TXT: {stats['txt']})")
    print(f"  TXT no-RIPS omitidos: {stats['omitidos']}")
    print(f"  Excel generados : {generados}")
    print(f"  Carpeta salida  : {salida}")
    print(f"  Hora            : {datetime.now():%Y-%m-%d %H:%M:%S}")
    print("──────────────────────────────────────────────────────")


if __name__ == '__main__':
    main()
