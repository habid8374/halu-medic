@echo off
REM ===================================================================
REM  Frecuencia de uso de codigos (propuesta tarifaria) en los RIPS
REM  por EPS y anio (frecuencia + valor facturado).
REM  Doble clic para ejecutar. Edita las rutas de abajo si cambian.
REM ===================================================================
setlocal

set "SCRIPT=%~dp0frecuencia_codigos.py"

echo.
echo  Instalando dependencias (solo la primera vez)...
python -m pip install --quiet pandas openpyxl

echo.
echo  Contando codigos en los RIPS...
echo.

REM  >>> EDITA AQUI: ruta del Excel de codigos y las carpetas de RIPS <<<
python "%SCRIPT%" ^
  --codigos "D:\CODIGOS_PROPUESTA_TARIFARIA_MUTUAL_SER.xlsx" ^
  --origen "D:\RIPS 2026" ^
  --origen "C:\Users\auxgerencia\Desktop\RIPS\RIPS AÑO 2024"

echo.
echo  Listo. Revisa "_FRECUENCIA_CODIGOS.xlsx" en tu primera carpeta de origen.
echo.
pause
endlocal
