# Convertir RIPS → Excel por EPS y año

Herramienta para **extraer los RIPS** (en `JSON` y/o `TXT`) de una carpeta y
**convertirlos a Excel**, generando **un archivo por cada EPS y año**, con el
mismo formato del modelo `RIPS_EDITABLE` (una hoja por sección del RIPS).

> ⚠️ Este script se ejecuta **en tu PC con Windows**, donde están los archivos
> (`D:\RIPS 2026`, etc.). El servidor de Claude no tiene acceso a tu disco `D:`.

---

## Qué hace

- Recorre la estructura `MES → EPS → archivos`, por ejemplo:

  ```
  D:\RIPS 2026\
      RIPS ENERO 2026\
          NUEVA EPS\        ← .json  ó  AF*.txt, US*.txt, AC*.txt, ...
          SALUD TOTAL\
      RIPS FEBRERO 2026\
          ...
  ```

- Lee los **dos formatos** de RIPS que conviven en Colombia:
  - **JSON** — Resolución 948 de 2026 / 2275 de 2023 (estructura anidada por usuario).
  - **TXT** — Resolución 3374 de 2000 (archivos `AF, US, AC, AP, AU, AH, AN, AM, AT`).

- Genera en la carpeta `_EXCEL_RIPS` un archivo por EPS y año, p. ej.:
  - `NUEVA_EPS_2026.xlsx`
  - `SALUD_TOTAL_2026.xlsx`
  - `NUEVA_EPS_2025.xlsx`

- Cada Excel trae estas hojas, **idénticas al modelo `RIPS_EDITABLE`** (solo se
  crean las que tengan datos):
  `FACTURA`, `USUARIOS`, `CONSULTAS`, `PROCEDIMIENTOS`, `HOSPITALIZACION`,
  `MEDICAMENTOS`, `OTROS_SERVICIOS`, `URGENCIAS`, `RECIEN_NACIDOS`.

- Los nombres y el **orden de las columnas** son los del RIPS JSON. En cada
  servicio se **inyecta el documento del paciente**
  (`tipoDocumentoIdentificacion`, `numDocumentoIdentificacion`) para saber a
  quién pertenece. **No se agregan columnas extra.**
- Se conservan los tipos: los códigos con ceros a la izquierda (`080010235501`,
  `08001`, `01`) quedan como **texto**; los valores (`vrServicio`,
  `consecutivo`, etc.) quedan como **número**.

La **EPS** se toma del nombre de la subcarpeta; el **año**, del nombre de la
carpeta del mes (`RIPS ENERO 2026`). Tanto los JSON como los TXT de una misma
EPS/año se **consolidan** en el mismo archivo; al juntar varios meses, la hoja
`FACTURA` tendrá **una fila por cada factura**.

---

## Requisitos

1. **Python 3.10+** instalado en Windows → https://www.python.org/downloads/
   (marca la casilla *"Add Python to PATH"* al instalar).
2. Dependencias (el `.bat` las instala solo):
   ```
   pip install pandas openpyxl
   ```

---

## Uso

### Opción A — Doble clic (más fácil)

1. Abre `convertir_rips.bat` con clic derecho → *Editar*.
2. Ajusta las líneas `--origen` con tus rutas reales (deja solo las que existan):
   ```
   --origen "D:\RIPS 2026"
   --origen "D:\RIPS 2025"
   --origen "D:\RIPS 2024"
   ```
3. Guarda y haz **doble clic** en `convertir_rips.bat`.
4. Al terminar, busca los Excel en `D:\RIPS 2026\_EXCEL_RIPS`.

### Opción B — Por terminal (PowerShell / CMD)

```bat
python convertir_rips_excel.py --origen "D:\RIPS 2026"

REM Varios años a la vez:
python convertir_rips_excel.py --origen "D:\RIPS 2024" --origen "D:\RIPS 2025" --origen "D:\RIPS 2026"

REM Elegir carpeta de salida:
python convertir_rips_excel.py --origen "D:\RIPS 2026" --salida "D:\Informes\Excel RIPS"
```

---

## Notas y casos especiales

- **Cuando lleguen los RIPS de 2024 y 2025** (que traen TXT y JSON), solo agrega
  sus carpetas con `--origen`. El script mezcla TXT y JSON sin problema.
