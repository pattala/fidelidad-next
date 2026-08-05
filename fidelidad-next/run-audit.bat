@echo off
cd /d "%~dp0"
title Centro de Control y Mantenimiento 360 - Fidelidad-Next

:MENU
cls
echo.
echo  +--------------------------------------------------------------+
echo  ^|    CENTRO DE CONTROL ^& MANTENIMIENTO INTEGRAL 360 (NEXT.JS)   ^|
echo  +--------------------------------------------------------------+
echo  ^|  --- 1. AUDITORIA DE SISTEMA (45 PRUEBAS AUTOMATIZADAS) ---   ^|
echo  ^|   [1]  Auditar Desarrollo  (.dev_creds.json)                 ^|
echo  ^|   [2]  Auditar Produccion  (.main_creds.json)                ^|
echo  ^|   [3]  GESTOR MULTI-CLIENTE MARCA BLANCA (Carpeta creds/)    ^|
echo  ^|   [4]  Abrir ultimo reporte HTML generado                    ^|
echo  ^|                                                              ^|
echo  ^|  --- 2. MANTENIMIENTO DE BASE DE DATOS FIRESTORE ---         ^|
echo  ^|   [5]  Resguardo / Backup Local Firestore (DESARROLLO)       ^|
echo  ^|   [6]  Resguardo / Backup Local Firestore (PRODUCCION)       ^|
echo  ^|   [7]  Limpieza de Registros Viejos (+60 dias - DEV)         ^|
echo  ^|   [8]  Limpieza de Registros Viejos (+60 dias - MAIN)        ^|
echo  ^|                                                              ^|
echo  ^|  --- 3. MANTENIMIENTO DE SOFTWARE ^& CODIGO (NEXT.JS) ---      ^|
echo  ^|   [9]  Verificar Compilacion de Codigo (npm run build)       ^|
echo  ^|   [10] Auditar Seguridad de Librerias (npm audit)            ^|
echo  ^|   [11] Reparar Vulnerabilidades de Librerias (npm audit fix) ^|
echo  ^|                                                              ^|
echo  ^|   [0]  Salir                                                 ^|
echo  +--------------------------------------------------------------+
echo.
set /p OPCION=  Selecciona una opcion [0-11]: 

if "%OPCION%"=="1" goto RUN_DEV
if "%OPCION%"=="2" goto RUN_MAIN
if "%OPCION%"=="3" goto RUN_TENANT_MENU
if "%OPCION%"=="4" goto OPEN_REPORT
if "%OPCION%"=="5" goto BACKUP_DEV
if "%OPCION%"=="6" goto BACKUP_MAIN
if "%OPCION%"=="7" goto CLEANUP_DEV
if "%OPCION%"=="8" goto CLEANUP_MAIN
if "%OPCION%"=="9" goto BUILD_CHECK
if "%OPCION%"=="10" goto NPM_AUDIT
if "%OPCION%"=="11" goto NPM_FIX
if "%OPCION%"=="0" exit
goto MENU

:RUN_TENANT_MENU
cls
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run-tenant-menu.ps1
goto MENU

:RUN_DEV
set AUDIT_ARG=--env=dev
set AUDIT_REPORT=audit-report-dev.html
set AUDIT_LABEL=DESARROLLO
goto DO_RUN

:RUN_MAIN
cls
echo.
echo  ATENCION: Auditoria en PRODUCCION (MAIN).
echo  Los datos TEST_AUDIT_* se crean y borran automaticamente.
echo.
set /p CONFIRM=  Confirmar ejecucion en MAIN [S/N]: 
if /i not "%CONFIRM%"=="S" goto MENU
set AUDIT_ARG=--env=main
set AUDIT_REPORT=audit-report-main.html
set AUDIT_LABEL=PRODUCCION
goto DO_RUN

:RUN_CUSTOM
cls
echo.
echo  Ruta del archivo de credenciales:
echo  Ejemplo: C:\proyectos\firebase-creds.json
echo.
set /p CREDS_PATH=  Ruta: 
if "%CREDS_PATH%"=="" goto MENU
if not exist "%CREDS_PATH%" (
    echo.
    echo  Archivo no encontrado. Verifica la ruta.
    timeout /t 3 >nul
    goto MENU
)
set AUDIT_ARG=--creds="%CREDS_PATH%"
set AUDIT_REPORT=audit-report-dev.html
set AUDIT_LABEL=PERSONALIZADO
goto DO_RUN

