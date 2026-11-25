@echo off
setlocal EnableExtensions
title OSP Locator - ETL SQL Server para Neon
pushd "%~dp0" >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Pasta do ETL inacessivel.
  pause
  exit /b 1
)
set "ETL_DIR=%CD%"
set "PYTHON_EXE="
for /f "usebackq delims=" %%I in (`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ETL_DIR%\localizar_python.ps1" -Quiet`) do (
  if not defined PYTHON_EXE set "PYTHON_EXE=%%I"
)
if not defined PYTHON_EXE (
  echo [ERRO] Python nao encontrado. Execute INSTALAR_DEPENDENCIAS.bat primeiro.
  popd
  pause
  exit /b 1
)
"%PYTHON_EXE%" "%ETL_DIR%\etl_locator.py" %*
set "EXITCODE=%ERRORLEVEL%"
echo.
if not "%EXITCODE%"=="0" echo [ERRO] ETL retornou codigo %EXITCODE%. Verifique os logs.
popd
exit /b %EXITCODE%
