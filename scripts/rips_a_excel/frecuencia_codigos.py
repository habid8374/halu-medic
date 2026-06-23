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


def eps_y_regimen(nombre_carpeta):
    """De 'COOSALUD CONTRIBUTIVO' devuelve ('COOSALUD', 'Contributivo').

    El régimen se detecta por las palabras CONTRIB*/SUBSID* del nombre y se
    quita del nombre de la EPS. 'EPS' NO se quita (es parte de 'NUEVA EPS').
    """
    raw = re.sub(r'\s+', ' ', (nombre_carpeta or '').strip())
    norm = quitar_tildes(raw.upper())
    if 'CONTRIB' in norm:
        regimen = 'Contributivo'
    elif 'SUBSID' in norm:
        regimen = 'Subsidiado'
    else:
        regimen = 'Otro'
    keep = []
    for tok in raw.split(' '):
        tn = quitar_tildes(tok.upper())
        if 'CONTRIB' in tn or 'SUBSID' in tn or tn in ('REGIMEN', 'REG.', 'REG'):
            continue
        keep.append(tok)
    eps = re.sub(r'\s+', ' ', ' '.join(keep)).strip().upper() or 'SIN_CLASIFICAR'
    return eps, regimen


def eps_archivo(nombre):
    n = re.sub(r'[^A-Z0-9]+', '_', quitar_tildes(nombre_eps(nombre))).strip('_')
    return n or 'SIN_CLASIFICAR'


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


def agregar_extras(extras, codigos, info, meta_cols):
    """Agrega códigos manuales (no presentes en el Excel) a la lista de propuesta.

    Cada extra puede ser 'CODIGO' o 'CODIGO=Descripción'. Se marcan en la
    columna de tarifa como 'AGREGADO MANUAL' para distinguirlos en el informe.
    """
    if not extras:
        return
    cod_col = next((mc for mc in meta_cols if mc.upper().strip() == 'CODIGO'), None)
    agregados = 0
    for item in extras:
        codigo, _, desc = str(item).partition('=')
        clave = clave_match(codigo)
        if not clave:
            continue
        if clave in info:
            print(f"  [i] '{codigo}' ya estaba en la propuesta; no se duplica.")
            continue
        registro = {}
        for mc in meta_cols:
            nom = mc.upper().strip()
            if mc == cod_col:
                registro[mc] = norm_cod(codigo)
            elif 'TECNOLOGIA' in nom or 'SERVICIO' in nom:
                registro[mc] = desc.strip() or None
            elif 'TARIFA' in nom:
                registro[mc] = 'AGREGADO MANUAL'
            else:
                registro[mc] = None
        info[clave] = registro
        codigos.append(clave)
        agregados += 1
    if agregados:
        print(f"  Códigos agregados manualmente: {agregados}")


# ── Conteo en RIPS ──────────────────────────────────────────────────────────

def _registrar(acc, info_rips, cod, eps, regimen, anio, valor, tipo, nombre):
    """Acumula frecuencia/valor de CUALQUIER código y guarda su tipo/nombre."""
    a = acc[(cod, eps, regimen, anio)]
    a[0] += 1
    a[1] += valor
    meta = info_rips[cod]
    meta['tipos'].add(tipo)
    if nombre and not meta['nombre']:
        meta['nombre'] = str(nombre).strip()


def contar_json(path: Path, eps, regimen, anio, acc, info_rips):
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
                        _registrar(acc, info_rips, cod, eps, regimen, anio,
                                   a_float(serv.get('vrServicio')), tipo,
                                   serv.get('nomTecnologiaSalud'))


def contar_txt(path: Path, eps, regimen, anio, acc, info_rips):
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
            _registrar(acc, info_rips, cod, eps, regimen, anio, valor, tipo, nombre)


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
                eps, regimen = eps_y_regimen(eps_nom)
                archivos = (carpeta.rglob('*') if recursivo
                            else (f for f in mes_dir.iterdir() if f.is_file()))
                for f in archivos:
                    if not f.is_file():
                        continue
                    ext = f.suffix.lower()
                    if ext == '.json':
                        stats['archivos'] += 1; stats['json'] += 1
                        contar_json(f, eps, regimen, anio, acc, info_rips)
                    elif ext == '.txt' and prefijo_txt(f.name):
                        stats['archivos'] += 1; stats['txt'] += 1
                        contar_txt(f, eps, regimen, anio, acc, info_rips)
    return stats


# ── Escritura del informe ───────────────────────────────────────────────────

REG_ORDER = {'Contributivo': 0, 'Subsidiado': 1, 'Otro': 2}


def _ajustar_anchos(ws):
    for col in ws.columns:
        ancho = max((len(str(c.value)) for c in col if c.value is not None), default=10)
        ws.column_dimensions[col[0].column_letter].width = min(max(ancho + 2, 10), 45)


def limpiar_nombre(s):
    """Nombre de archivo válido en Windows (conserva espacios)."""
    s = re.sub(r'[\\/:*?"<>|]+', ' ', str(s))
    return re.sub(r'\s+', ' ', s).strip() or 'SIN_CLASIFICAR'


