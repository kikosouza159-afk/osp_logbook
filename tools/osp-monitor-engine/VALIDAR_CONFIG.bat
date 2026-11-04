@echo off
setlocal EnableExtensions
title OSP Monitor Engine - Validar Configuracao

pushd "%~dp0" >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Nao foi possivel acessar a pasta do ETL.
  pause
  exit /b 1
)

set "PYTHON_EXE="
for /f "usebackq delims=" %%I in (`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0localizar_python.ps1" -Quiet`) do (
  if not defined PYTHON_EXE set "PYTHON_EXE=%%I"
)

if not defined PYTHON_EXE (
  echo [ERRO] Python real nao encontrado.
  echo Configure PYTHON_EXE no .env.
  set "EXITCODE=1"
  goto :fim
)

echo Python: %PYTHON_EXE%
echo.
"%PYTHON_EXE%" "validar_config.py"
set "EXITCODE=%errorlevel%"

:fim
popd
echo.
pause
exit /b %EXITCODE%
