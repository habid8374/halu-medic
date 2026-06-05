@echo off
REM ─────────────────────────────────────────────────────────────────────
REM  Halu Medic — arranque limpio de backend + frontend (Windows)
REM  Doble clic, o ejecutar desde la raiz del proyecto: scripts\iniciar.bat
REM ─────────────────────────────────────────────────────────────────────
setlocal
set RAIZ=%~dp0..

echo.
echo ====================================================
echo   Halu Medic - iniciando entorno de desarrollo
echo ====================================================
echo.

REM --- Backend ---------------------------------------------------------
echo [1/2] Arrancando backend (Django) en http://localhost:8000 ...
start "Halu Medic - Backend" cmd /k "cd /d %RAIZ%\backend && call venv\Scripts\activate && python manage.py runserver"

REM --- Frontend (limpia cache .next para evitar variables de entorno viejas)
echo [2/2] Arrancando frontend (Next.js) en http://localhost:3000 ...
if exist "%RAIZ%\frontend\.next" rmdir /s /q "%RAIZ%\frontend\.next"
start "Halu Medic - Frontend" cmd /k "cd /d %RAIZ%\frontend && npm run dev"

echo.
echo  Se abrieron dos ventanas (backend y frontend).
echo  Cuando ambas terminen de cargar, entra a:  http://localhost:3000
echo  Usuario: demo   Password: Demo2026*
echo.
echo  (Esta ventana se puede cerrar)
echo.
pause