:DO_RUN
cls
echo.
echo  Iniciando auditoria en %AUDIT_LABEL%...
echo  ---------------------------------------------------
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run-audit-helper.ps1 -Arg "%AUDIT_ARG%" -ScriptTarget "scripts\auditoria-integral-sistema.cjs" -Label "Ejecutando 45 pruebas..."
set EXIT_CODE=%ERRORLEVEL%
echo.
echo  ---------------------------------------------------
if "%EXIT_CODE%"=="0" (
    echo  AUDITORIA EXITOSA - 45/45 OK
) else (
    echo  SE ENCONTRARON ERRORES - Revisar el reporte
)
echo.
echo  Abriendo reporte HTML...
timeout /t 1 >nul
if exist "%AUDIT_REPORT%" (
    start "" "%AUDIT_REPORT%"
) else (
    echo  No se encontro: %AUDIT_REPORT%
)
echo.
echo  Presiona cualquier tecla para volver al menu...
pause >nul
goto MENU

:BACKUP_DEV
cls
echo.
echo  Iniciando Resguardo / Backup de Firestore (DESARROLLO)...
echo  ---------------------------------------------------
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run-audit-helper.ps1 -Arg "--env=dev" -ScriptTarget "scripts\backup-firestore.cjs" -Label "Exportando colecciones Firestore..."
echo.
echo  Presiona cualquier tecla para volver al menu...
pause >nul
goto MENU

:BACKUP_MAIN
cls
echo.
echo  ATENCION: Descargando copia de respaldo de PRODUCCION.
echo.
set /p CONFIRM_BCK=  Confirmar respaldo de MAIN [S/N]: 
if /i not "%CONFIRM_BCK%"=="S" goto MENU
cls
echo.
echo  Iniciando Resguardo / Backup de Firestore (PRODUCCION)...
echo  ---------------------------------------------------
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run-audit-helper.ps1 -Arg "--env=main" -ScriptTarget "scripts\backup-firestore.cjs" -Label "Exportando colecciones de PRODUCCION..."
echo.
echo  Presiona cualquier tecla para volver al menu...
pause >nul
goto MENU

:CLEANUP_DEV
cls
echo.
echo  Iniciando Limpieza y Purgado (DESARROLLO)...
echo  ---------------------------------------------------
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run-audit-helper.ps1 -Arg "--env=dev" -ScriptTarget "scripts\mantenimiento-limpieza.cjs" -Label "Limpiando registros de mas de 60 dias..."
echo.
echo  Presiona cualquier tecla para volver al menu...
pause >nul
goto MENU

:CLEANUP_MAIN
cls
echo.
echo  ATENCION: Limpieza de notificaciones y datos expirados en PRODUCCION (>60 dias).
echo.
set /p CONFIRM_CLN=  Confirmar purga en PRODUCCION [S/N]: 
if /i not "%CONFIRM_CLN%"=="S" goto MENU
cls
echo.
echo  Iniciando Limpieza y Purgado (PRODUCCION)...
echo  ---------------------------------------------------
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run-audit-helper.ps1 -Arg "--env=main" -ScriptTarget "scripts\mantenimiento-limpieza.cjs" -Label "Limpiando registros antiguos en PRODUCCION..."
echo.
echo  Presiona cualquier tecla para volver al menu...
pause >nul
goto MENU

:BUILD_CHECK
cls
echo.
echo  Verificando compilacion de Next.js (npm run build)...
echo  ---------------------------------------------------
echo.
call npm run build
set BUILD_EXIT=%ERRORLEVEL%
echo.
echo  ---------------------------------------------------
if "%BUILD_EXIT%"=="0" (
    echo  COMPILACION EXITOSA - El codigo esta listo para deploy.
) else (
    echo  ERROR DE COMPILACION - Revisar los errores de TypeScript/Build arriba.
)
echo.
echo  Presiona cualquier tecla para volver al menu...
pause >nul
goto MENU

:NPM_AUDIT
cls
echo.
echo  Auditando seguridad de librerias npm...
echo  ---------------------------------------------------
echo.
call npm audit
echo.
echo  ---------------------------------------------------
echo  Presiona cualquier tecla para volver al menu...
pause >nul
goto MENU

:NPM_FIX
cls
echo.
echo  Reparando vulnerabilidades de librerias (npm audit fix)...
echo  ---------------------------------------------------
echo.
call npm audit fix
echo.
echo  ---------------------------------------------------
echo  Presiona cualquier tecla para volver al menu...
pause >nul
goto MENU

:OPEN_REPORT
cls
echo.
echo  Reportes disponibles:
if exist "audit-report-dev.html"  echo    [D] audit-report-dev.html
if exist "audit-report-main.html" echo    [M] audit-report-main.html
echo.
set /p WHICH=  Abrir [D]ev o [M]ain: 
if /i "%WHICH%"=="D" if exist "audit-report-dev.html"  start "" "audit-report-dev.html"
if /i "%WHICH%"=="M" if exist "audit-report-main.html" start "" "audit-report-main.html"
goto MENU
