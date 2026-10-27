@echo off
setlocal

cd /d "%~dp0\.."

echo ================================================
echo  OSP ALERTA - SQL SERVER ^> POSTGRESQL
echo ================================================
echo.

call npm run etl:osp-alerta
set EXIT_CODE=%ERRORLEVEL%

echo.
echo ================================================
echo PROCESSO FINALIZADO
echo Exit Code: %EXIT_CODE%
echo ================================================

exit /b %EXIT_CODE%
