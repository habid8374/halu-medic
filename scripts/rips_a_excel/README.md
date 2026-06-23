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