def escribir(salida_dir: Path, codigos, info, meta_cols, acc, info_rips):
    """Genera UN libro independiente por cada EPS + régimen + año.

    Ej.: 'COOSALUD CONTRIBUTIVO 2024.xlsx', 'COOSALUD SUBSIDIADO 2026.xlsx'.
    """
    salida_dir.mkdir(parents=True, exist_ok=True)
    codigos_set = set(codigos)
    grupos = sorted({(eps, reg, anio) for (_, eps, reg, anio) in acc},
                    key=lambda x: (x[0], REG_ORDER.get(x[1], 9), str(x[2])))
    generados = 0

    for eps, regimen, anio in grupos:
        anio_txt = anio if anio else 'SIN_ANIO'

        # ── FRECUENCIA (todos los códigos de la propuesta) ──
        filas = []
        for c in codigos:
            f, v = acc.get((c, eps, regimen, anio), [0, 0.0])
            fila = {mc: info[c][mc] for mc in meta_cols}
            fila['FRECUENCIA'] = f
            fila['VALOR_FACTURADO'] = round(v, 2)
            filas.append(fila)
        df_frec = pd.DataFrame(filas)

        # ── NO_USADOS (frecuencia 0) ──
        df_nou = pd.DataFrame([{mc: info[c][mc] for mc in meta_cols} for c in codigos
                               if acc.get((c, eps, regimen, anio), [0, 0.0])[0] == 0])

        # ── FUERA_PROPUESTA (usados en este grupo y no están en la propuesta) ──
        filas_f = []
        for (c, e, r, a), (f, v) in acc.items():
            if e == eps and r == regimen and a == anio and f and c not in codigos_set:
                meta = info_rips.get(c, {'tipos': set(), 'nombre': ''})
                filas_f.append((f, {'CODIGO': c,
                                    'TIPO': ', '.join(sorted(meta['tipos'])),
                                    'NOMBRE_RIPS': meta['nombre'],
                                    'FRECUENCIA': f,
                                    'VALOR_FACTURADO': round(v, 2)}))
        filas_f.sort(key=lambda x: x[0], reverse=True)
        df_fuera = pd.DataFrame([x for _, x in filas_f])

        # ── RESUMEN (una fila) ──
        tot_f = int(df_frec['FRECUENCIA'].sum())
        tot_v = round(float(df_frec['VALOR_FACTURADO'].sum()), 2)
        usados = int((df_frec['FRECUENCIA'] > 0).sum())
        df_res = pd.DataFrame([{
            'EPS': eps, 'REGIMEN': regimen, 'ANIO': anio_txt,
            'Codigos_propuesta': len(codigos), 'Codigos_usados': usados,
            'Codigos_sin_uso': len(codigos) - usados,
            'Total_usos': tot_f, 'Total_valor': tot_v,
            'Codigos_fuera_propuesta': len(filas_f),
        }])

        nombre = limpiar_nombre(f"{eps} {regimen.upper()} {anio_txt}")
        ruta = salida_dir / f"{nombre}.xlsx"
        with pd.ExcelWriter(ruta, engine='openpyxl') as w:
            df_res.to_excel(w, sheet_name='RESUMEN', index=False)
            df_frec.to_excel(w, sheet_name='FRECUENCIA', index=False)
            if not df_nou.empty:
                df_nou.to_excel(w, sheet_name='NO_USADOS', index=False)
            if not df_fuera.empty:
                df_fuera.to_excel(w, sheet_name='FUERA_PROPUESTA', index=False)
            for ws in w.book.worksheets:
                _ajustar_anchos(ws)
        print(f"  ✔ {ruta.name}  (usos: {tot_f})")
        generados += 1

    return generados


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(
        description='Frecuencia y valor de códigos en RIPS por EPS y año.')
    ap.add_argument('--codigos', required=True, help='Excel con la columna CODIGO.')
    ap.add_argument('--origen', action='append', required=True,
                    help='Carpeta raíz de RIPS (repetible).')
    ap.add_argument('--codigo-extra', action='append', default=[], dest='extras',
                    help='Código adicional que NO está en el Excel de propuesta. '
                         'Repetible. Formato: CODIGO o "CODIGO=Descripción".')
    ap.add_argument('--salida', default=None,
                    help='Carpeta de salida (un Excel por EPS). '
                         'Por defecto <primer origen>\\_FRECUENCIA_CODIGOS')
    args = ap.parse_args()

    print("=== Cargando códigos de la propuesta ===")
    codigos, info, meta_cols = cargar_codigos(Path(args.codigos))
    agregar_extras(args.extras, codigos, info, meta_cols)
    codigos_set = set(codigos)

    origenes = [Path(o) for o in args.origen]
    salida = Path(args.salida) if args.salida else origenes[0] / '_FRECUENCIA_CODIGOS'

    acc = defaultdict(lambda: [0, 0.0])     # (cod, eps, regimen, anio) -> [frecuencia, valor]
    info_rips = defaultdict(lambda: {'tipos': set(), 'nombre': ''})
    stats = recolectar(origenes, acc, info_rips)

    print("\n=== Generando informes (un libro por EPS) ===")
    generados = escribir(salida, codigos, info, meta_cols, acc, info_rips)

    usados_prop = len({c for (c, _, _, _), (f, _) in acc.items() if f and c in codigos_set})
    fuera = len({c for (c, _, _, _) in acc if c not in codigos_set})
    print("\n────────────────────── RESUMEN ──────────────────────")
    print(f"  Archivos leídos : {stats['archivos']}  (JSON: {stats['json']}, TXT: {stats['txt']})")
    print(f"  Códigos propuesta: {len(codigos)}  |  usados: {usados_prop}  |  sin uso: {len(codigos) - usados_prop}")
    print(f"  Códigos en RIPS fuera de la propuesta: {fuera}")
    print(f"  Libros generados : {generados}  (carpeta: {salida})")
    print(f"  Hora             : {datetime.now():%Y-%m-%d %H:%M:%S}")
    print("──────────────────────────────────────────────────────")


if __name__ == '__main__':
    main()
