@echo off
setlocal
title OSP Monitor Engine - Parar

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$name='OSP Monitor Engine';" ^
  "$task=Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue;" ^
  "if($task){Stop-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue; Unregister-ScheduledTask -TaskName $name -Confirm:$false; Write-Host 'Monitoramento parado e tarefa removida.' -ForegroundColor Yellow}else{Write-Host 'A tarefa nao existe.' -ForegroundColor DarkYellow}"

echo.
pause
