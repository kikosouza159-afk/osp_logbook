@echo off
setlocal EnableExtensions
title OSP Locator - Instalar Python e Dependencias
pushd "%~dp0" >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Pasta do projeto inacessivel.
  pause
  exit /b 1
)

rem Instalador corporativo fica na rede. NAO fazer commit do .exe no GitHub.
set "INSTALLER=\\10.15.5.30\Variados\Gerber\ETL\Cockipt\runtime\installer\python-3.13.15-amd64.exe"
set "WHEELHOUSE=\\10.15.5.30\Variados\Gerber\ETL\Cockipt\runtime\installer\wheels"

call :LocatePython
if not defined PYTHON_EXE (
  echo [INFO] Instalando Python 3.13.15 da pasta compartilhada...
  if not exist "%INSTALLER%" (
    echo [ERRO] Instalador inacessivel: %INSTALLER%
    echo Verifique permissao de leitura na pasta compartilhada e VPN/rede.
    goto :error
  )
  start /wait "" "%INSTALLER%" /quiet InstallAllUsers=0 PrependPath=1 Include_pip=1 Include_test=0
  if errorlevel 1 (
    echo [ERRO] O instalador do Python falhou.
    goto :error
  )
  call :LocatePython
)
if not defined PYTHON_EXE (
  echo [ERRO] Nao localizei o executavel real do Python.
  goto :error
)
echo [OK] Python: %PYTHON_EXE%
"%PYTHON_EXE%" -m pip --version >nul 2>&1
if errorlevel 1 "%PYTHON_EXE%" -m ensurepip --upgrade
if errorlevel 1 goto :error

if exist "%WHEELHOUSE%\*.whl" (
  echo [INFO] Instalando pacotes de wheels da rede, sem Internet.
  "%PYTHON_EXE%" -m pip install --no-index --find-links="%WHEELHOUSE%" -r requirements.txt
) else (
  echo [INFO] Nenhuma wheelhouse encontrada. Pip precisara de Internet ou proxy.
  "%PYTHON_EXE%" -m pip install -r requirements.txt
)
if errorlevel 1 goto :error
echo.
echo [OK] Python e bibliotecas instalados.
echo Proximo passo: configurar .env e servidores.json; executar EXECUTAR_ETL.bat
popd
pause
exit /b 0

:LocatePython
set "PYTHON_EXE="
for /f "usebackq delims=" %%I in (`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0localizar_python.ps1" -Quiet`) do (
  if not defined PYTHON_EXE set "PYTHON_EXE=%%I"
)
exit /b 0

:error
echo [ERRO] Instalacao interrompida. Nenhuma tabela do banco foi alterada.
popd
pause
exit /b 1
