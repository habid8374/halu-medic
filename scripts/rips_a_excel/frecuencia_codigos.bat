@echo off
REM ===================================================================
REM  Frecuencia de uso de codigos (propuesta tarifaria) en los RIPS
REM  por EPS y anio (frecuencia + valor facturado).
REM
REM  COMO USAR: clic derecho sobre este archivo -> "Ejecutar" (o doble
REM  clic). NO abras el .py: ese se abre en el editor (VSCode) y no corre.
REM ===================================================================
setlocal
cd /d "%~dp0"
set "SCRIPT=%~dp0frecuencia_codigos.py"

REM --- Detectar el interprete de Python (primero el lanzador "py") ---
set "PY="
where py        >nul 2>nul && set "PY=py"
if not defined PY ( where python  >nul 2>nul && set "PY=python" )
if not defined PY ( where python3 >nul 2>nul && set "PY=python3" )

if not defined PY (
  echo.
  echo  [ERROR] No se encontro Python en este equipo.
  echo  Instalalo desde https://www.python.org/downloads/
  echo  y MARCA la casilla "Add Python to PATH" durante la instalacion.
  echo.
  pause
  exit /b 1
)

echo.
echo  Interprete detectado: %PY%
%PY% --version

echo.
echo  Instalando dependencias (solo la primera vez)...
%PY% -m pip install --quiet pandas openpyxl

echo.
echo  Contando codigos en los RIPS...
echo.

REM  >>> EDITA AQUI: ruta del Excel de codigos y las carpetas de RIPS <<<
REM  Para agregar codigos que NO estan en el Excel de propuesta, usa
REM  --codigo-extra "CODIGO=Descripcion" (puedes repetirlo cuantas veces quieras).
%PY% "%SCRIPT%" ^
  --codigos "D:\CODIGOS_PROPUESTA_TARIFARIA_MUTUAL_SER.xlsx" ^
  --origen "D:\RIPS 2026" ^
  --origen "C:\Users\auxgerencia\Desktop\RIPS\RIPS AÑO 2024" ^
  --codigo-extra "876122=ARTERIOGRAFIA CORONARIA CON CATETERISMO IZQUIERDO (CIRUGIA VASCULAR)"

echo.
echo  Listo. Revisa "_FRECUENCIA_CODIGOS.xlsx" en tu primera carpeta de origen.
echo.
pause
endlocal
