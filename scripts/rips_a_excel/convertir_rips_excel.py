# -*- coding: utf-8 -*-
"""
Convertir RIPS (JSON Res.948/2275 y TXT Res.3374) a Excel por EPS y año
=======================================================================

Genera, para cada (EPS, AÑO), UN archivo Excel con EXACTAMENTE el mismo formato
del modelo "RIPS_EDITABLE": una hoja por sección del RIPS, con los nombres y el
orden de columnas del RIPS JSON, e inyectando el documento del paciente
(tipoDocumentoIdentificacion / numDocumentoIdentificacion) en cada servicio.

Hojas y columnas (idénticas al modelo):
    FACTURA, USUARIOS, CONSULTAS, PROCEDIMIENTOS, HOSPITALIZACION,
    MEDICAMENTOS, OTROS_SERVICIOS, URGENCIAS, RECIEN_NACIDOS

Estructura de carpetas esperada:   <ORIGEN>/ MES / EPS / archivos(.json|.txt)
La EPS sale del nombre de la subcarpeta; el año, del nombre de la carpeta del mes.
Al consolidar varios meses, la hoja FACTURA tendrá una fila por factura.

USO:
    python convertir_rips_excel.py --origen "D:\\RIPS 2026"
    python convertir_rips_excel.py --origen "D:\\RIPS 2024" --origen "D:\\RIPS 2025" --origen "D:\\RIPS 2026"
    python convertir_rips_excel.py --origen "D:\\RIPS 2026" --salida "D:\\Informes"

Requisitos:   pip install pandas openpyxl
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
    print("\n[ERROR] Falta 'pandas'. Instálalo con:  pip install pandas openpyxl\n")
    sys.exit(1)


# ════════════════════════════════════════════════════════════════════════════
# FORMATO OBJETIVO — hojas y columnas EXACTAS (tomadas del modelo RIPS_EDITABLE)
# ════════════════════════════════════════════════════════════════════════════

SHEET_COLUMNS = {
    'FACTURA': [
        'numDocumentoIdObligado', 'numFactura', 'tipoNota', 'numNota',
    ],
    'USUARIOS': [
        'tipoDocumentoIdentificacion', 'numDocumentoIdentificacion', 'tipoUsuario',
        'fechaNacimiento', 'codSexo', 'codPaisResidencia', 'codMunicipioResidencia',
        'codZonaTerritorialResidencia', 'incapacidad', 'consecutivo', 'codPaisOrigen',
    ],
    'CONSULTAS': [
        'codPrestador', 'fechaInicioAtencion', 'numAutorizacion', 'codConsulta',
        'modalidadGrupoServicioTecSal', 'grupoServicios', 'codServicio',
        'finalidadTecnologiaSalud', 'causaMotivoAtencion', 'codDiagnosticoPrincipal',
        'codDiagnosticoRelacionado1', 'codDiagnosticoRelacionado2',
        'codDiagnosticoRelacionado3', 'tipoDiagnosticoPrincipal',
        'tipoDocumentoIdentificacion', 'numDocumentoIdentificacion', 'vrServicio',
        'conceptoRecaudo', 'valorPagoModerador', 'numFEVPagoModerador', 'consecutivo',
    ],
    'PROCEDIMIENTOS': [
        'codPrestador', 'fechaInicioAtencion', 'idMIPRES', 'numAutorizacion',
        'codProcedimiento', 'viaIngresoServicioSalud', 'modalidadGrupoServicioTecSal',
        'grupoServicios', 'codServicio', 'finalidadTecnologiaSalud',
        'tipoDocumentoIdentificacion', 'numDocumentoIdentificacion',
        'codDiagnosticoPrincipal', 'codDiagnosticoRelacionado', 'codComplicacion',
        'vrServicio', 'conceptoRecaudo', 'valorPagoModerador', 'numFEVPagoModerador',
        'consecutivo',
    ],
    'HOSPITALIZACION': [
        'codPrestador', 'viaIngresoServicioSalud', 'fechaInicioAtencion',
        'numAutorizacion', 'causaMotivoAtencion', 'codDiagnosticoPrincipal',
        'codDiagnosticoPrincipalE', 'codDiagnosticoRelacionadoE1',
        'codDiagnosticoRelacionadoE2', 'codDiagnosticoRelacionadoE3', 'codComplicacion',
        'condicionDestinoUsuarioEgreso', 'codDiagnosticoCausaMuerte', 'fechaEgreso',
        'consecutivo', 'tipoDocumentoIdentificacion', 'numDocumentoIdentificacion',
    ],
    'MEDICAMENTOS': [
        'codPrestador', 'numAutorizacion', 'idMIPRES', 'fechaDispensAdmon',
        'codDiagnosticoPrincipal', 'codDiagnosticoRelacionado', 'tipoMedicamento',
        'codTecnologiaSalud', 'nomTecnologiaSalud', 'concentracionMedicamento',
        'unidadMedida', 'formaFarmaceutica', 'unidadMinDispensa', 'cantidadMedicamento',
        'diasTratamiento', 'tipoDocumentoIdentificacion', 'numDocumentoIdentificacion',
        'vrUnitMedicamento', 'vrServicio', 'conceptoRecaudo', 'valorPagoModerador',
        'numFEVPagoModerador', 'consecutivo',
    ],
    'OTROS_SERVICIOS': [
        'codPrestador', 'numAutorizacion', 'idMIPRES', 'fechaSuministroTecnologia',
        'tipoOS', 'codTecnologiaSalud', 'nomTecnologiaSalud', 'cantidadOS',
        'tipoDocumentoIdentificacion', 'numDocumentoIdentificacion', 'vrUnitOS',
        'vrServicio', 'conceptoRecaudo', 'valorPagoModerador', 'numFEVPagoModerador',
        'consecutivo',
    ],
    'URGENCIAS': [
        'codPrestador', 'fechaInicioAtencion', 'causaMotivoAtencion',
        'codDiagnosticoPrincipal', 'codDiagnosticoPrincipalE',
        'codDiagnosticoRelacionadoE1', 'codDiagnosticoRelacionadoE2',
        'codDiagnosticoRelacionadoE3', 'condicionDestinoUsuarioEgreso',
        'codDiagnosticoCausaMuerte', 'fechaEgreso', 'consecutivo',
        'tipoDocumentoIdentificacion', 'numDocumentoIdentificacion',
    ],
    # No venía en el modelo; columnas según esquema oficial RIPS JSON.
    'RECIEN_NACIDOS': [
        'codPrestador', 'numAutorizacion', 'fechaNacimiento', 'edadGestacional',
        'numConsultasCPrenatal', 'codSexoBiologico', 'peso', 'codDiagnosticoPrincipal',
        'condicionDestinoUsuarioEgreso', 'codDiagnosticoCausaMuerte', 'fechaEgreso',
        'tipoDocumentoIdentificacion', 'numDocumentoIdentificacion', 'consecutivo',
    ],
}

# Orden de las hojas dentro del libro (igual al modelo)
ORDEN_HOJAS = ['FACTURA', 'USUARIOS', 'CONSULTAS', 'PROCEDIMIENTOS',
               'HOSPITALIZACION', 'MEDICAMENTOS', 'OTROS_SERVICIOS',
               'URGENCIAS', 'RECIEN_NACIDOS']

# Sección del JSON RIPS  ->  hoja destino
JSON_SECCION_HOJA = {
    'consultas': 'CONSULTAS',
    'procedimientos': 'PROCEDIMIENTOS',
    'urgencias': 'URGENCIAS',
    'hospitalizacion': 'HOSPITALIZACION',
    'recienNacidos': 'RECIEN_NACIDOS',
    'medicamentos': 'MEDICAMENTOS',
    'otrosServicios': 'OTROS_SERVICIOS',
}

# Columnas con el documento del paciente que se inyectan desde el usuario
COLS_DOC_PACIENTE = ('tipoDocumentoIdentificacion', 'numDocumentoIdentificacion')


# ════════════════════════════════════════════════════════════════════════════
# Soporte TXT (Res.3374) — mapeo posición de campo -> columna del formato objetivo
# ════════════════════════════════════════════════════════════════════════════

PREFIJOS_TXT = {'AF': 'FACTURA', 'US': 'USUARIOS', 'AC': 'CONSULTAS',
                'AP': 'PROCEDIMIENTOS', 'AU': 'URGENCIAS', 'AH': 'HOSPITALIZACION',
                'AN': 'RECIEN_NACIDOS', 'AM': 'MEDICAMENTOS', 'AT': 'OTROS_SERVICIOS',
                'AD': 'OTROS_SERVICIOS'}

TXT_MAPA = {
    'AF': {'numDocumentoIdObligado': 3, 'numFactura': 4},
    'US': {'tipoDocumentoIdentificacion': 0, 'numDocumentoIdentificacion': 1,
           'tipoUsuario': 3, 'codSexo': 10, 'codMunicipioResidencia': 12,
           'codZonaTerritorialResidencia': 13},
    'AC': {'codPrestador': 1, 'tipoDocumentoIdentificacion': 2,
           'numDocumentoIdentificacion': 3, 'fechaInicioAtencion': 4,
           'numAutorizacion': 5, 'codConsulta': 6, 'finalidadTecnologiaSalud': 7,
           'causaMotivoAtencion': 8, 'codDiagnosticoPrincipal': 9,
           'codDiagnosticoRelacionado1': 10, 'codDiagnosticoRelacionado2': 11,
           'codDiagnosticoRelacionado3': 12, 'tipoDiagnosticoPrincipal': 13,
           'vrServicio': 14, 'valorPagoModerador': 15},
    'AP': {'codPrestador': 1, 'tipoDocumentoIdentificacion': 2,
           'numDocumentoIdentificacion': 3, 'fechaInicioAtencion': 4,
           'numAutorizacion': 5, 'codProcedimiento': 6, 'viaIngresoServicioSalud': 7,
           'finalidadTecnologiaSalud': 8, 'codDiagnosticoPrincipal': 10,
           'codDiagnosticoRelacionado': 11, 'codComplicacion': 12, 'vrServicio': 14},
    'AU': {'codPrestador': 1, 'tipoDocumentoIdentificacion': 2,
           'numDocumentoIdentificacion': 3, 'fechaInicioAtencion': 4,
           'causaMotivoAtencion': 7, 'codDiagnosticoPrincipalE': 8,
           'codDiagnosticoRelacionadoE1': 9, 'codDiagnosticoRelacionadoE2': 10,
           'codDiagnosticoRelacionadoE3': 11, 'condicionDestinoUsuarioEgreso': 12,
           'codDiagnosticoCausaMuerte': 14, 'fechaEgreso': 15},
    'AH': {'codPrestador': 1, 'tipoDocumentoIdentificacion': 2,
           'numDocumentoIdentificacion': 3, 'viaIngresoServicioSalud': 4,
           'fechaInicioAtencion': 5, 'numAutorizacion': 7, 'causaMotivoAtencion': 8,
           'codDiagnosticoPrincipal': 9, 'codDiagnosticoPrincipalE': 10,
           'codDiagnosticoRelacionadoE1': 11, 'codDiagnosticoRelacionadoE2': 12,
           'codDiagnosticoRelacionadoE3': 13, 'codComplicacion': 14,
           'condicionDestinoUsuarioEgreso': 15, 'codDiagnosticoCausaMuerte': 16,
           'fechaEgreso': 17},
    'AN': {'codPrestador': 1, 'tipoDocumentoIdentificacion': 2,
           'numDocumentoIdentificacion': 3, 'fechaNacimiento': 4,
           'edadGestacional': 6, 'codSexoBiologico': 8, 'peso': 9,
           'codDiagnosticoPrincipal': 10, 'codDiagnosticoCausaMuerte': 11,
           'fechaEgreso': 12},
    'AM': {'codPrestador': 1, 'tipoDocumentoIdentificacion': 2,
           'numDocumentoIdentificacion': 3, 'numAutorizacion': 4,
           'codTecnologiaSalud': 5, 'tipoMedicamento': 6, 'nomTecnologiaSalud': 7,
           'formaFarmaceutica': 8, 'concentracionMedicamento': 9, 'unidadMedida': 10,
           'cantidadMedicamento': 11, 'vrUnitMedicamento': 12, 'vrServicio': 13},
    'AT': {'codPrestador': 1, 'tipoDocumentoIdentificacion': 2,
           'numDocumentoIdentificacion': 3, 'numAutorizacion': 4, 'tipoOS': 5,
           'codTecnologiaSalud': 6, 'nomTecnologiaSalud': 7, 'cantidadOS': 8,
           'vrUnitOS': 9, 'vrServicio': 10},
}
TXT_MAPA['AD'] = TXT_MAPA['AT']

# Columnas que se convierten a número (para que sumen bien en el informe)
COLS_NUMERICAS = {'vrServicio', 'valorPagoModerador', 'vrUnitMedicamento',
                  'vrUnitOS', 'cantidadMedicamento', 'cantidadOS'}


# ════════════════════════════════════════════════════════════════════════════
# Utilidades
# ════════════════════════════════════════════════════════════════════════════

MESES = {'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4, 'MAYO': 5, 'JUNIO': 6,
         'JULIO': 7, 'AGOSTO': 8, 'SEPTIEMBRE': 9, 'SETIEMBRE': 9, 'OCTUBRE': 10,
         'NOVIEMBRE': 11, 'DICIEMBRE': 12}


def quitar_tildes(s: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFKD', s or '')
                   if not unicodedata.combining(c))


def buscar_anio(texto: str):
    m = re.search(r'(20\d{2})', texto or '')
    return int(m.group(1)) if m else None


def buscar_mes(texto: str):
    t = quitar_tildes((texto or '').upper())
    for nombre, num in MESES.items():
        if nombre in t:
            return num
    return None


def anio_de_ancestros(carpeta: Path):
    for p in [carpeta, *carpeta.parents]:
        a = buscar_anio(p.name)
        if a:
            return a
    return None


def nombre_eps(nombre: str) -> str:
    return re.sub(r'\s+', ' ', (nombre or '').strip()).upper() or 'SIN_CLASIFICAR'


def eps_archivo(nombre: str) -> str:
    n = re.sub(r'[^A-Z0-9]+', '_', quitar_tildes(nombre_eps(nombre))).strip('_')
    return n or 'SIN_CLASIFICAR'


def leer_texto(path: Path) -> str:
    for enc in ('utf-8-sig', 'utf-8', 'latin-1', 'cp1252'):
        try:
            return path.read_text(encoding=enc)
        except (UnicodeDecodeError, UnicodeError):
            continue
    return path.read_text(encoding='latin-1', errors='replace')


def a_numero(v):
    if v is None or str(v).strip() == '':
        return None
    s = str(v).strip()
    try:
        return int(s) if re.fullmatch(r'-?\d+', s) else float(s.replace(',', '.'))
    except ValueError:
        return v


def prefijo_txt(nombre: str):
    base = nombre.upper()
    for pref in PREFIJOS_TXT:
        if base.startswith(pref):
            return pref
    return None


# ════════════════════════════════════════════════════════════════════════════
# Parsers
# ════════════════════════════════════════════════════════════════════════════

def _iter_transacciones(data):
    if isinstance(data, list):
        for item in data:
            yield from _iter_transacciones(item)
    elif isinstance(data, dict):
        if 'usuarios' in data:
            yield data
        else:
            for v in data.values():
                if isinstance(v, dict) and 'usuarios' in v:
                    yield v
                elif isinstance(v, list):
                    yield from _iter_transacciones(v)


def parsear_json(path: Path, acumular) -> int:
    try:
        data = json.loads(leer_texto(path))
    except json.JSONDecodeError as e:
        print(f"    [!] JSON inválido, se omite: {path.name} ({e})")
        return 0

    n = 0
    for trans in _iter_transacciones(data):
        # FACTURA (una fila por transacción)
        acumular('FACTURA', {c: trans.get(c) for c in SHEET_COLUMNS['FACTURA']})

        for usuario in trans.get('usuarios', []) or []:
            doc_tipo = usuario.get('tipoDocumentoIdentificacion')
            doc_num = usuario.get('numDocumentoIdentificacion')

            # USUARIOS
            acumular('USUARIOS', {c: usuario.get(c) for c in SHEET_COLUMNS['USUARIOS']})

            # Servicios anidados
            for seccion, hoja in JSON_SECCION_HOJA.items():
                for serv in usuario.get(seccion, []) or []:
                    fila = {}
                    for col in SHEET_COLUMNS[hoja]:
                        if col == 'tipoDocumentoIdentificacion':
                            fila[col] = doc_tipo
                        elif col == 'numDocumentoIdentificacion':
                            fila[col] = doc_num
                        else:
                            fila[col] = serv.get(col)   # valor JSON tal cual (preserva tipos)
                    acumular(hoja, fila)
                    n += 1
    return n


def parsear_txt(path: Path, acumular) -> int:
    pref = prefijo_txt(path.name)
    if pref is None:
        return 0
    hoja = PREFIJOS_TXT[pref]
    mapa = TXT_MAPA[pref]

    texto = leer_texto(path)
    delim = ';' if texto.count(';') > texto.count(',') else ','
    n = 0
    for partes in csv.reader(texto.splitlines(), delimiter=delim):
        if not partes or all(p.strip() == '' for p in partes):
            continue
        fila = {c: None for c in SHEET_COLUMNS[hoja]}
        for col, idx in mapa.items():
            if idx < len(partes):
                val = partes[idx].strip()
                fila[col] = a_numero(val) if col in COLS_NUMERICAS else (val or None)
        acumular(hoja, fila)
        n += 1
    return n


# ════════════════════════════════════════════════════════════════════════════
# Recorrido de carpetas  (MES -> EPS -> archivos)
# ════════════════════════════════════════════════════════════════════════════

def recolectar(origenes, datos):
    stats = {'archivos': 0, 'json': 0, 'txt': 0, 'omitidos': 0, 'registros': 0}

    for origen in origenes:
        if not origen.exists():
            print(f"[!] No existe la ruta: {origen}")
            continue
        print(f"\n=== Procesando origen: {origen} ===")

        carpetas_mes = {s for s in origen.rglob('*') if s.is_dir() and buscar_mes(s.name)}
        if buscar_mes(origen.name):
            carpetas_mes.add(origen)
        if not carpetas_mes:
            print(f"    [i] Sin carpetas de mes; se procesa '{origen.name}' como bloque.")
            carpetas_mes = {origen}

        for mes_dir in sorted(carpetas_mes):
            anio = buscar_anio(mes_dir.name) or anio_de_ancestros(mes_dir)
            eps_dirs = [d for d in mes_dir.iterdir() if d.is_dir()]
            archivos_directos = [f for f in mes_dir.iterdir() if f.is_file()]

            destinos = [(d.name, d, True) for d in eps_dirs]
            if archivos_directos:
                destinos.append(('SIN_CLASIFICAR', mes_dir, False))

            for eps_nom, carpeta, recursivo in destinos:
                eps = nombre_eps(eps_nom)
                libro = datos[(eps, anio)]

                def acumular(hoja, fila, _libro=libro):
                    _libro[hoja].append(fila)

                archivos = (carpeta.rglob('*') if recursivo
                            else (f for f in mes_dir.iterdir() if f.is_file()))
                for f in archivos:
                    if not f.is_file():
                        continue
                    ext = f.suffix.lower()
                    if ext == '.json':
                        stats['archivos'] += 1; stats['json'] += 1
                        stats['registros'] += parsear_json(f, acumular)
                    elif ext == '.txt':
                        if prefijo_txt(f.name) is None:
                            stats['omitidos'] += 1
                            continue
                        stats['archivos'] += 1; stats['txt'] += 1
                        stats['registros'] += parsear_txt(f, acumular)
    return stats


# ════════════════════════════════════════════════════════════════════════════
# Escritura de Excel
# ════════════════════════════════════════════════════════════════════════════

def escribir_libro(ruta: Path, libro: dict):
    ruta.parent.mkdir(parents=True, exist_ok=True)
    with pd.ExcelWriter(ruta, engine='openpyxl') as writer:
        escrito = False
        for hoja in ORDEN_HOJAS:
            filas = libro.get(hoja)
            if not filas:
                continue
            df = pd.DataFrame(filas).reindex(columns=SHEET_COLUMNS[hoja])
            df.to_excel(writer, sheet_name=hoja, index=False)
            escrito = True
        if not escrito:
            # libro vacío: al menos deja FACTURA con encabezados
            pd.DataFrame(columns=SHEET_COLUMNS['FACTURA']).to_excel(
                writer, sheet_name='FACTURA', index=False)

        for ws in writer.book.worksheets:
            for col in ws.columns:
                ancho = max((len(str(c.value)) for c in col if c.value is not None),
                            default=10)
                ws.column_dimensions[col[0].column_letter].width = min(max(ancho + 2, 10), 45)


# ════════════════════════════════════════════════════════════════════════════
# Main
# ════════════════════════════════════════════════════════════════════════════

def main():
    ap = argparse.ArgumentParser(description='RIPS (JSON/TXT) -> Excel por EPS y año.')
    ap.add_argument('--origen', action='append', required=True,
                    help='Carpeta raíz de RIPS (repetible para varios años).')
    ap.add_argument('--salida', default=None,
                    help='Carpeta de salida (por defecto <primer origen>\\_EXCEL_RIPS).')
    args = ap.parse_args()

    origenes = [Path(o) for o in args.origen]
    salida = Path(args.salida) if args.salida else origenes[0] / '_EXCEL_RIPS'

    # (eps, anio) -> { hoja -> [filas] }
    datos = defaultdict(lambda: defaultdict(list))
    stats = recolectar(origenes, datos)

    print("\n=== Generando archivos Excel ===")
    if not datos:
        print("[!] No se encontraron RIPS. Revisa la ruta y la estructura MES/EPS.")
        return

    generados = 0
    for (eps, anio), libro in sorted(datos.items(), key=lambda x: (str(x[0][1]), x[0][0])):
        nombre = f"{eps_archivo(eps)}_{anio or 'SIN_ANIO'}.xlsx"
        escribir_libro(salida / nombre, libro)
        regs = sum(len(v) for v in libro.values())
        print(f"  ✔ {nombre}  ({regs} filas)")
        generados += 1

    print("\n────────────────────── RESUMEN ──────────────────────")
    print(f"  Archivos leídos : {stats['archivos']}  (JSON: {stats['json']}, TXT: {stats['txt']})")
    print(f"  TXT no-RIPS omitidos: {stats['omitidos']}")
    print(f"  Excel generados : {generados}")
    print(f"  Carpeta salida  : {salida}")
    print(f"  Hora            : {datetime.now():%Y-%m-%d %H:%M:%S}")
    print("──────────────────────────────────────────────────────")


if __name__ == '__main__':
    main()
