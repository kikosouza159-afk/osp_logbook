@echo off
setlocal
cd /d "%~dp0"
title OSP Monitor Engine - Execucao Manual

where python >nul 2>&1
if %errorlevel%==0 (
  python "%~dp0osp_monitor.py"
  set EXITCODE=%errorlevel%
  goto :fim
)

where py >nul 2>&1
if %errorlevel%==0 (
  py -3 "%~dp0osp_monitor.py"
  set EXITCODE=%errorlevel%
  goto :fim
)

echo [ERRO] Python nao encontrado no PATH.
set EXITCODE=1

:fim
echo.
echo Exit Code: %EXITCODE%
pause
exit /b %EXITCODE%
