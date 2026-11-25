param([switch]$Quiet)
$ErrorActionPreference='SilentlyContinue'
function Valid([string]$exe) {
  if (-not $exe -or $exe -like '*\WindowsApps\*' -or -not (Test-Path -LiteralPath $exe -PathType Leaf)){return $null}
  try {
    $version=& $exe -c "import sys;print(sys.version_info.major,sys.version_info.minor);print(sys.executable)" 2>$null
    if ($LASTEXITCODE -eq 0 -and $version.Count -ge 2) {
      $v=($version[0] -split ' ')
      if ([int]$v[0] -eq 3 -and [int]$v[1] -ge 10){return $version[1].Trim()}
    }
  }catch{}
  return $null
}
$base=Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile=Join-Path $base '.env'
if(Test-Path $envFile){
  $line=Get-Content $envFile|Where-Object{$_ -match '^\s*PYTHON_EXE\s*='}|Select-Object -First 1
  if($line){$r=Valid (($line -split '=',2)[1].Trim().Trim('"'));if($r){Write-Output $r;exit 0}}
}
$py=Get-Command py.exe -ErrorAction SilentlyContinue
if($py){
  try{$path=& $py.Source -3.13 -c "import sys;print(sys.executable)" 2>$null
    if($LASTEXITCODE -eq 0){$r=Valid ($path|Select-Object -First 1);if($r){Write-Output $r;exit 0}}
  }catch{}
}
foreach($name in @('python.exe','python3.exe')){
  $cmd=Get-Command $name -ErrorAction SilentlyContinue
  if($cmd){$r=Valid $cmd.Source;if($r){Write-Output $r;exit 0}}
}
$paths=@(
  (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python313\python.exe'),
  'C:\Program Files\Python313\python.exe',
  'C:\Python313\python.exe'
)
foreach($p in $paths){$r=Valid $p;if($r){Write-Output $r;exit 0}}
if(-not $Quiet){Write-Error 'Python >= 3.10 nao encontrado.'}
exit 1
