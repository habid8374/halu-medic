@echo off
REM ===================================================================
REM  Convertir RIPS (JSON y TXT) a Excel por EPS y anio
REM
REM  COMO USAR: clic derecho sobre este archivo -> "Ejecutar" (o doble
REM  clic). NO abras el .py: ese se abre en el editor (VSCode) y no corre.
REM ===================================================================
setlocal
cd /d "%~dp0"
set "SCRIPT=%~dp0convertir_rips_excel.py"

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
echo  Procesando RIPS...
echo.

REM  >>> EDITA AQUI las rutas de tus carpetas de RIPS <<<
%PY% "%SCRIPT%" ^
  --origen "D:\RIPS 2026" ^
  --origen "D:\RIPS 2025" ^
  --origen "D:\RIPS 2024"

echo.
echo  Listo. Revisa la carpeta "_EXCEL_RIPS" dentro de tu primera ruta de origen.
echo.
pause
endlocal
