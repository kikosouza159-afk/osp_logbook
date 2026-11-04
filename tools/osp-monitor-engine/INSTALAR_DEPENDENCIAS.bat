@echo off
setlocal EnableExtensions
title OSP Monitor Engine - Dependencias

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
  echo.
  echo [ERRO] Python real nao encontrado na VM.
  echo O atalho da Microsoft Store foi ignorado.
  echo.
  echo Se voce souber onde esta o Python, abra o arquivo .env e adicione:
  echo PYTHON_EXE=C:\Caminho\Do\Python\python.exe
  echo.
  popd
  pause
  exit /b 1
)

echo Python localizado:
echo %PYTHON_EXE%
echo.

"%PYTHON_EXE%" --version
if errorlevel 1 (
  echo [ERRO] O executavel encontrado nao iniciou corretamente.
  popd
  pause
  exit /b 1
)

"%PYTHON_EXE%" -m pip --version >nul 2>&1
if errorlevel 1 (
  echo Instalando pip...
  "%PYTHON_EXE%" -m ensurepip --upgrade
  if errorlevel 1 (
    echo [ERRO] Nao foi possivel instalar o pip.
    popd
    pause
    exit /b 1
  )
)

echo.
echo Instalando dependencias...
"%PYTHON_EXE%" -m pip install --upgrade pip
if errorlevel 1 (
  echo [ERRO] Falha ao atualizar o pip.
  popd
  pause
  exit /b 1
)

"%PYTHON_EXE%" -m pip install -r "requirements.txt"
if errorlevel 1 (
  echo [ERRO] Falha ao instalar requirements.txt.
  popd
  pause
  exit /b 1
)

echo.
echo =============================================
echo DEPENDENCIAS INSTALADAS COM SUCESSO
echo Python: %PYTHON_EXE%
echo =============================================
popd
pause
exit /b 0
