@echo off
setlocal
cd /d "%~dp0"
title OSP Monitor Engine - Dependencias

where python >nul 2>&1
if %errorlevel%==0 (
  python -m pip install --upgrade pip
  python -m pip install -r "%~dp0requirements.txt"
  goto :fim
)

where py >nul 2>&1
if %errorlevel%==0 (
  py -3 -m pip install --upgrade pip
  py -3 -m pip install -r "%~dp0requirements.txt"
  goto :fim
)

echo [ERRO] Python nao encontrado no PATH.
pause
exit /b 1

:fim
if errorlevel 1 (
  echo.
  echo [ERRO] Falha ao instalar dependencias.
  pause
  exit /b 1
)

echo.
echo Dependencias instaladas com sucesso.
pause
