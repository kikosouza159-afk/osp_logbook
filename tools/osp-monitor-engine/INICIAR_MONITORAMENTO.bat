@echo off
setlocal
cd /d "%~dp0"
title OSP Monitor Engine

echo =============================================
echo        OSP MONITOR ENGINE
echo =============================================
echo.

if not exist ".env" (
  echo [ERRO] Arquivo .env nao encontrado.
  echo Copie .env.example para .env e configure as conexoes.
  echo.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0criar_tarefa.ps1"

if errorlevel 1 (
  echo.
  echo [ERRO] Nao foi possivel criar/iniciar o agendador.
  pause
  exit /b 1
)

echo.
echo Monitoramento configurado.
echo Pode fechar esta janela.
pause