- Si una carpeta de mes tiene archivos **sueltos** (sin subcarpeta de EPS), se
  agrupan bajo `SIN_CLASIFICAR_<año>.xlsx` para que los revises aparte.
- Los archivos `CT*.txt` (control/cuadre) se ignoran por diseño.
- Si un `.json` está corrupto, se omite y se avisa en pantalla; el resto continúa.
- Los nombres de EPS se normalizan a MAYÚSCULAS. Si la misma EPS aparece escrita
  distinto entre meses (p. ej. `Nueva EPS` vs `NUEVA EPS S.A.`), se tratarán como
  EPS diferentes; conviene unificar los nombres de carpeta antes de correr el
  script.

---

## Para el informe de todas las EPS

Cada `*.xlsx` queda separado por EPS y año, con el formato exacto del RIPS. Si
además quieres un **Excel maestro comparativo** (una hoja resumen con totales por
EPS/año y servicio para comparar de un vistazo), avísame y lo agrego como una
segunda pasada — sin tocar este formato.

---

# Frecuencia de uso de códigos (propuesta tarifaria)  →  `frecuencia_codigos.py`

Segunda herramienta. Toma un Excel con una columna **`CODIGO`** (ej.
`CODIGOS_PROPUESTA_TARIFARIA_MUTUAL_SER.xlsx`) y cuenta, para cada código,
**cuántas veces se usó en los RIPS** y **cuánto se facturó** (`vrServicio`),
desglosado **por EPS y año**.

Busca los códigos en `codConsulta`, `codProcedimiento` y `codTecnologiaSalud`
(consultas, procedimientos, medicamentos, otros servicios), tanto en JSON (2026)
como en TXT (2024: archivos `AC`, `AP`, `AM`, `AT`).

### Uso

Doble clic en `frecuencia_codigos.bat` (edita antes las rutas), o por terminal:

```bat
python frecuencia_codigos.py ^
  --codigos "D:\CODIGOS_PROPUESTA_TARIFARIA_MUTUAL_SER.xlsx" ^
  --origen "D:\RIPS 2026" ^
  --origen "C:\Users\auxgerencia\Desktop\RIPS\RIPS AÑO 2024"
```

### Resultado: `_FRECUENCIA_CODIGOS.xlsx`

| Hoja | Contenido |
|------|-----------|
| `POR_EPS_ANIO` | Matriz: una fila por código de la propuesta (con clasificación, servicio, tecnología, tarifa) y, por cada EPS/año, columnas **Frec** y **Valor**, más **TOTAL**. Incluye los códigos con frecuencia 0. |
| `DETALLE` | Formato largo: `codigo, EPS, ANIO, FRECUENCIA, VALOR_FACTURADO` (ideal para tablas dinámicas). |
| `RESUMEN_EPS` | Totales por EPS y año: usos, valor facturado y cuántos códigos distintos se usaron. |
| `NO_USADOS` | Códigos de la propuesta que **nunca se usaron** en los RIPS (frecuencia 0). |
| `FUERA_PROPUESTA` | CUPS que **sí aparecen en los RIPS pero no están en la propuesta**, con su tipo, nombre (si lo trae el RIPS) y Frec/Valor por EPS/año. Ordenados por frecuencia — útil para detectar oportunidades de tarifa. |

### Cruce de códigos (tolerancia)

El cruce normaliza los códigos para evitar falsos negativos:
- **Ceros iniciales perdidos por Excel**: los CUPS que empiezan por `0` (p. ej.
  `030405`) suelen quedar guardados como número `30405` en el Excel de propuesta.
  El cruce rellena con ceros a la izquierda hasta 6 dígitos.
- **Sufijos con guion**: `325401-1` se cruza por su base `325401`.
- Se ignora el `.0` de los números float.

### Agregar códigos que no están en el Excel

Si necesitas incluir códigos que no aparecen en el Excel de propuesta (p. ej.
`876122`), usa `--codigo-extra` (repetible):

```bat
python frecuencia_codigos.py --codigos "...propuesta.xlsx" --origen "D:\RIPS 2026" ^
  --codigo-extra "876122=ARTERIOGRAFIA CORONARIA CON CATETERISMO IZQUIERDO" ^
  --codigo-extra "OTRO_CODIGO=Descripcion"
```

Estos códigos se marcan en la columna de tarifa como **`AGREGADO MANUAL`** para
distinguirlos de los que sí venían en el Excel.
