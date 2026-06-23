# -*- coding: utf-8 -*-
"""
Frecuencia de uso de códigos (propuesta tarifaria) en los RIPS, por EPS y año
=============================================================================

Toma la lista de códigos CUPS de un libro de propuesta tarifaria (ej.
"CODIGOS_PROPUESTA_TARIFARIA_MUTUAL_SER.xlsx") y cuenta, para cada código,
cuántas veces se usó en los RIPS y cuánto se facturó (vrServicio), desglosado
por EPS y año.

Busca los códigos en:
  • JSON (Res.948/2275):  codConsulta, codProcedimiento, codTecnologiaSalud
                          (consultas, procedimientos, medicamentos, otrosServicios)
  • TXT  (Res.3374):      AC/AP (CUPS), AM (medicamento), AT (otros servicios)

Estructura de carpetas esperada:  <ORIGEN>/ MES / EPS / archivos(.json|.txt)

USO:
    python frecuencia_codigos.py ^
        --codigos "D:\\...\\CODIGOS_PROPUESTA_TARIFARIA_MUTUAL_SER.xlsx" ^
        --origen "D:\\RIPS 2026" ^
        --origen "C:\\Users\\auxgerencia\\Desktop\\RIPS\\RIPS AÑO 2024"

Salida (por defecto <primer origen>\\_FRECUENCIA_CODIGOS.xlsx) con hojas:
    POR_EPS_ANIO   matriz: una columna de Frecuencia y otra de Valor por EPS/año
    DETALLE        formato largo (codigo, eps, anio, frecuencia, valor)
    RESUMEN_EPS    totales por EPS y año

Requisitos:  pip install pandas openpyxl
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


# ── Campos donde buscar códigos ─────────────────────────────────────────────
# sección JSON -> (campo del código, etiqueta de tipo)
JSON_SECCION_CAMPO = {
    'consultas':      ('codConsulta',        'consulta'),
    'procedimientos': ('codProcedimiento',   'procedimiento'),
    'medicamentos':   ('codTecnologiaSalud', 'medicamento'),
    'otrosServicios': ('codTecnologiaSalud', 'otroServicio'),
}
# prefijo TXT -> (idx código, idx valor vrServicio, idx nombre|None, etiqueta tipo)
TXT_CODIGO_VALOR = {
    'AC': (6, 14, None, 'consulta'),
    'AP': (6, 14, None, 'procedimiento'),
    'AM': (5, 13, 7, 'medicamento'),
    'AT': (6, 10, 7, 'otroServicio'),
    'AD': (6, 10, 7, 'otroServicio'),
}

MESES = {'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO',
         'AGOSTO', 'SEPTIEMBRE', 'SETIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'}


# ── Utilidades ──────────────────────────────────────────────────────────────

def quitar_tildes(s):
    return ''.join(c for c in unicodedata.normalize('NFKD', s or '')
                   if not unicodedata.combining(c))


def buscar_anio(t):
    m = re.search(r'(20\d{2})', t or '')
    return int(m.group(1)) if m else None


def es_mes(t):
    u = quitar_tildes((t or '').upper())
    return any(m in u for m in MESES)


def anio_de_ancestros(carpeta: Path):
    for p in [carpeta, *carpeta.parents]:
        a = buscar_anio(p.name)
        if a:
            return a
    return None


def nombre_eps(n):
    return re.sub(r'\s+', ' ', (n or '').strip()).upper() or 'SIN_CLASIFICAR'


def leer_texto(path: Path):
    for enc in ('utf-8-sig', 'utf-8', 'latin-1', 'cp1252'):
        try:
            return path.read_text(encoding=enc)
        except (UnicodeDecodeError, UnicodeError):
            continue
    return path.read_text(encoding='latin-1', errors='replace')


def prefijo_txt(nombre):
    base = nombre.upper()
    for pref in TXT_CODIGO_VALOR:
        if base.startswith(pref):
            return pref
    return None


def norm_cod(v):
    """Normaliza un código a texto legible (sin .0, sin espacios)."""
    if v is None:
        return None
    s = str(v).strip()
    if s.endswith('.0') and s[:-2].isdigit():
        s = s[:-2]
    return s or None


def clave_match(v):
    """
    Clave para CRUZAR códigos entre propuesta y RIPS, tolerando:
      • ceros iniciales perdidos por Excel (CUPS '030405' guardado como 30405)
      • sufijos con guion ('325401-1' -> base '325401')
      • el '.0' de los números float
    Los CUPS son de 6 dígitos: si es numérico y queda más corto, se rellena
    con ceros a la izquierda hasta 6.
    """
    s = norm_cod(v)
    if not s:
        return None
    s = s.split('-')[0].strip().replace(' ', '')   # base antes del guion
    if s.isdigit() and len(s) < 6:
        s = s.zfill(6)
    return s or None


def a_float(v):
    try:
        return float(str(v).replace(',', '.'))
    except (ValueError, TypeError):
        return 0.0


# ── Carga de códigos de la propuesta ────────────────────────────────────────

def cargar_codigos(path: Path):
    df = pd.read_excel(path, dtype=str)
    cols = {c.upper().strip(): c for c in df.columns}
    col_cod = cols.get('CODIGO')
    if not col_cod:
        print(f"[ERROR] No encontré la columna 'CODIGO' en {path.name}. "
              f"Columnas: {list(df.columns)}")
        sys.exit(1)
    meta_cols = [df.columns[i] for i in range(min(len(df.columns), 7))]
    cod_up = col_cod.upper().strip()
    codigos = []          # claves de cruce (únicas, en orden)
    info = {}             # clave -> metadatos (la columna CODIGO conserva el original)
    for _, fila in df.iterrows():
        clave = clave_match(fila[col_cod])
        if not clave or clave in info:
            continue
        codigos.append(clave)
        registro = {}
        for mc in meta_cols:
            val = fila.get(mc)
            nom = mc.upper().strip()
            if nom == cod_up or 'CLASIFICACION' in nom:
                val = norm_cod(val)           # se muestra el código tal cual lo trae la propuesta
            elif 'VALOR' in nom:
                val = round(a_float(val), 2) if val not in (None, '') else None
            registro[mc] = val
        info[clave] = registro
    print(f"  Códigos cargados de la propuesta: {len(codigos)}")
    return codigos, info, meta_cols


# ── Conteo en RIPS ──────────────────────────────────────────────────────────

def _registrar(acc, info_rips, cod, eps, anio, valor, tipo, nombre):
    """Acumula frecuencia/valor de CUALQUIER código y guarda su tipo/nombre."""
    a = acc[(cod, eps, anio)]
    a[0] += 1
    a[1] += valor
    meta = info_rips[cod]
    meta['tipos'].add(tipo)
    if nombre and not meta['nombre']:
        meta['nombre'] = str(nombre).strip()


def contar_json(path: Path, eps, anio, acc, info_rips):
    try:
        data = json.loads(leer_texto(path))
    except json.JSONDecodeError as e:
        print(f"    [!] JSON inválido, se omite: {path.name} ({e})")
        return
    trans_list = data if isinstance(data, list) else [data]
    for trans in trans_list:
        if not isinstance(trans, dict):
            continue
        for usuario in trans.get('usuarios', []) or []:
            contenedor = usuario.get('servicios') or usuario
            for seccion, (campo, tipo) in JSON_SECCION_CAMPO.items():
                for serv in contenedor.get(seccion, []) or []:
                    cod = clave_match(serv.get(campo))
                    if cod:
                        _registrar(acc, info_rips, cod, eps, anio,
                                   a_float(serv.get('vrServicio')), tipo,
                                   serv.get('nomTecnologiaSalud'))


def contar_txt(path: Path, eps, anio, acc, info_rips):
    pref = prefijo_txt(path.name)
    if pref is None:
        return
    idx_cod, idx_val, idx_nom, tipo = TXT_CODIGO_VALOR[pref]
    texto = leer_texto(path)
    delim = ';' if texto.count(';') > texto.count(',') else ','
    for partes in csv.reader(texto.splitlines(), delimiter=delim):
        if len(partes) <= idx_cod:
            continue
        cod = clave_match(partes[idx_cod])
        if cod:
            valor = a_float(partes[idx_val]) if idx_val < len(partes) else 0.0
            nombre = partes[idx_nom] if idx_nom is not None and idx_nom < len(partes) else None
            _registrar(acc, info_rips, cod, eps, anio, valor, tipo, nombre)


def recolectar(origenes, acc, info_rips):
    stats = {'archivos': 0, 'json': 0, 'txt': 0}
    for origen in origenes:
        if not origen.exists():
            print(f"[!] No existe la ruta: {origen}")
            continue
        print(f"\n=== Procesando origen: {origen} ===")
        carpetas_mes = {s for s in origen.rglob('*') if s.is_dir() and es_mes(s.name)}
        if es_mes(origen.name):
            carpetas_mes.add(origen)
        if not carpetas_mes:
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
                archivos = (carpeta.rglob('*') if recursivo
                            else (f for f in mes_dir.iterdir() if f.is_file()))
                for f in archivos:
                    if not f.is_file():
                        continue
                    ext = f.suffix.lower()
                    if ext == '.json':
                        stats['archivos'] += 1; stats['json'] += 1
                        contar_json(f, eps, anio, acc, info_rips)
                    elif ext == '.txt' and prefijo_txt(f.name):
                        stats['archivos'] += 1; stats['txt'] += 1
                        contar_txt(f, eps, anio, acc, info_rips)
    return stats


# ── Escritura del informe ───────────────────────────────────────────────────

def escribir(salida: Path, codigos, info, meta_cols, acc, info_rips):
    salida.parent.mkdir(parents=True, exist_ok=True)
    codigos_set = set(codigos)
    combos = sorted({(eps, anio) for (_, eps, anio) in acc},
                    key=lambda x: (x[0], str(x[1])))

    def cols_combos(get_fv):
        """Construye las columnas Frec/Valor por EPS/año + TOTAL."""
        d = {}
        tf = tv = 0
        for eps, anio in combos:
            f, v = get_fv(eps, anio)
            etq = f"{eps} {anio if anio else 'SA'}"
            d[f"{etq} | Frec"] = f
            d[f"{etq} | Valor"] = round(v, 2)
            tf += f; tv += v
        d['TOTAL | Frec'] = tf
        d['TOTAL | Valor'] = round(tv, 2)
        return d, tf

    # ── Hoja POR_EPS_ANIO (códigos de la propuesta) ──
    filas = []
    for c in codigos:
        fila = {mc: info[c][mc] for mc in meta_cols}
        cols, _ = cols_combos(lambda e, a: acc.get((c, e, a), [0, 0.0]))
        fila.update(cols)
        filas.append(fila)
    df_matriz = pd.DataFrame(filas)

    # ── Hoja DETALLE (solo propuesta, formato largo) ──
    det = []
    for (c, eps, anio), (f, v) in acc.items():
        if c not in codigos_set:
            continue
        reg = {mc: info[c][mc] for mc in meta_cols}
        reg.update({'EPS': eps, 'ANIO': anio, 'FRECUENCIA': f,
                    'VALOR_FACTURADO': round(v, 2)})
        det.append(reg)
    df_det = (pd.DataFrame(det).sort_values(['EPS', 'ANIO', 'FRECUENCIA'],
              ascending=[True, True, False]) if det else pd.DataFrame())

    # ── Hoja RESUMEN_EPS (solo propuesta) ──
    res = defaultdict(lambda: [0, 0.0, set()])
    for (c, eps, anio), (f, v) in acc.items():
        if c not in codigos_set:
            continue
        r = res[(eps, anio)]
        r[0] += f; r[1] += v
        if f:
            r[2].add(c)
    df_res = pd.DataFrame(
        [{'EPS': eps, 'ANIO': anio, 'Total_usos': r[0],
          'Total_valor': round(r[1], 2), 'Codigos_distintos_usados': len(r[2])}
         for (eps, anio), r in sorted(res.items(), key=lambda x: (x[0][0], str(x[0][1])))])

    # ── Hoja NO_USADOS (propuesta con frecuencia 0) ──
    usados = {c for (c, _, _), (f, _) in acc.items() if f and c in codigos_set}
    df_nou = pd.DataFrame([{mc: info[c][mc] for mc in meta_cols}
                           for c in codigos if c not in usados])

    # ── Hoja FUERA_PROPUESTA (códigos en RIPS que NO están en la propuesta) ──
    fuera_codes = {c for (c, _, _) in acc if c not in codigos_set}
    filas_f = []
    for c in fuera_codes:
        meta = info_rips.get(c, {'tipos': set(), 'nombre': ''})
        fila = {'CODIGO': c,
                'TIPO': ', '.join(sorted(meta['tipos'])),
                'NOMBRE_RIPS': meta['nombre']}
        cols, tf = cols_combos(lambda e, a: acc.get((c, e, a), [0, 0.0]))
        fila.update(cols)
        filas_f.append((tf, fila))
    filas_f.sort(key=lambda x: x[0], reverse=True)
    df_fuera = pd.DataFrame([f for _, f in filas_f])

    with pd.ExcelWriter(salida, engine='openpyxl') as w:
        df_matriz.to_excel(w, sheet_name='POR_EPS_ANIO', index=False)
        if not df_det.empty:
            df_det.to_excel(w, sheet_name='DETALLE', index=False)
        if not df_res.empty:
            df_res.to_excel(w, sheet_name='RESUMEN_EPS', index=False)
        if not df_nou.empty:
            df_nou.to_excel(w, sheet_name='NO_USADOS', index=False)
        if not df_fuera.empty:
            df_fuera.to_excel(w, sheet_name='FUERA_PROPUESTA', index=False)
        for ws in w.book.worksheets:
            for col in ws.columns:
                ancho = max((len(str(c.value)) for c in col if c.value is not None),
                            default=10)
                ws.column_dimensions[col[0].column_letter].width = min(max(ancho + 2, 10), 45)


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(
        description='Frecuencia y valor de códigos en RIPS por EPS y año.')
    ap.add_argument('--codigos', required=True, help='Excel con la columna CODIGO.')
    ap.add_argument('--origen', action='append', required=True,
                    help='Carpeta raíz de RIPS (repetible).')
    ap.add_argument('--salida', default=None)
    args = ap.parse_args()

    print("=== Cargando códigos de la propuesta ===")
    codigos, info, meta_cols = cargar_codigos(Path(args.codigos))
    codigos_set = set(codigos)

    origenes = [Path(o) for o in args.origen]
    salida = Path(args.salida) if args.salida else origenes[0] / '_FRECUENCIA_CODIGOS.xlsx'

    acc = defaultdict(lambda: [0, 0.0])          # (cod, eps, anio) -> [frecuencia, valor]
    info_rips = defaultdict(lambda: {'tipos': set(), 'nombre': ''})
    stats = recolectar(origenes, acc, info_rips)

    print("\n=== Generando informe ===")
    escribir(salida, codigos, info, meta_cols, acc, info_rips)

    usados_prop = len({c for (c, _, _), (f, _) in acc.items() if f and c in codigos_set})
    fuera = len({c for (c, _, _) in acc if c not in codigos_set})
    print("\n────────────────────── RESUMEN ──────────────────────")
    print(f"  Archivos leídos : {stats['archivos']}  (JSON: {stats['json']}, TXT: {stats['txt']})")
    print(f"  Códigos propuesta: {len(codigos)}  |  usados: {usados_prop}  |  sin uso: {len(codigos) - usados_prop}")
    print(f"  Códigos en RIPS fuera de la propuesta: {fuera}")
    print(f"  Informe          : {salida}")
    print(f"  Hora             : {datetime.now():%Y-%m-%d %H:%M:%S}")
    print("──────────────────────────────────────────────────────")


if __name__ == '__main__':
    main()
