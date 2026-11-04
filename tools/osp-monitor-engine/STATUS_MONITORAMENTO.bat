@echo off
setlocal
cd /d "%~dp0"
title OSP Monitor Engine - Status

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$name='OSP Monitor Engine';" ^
  "Write-Host '=============================================' -ForegroundColor Cyan;" ^
  "Write-Host '        OSP MONITOR ENGINE - STATUS' -ForegroundColor Cyan;" ^
  "Write-Host '=============================================' -ForegroundColor Cyan;" ^
  "$task=Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue;" ^
  "if($task){$info=Get-ScheduledTaskInfo -TaskName $name; Write-Host ('Tarefa        : ' + $task.State); Write-Host ('Ultima        : ' + $info.LastRunTime); Write-Host ('Proxima       : ' + $info.NextRunTime); Write-Host ('Resultado     : ' + $info.LastTaskResult)}else{Write-Host 'Tarefa        : NAO CRIADA' -ForegroundColor Yellow};" ^
  "$status=Join-Path '%~dp0' '.status.json';" ^
  "if(Test-Path $status){$s=Get-Content $status -Raw | ConvertFrom-Json; Write-Host '---------------------------------------------'; Write-Host ('ETL           : ' + $s.status); Write-Host ('Data fonte    : ' + $s.source_date); Write-Host ('Tabulacao     : ' + $s.tabulation_rows); Write-Host ('Retorno PBX   : ' + $s.pbx_rows); Write-Host ('Atualizado UTC: ' + $s.updated_at); if($s.error){Write-Host ('Erro          : ' + $s.error) -ForegroundColor Red}};" ^
  "Write-Host '=============================================' -ForegroundColor Cyan"

echo.
pause
