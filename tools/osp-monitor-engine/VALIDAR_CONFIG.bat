@echo off
setlocal
cd /d "%~dp0"
title OSP Monitor Engine - Validar Configuracao

where python >nul 2>&1
if %errorlevel%==0 (
  python "%~dp0validar_config.py"
  set EXITCODE=%errorlevel%
  goto :fim
)

where py >nul 2>&1
if %errorlevel%==0 (
  py -3 "%~dp0validar_config.py"
  set EXITCODE=%errorlevel%
  goto :fim
)

echo [ERRO] Python nao encontrado no PATH.
set EXITCODE=1

:fim
echo.
pause
exit /b %EXITCODE%
