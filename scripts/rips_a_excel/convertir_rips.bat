@echo off
REM ===================================================================
REM  Convertir RIPS (JSON y TXT) a Excel por EPS y anio
REM  Doble clic para ejecutar. Edita la variable ORIGEN si cambia la ruta.
REM ===================================================================
setlocal

REM --- Carpeta(s) de RIPS. Agrega mas lineas --origen para 2024 / 2025 ---
set "SCRIPT=%~dp0convertir_rips_excel.py"

echo.
echo  Instalando dependencias (solo la primera vez)...
python -m pip install --quiet pandas openpyxl

echo.
echo  Procesando RIPS...
echo.

REM  >>> EDITA AQUI las rutas de tus carpetas de RIPS <<<
python "%SCRIPT%" ^
  --origen "D:\RIPS 2026" ^
  --origen "D:\RIPS 2025" ^
  --origen "D:\RIPS 2024"

echo.
echo  Listo. Revisa la carpeta "_EXCEL_RIPS" dentro de tu primera ruta de origen.
echo.
pause
endlocal
