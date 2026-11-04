param(
  [string]$TaskName = "OSP Monitor Engine"
)

$ErrorActionPreference = "Stop"
$BaseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ScriptPath = Join-Path $BaseDir "osp_monitor.py"

if (-not (Test-Path $ScriptPath)) {
  throw "Arquivo osp_monitor.py nao encontrado em $BaseDir"
}

$Python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $Python) {
  $Python = (Get-Command py -ErrorAction SilentlyContinue).Source
}
if (-not $Python) {
  throw "Python nao encontrado no PATH da VM."
}

if ($Python -like "*py.exe") {
  $Arguments = "-3 `"$ScriptPath`""
} else {
  $Arguments = "`"$ScriptPath`""
}

$Now = Get-Date
$FirstScheduledRun = $Now.AddMinutes(15)
$EndOfDay = Get-Date -Hour 23 -Minute 59 -Second 0
$Duration = $EndOfDay - $FirstScheduledRun
if ($Duration.TotalMinutes -lt 15) {
  $Duration = New-TimeSpan -Minutes 15
}

$Action = New-ScheduledTaskAction -Execute $Python -Argument $Arguments -WorkingDirectory $BaseDir
$Trigger = New-ScheduledTaskTrigger -Once -At $FirstScheduledRun -RepetitionInterval (New-TimeSpan -Minutes 15) -RepetitionDuration $Duration
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 12)
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

$Existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($Existing) {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Description "Sincroniza o monitor OSP com Neon a cada 15 minutos." | Out-Null

Start-ScheduledTask -TaskName $TaskName
$Info = Get-ScheduledTaskInfo -TaskName $TaskName

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "        OSP MONITOR ENGINE ATIVO" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Tarefa        : $TaskName"
Write-Host "Python        : $Python"
Write-Host "Pasta         : $BaseDir"
Write-Host "Intervalo     : 15 minutos"
Write-Host "Primeira carga: iniciada agora"
Write-Host "Proxima       : $($Info.NextRunTime)"
Write-Host "Fim do ciclo  : 23:59"
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pode desconectar o RDP. Evite LOGOFF/Sair durante o expediente." -ForegroundColor Yellow
