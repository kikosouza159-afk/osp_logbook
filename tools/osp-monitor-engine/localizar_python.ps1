param(
  [switch]$Quiet
)

$ErrorActionPreference = "SilentlyContinue"
$BaseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile = Join-Path $BaseDir ".env"

function Test-PythonExecutable {
  param([string]$Candidate)

  if (-not $Candidate) { return $null }

  $Candidate = $Candidate.Trim('"').Trim()

  if ($Candidate -match "\\WindowsApps\\") {
    return $null
  }

  if (-not (Test-Path -LiteralPath $Candidate -PathType Leaf)) {
    return $null
  }

  try {
    $actual = & $Candidate -c "import sys; print(sys.executable)" 2>$null
    if ($LASTEXITCODE -eq 0 -and $actual) {
      $resolved = ($actual | Select-Object -First 1).Trim()
      if ($resolved -and (Test-Path -LiteralPath $resolved -PathType Leaf)) {
        return $resolved
      }
    }
  } catch {}

  return $null
}

# 1. Override opcional no .env:
# PYTHON_EXE=C:\caminho\python.exe
if (Test-Path -LiteralPath $EnvFile) {
  $line = Get-Content -LiteralPath $EnvFile |
    Where-Object { $_ -match '^\s*PYTHON_EXE\s*=' } |
    Select-Object -First 1

  if ($line) {
    $override = ($line -split '=', 2)[1].Trim().Trim('"')
    $found = Test-PythonExecutable $override
    if ($found) {
      Write-Output $found
      exit 0
    }
  }
}

# 2. Comandos registrados no PATH, ignorando WindowsApps.
foreach ($name in @("python.exe", "python3.exe")) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) {
    $found = Test-PythonExecutable $cmd.Source
    if ($found) {
      Write-Output $found
      exit 0
    }
  }
}

# 3. Python Launcher do Windows. Descobre o executavel real.
$py = Get-Command "py.exe" -ErrorAction SilentlyContinue
if ($py -and $py.Source -and $py.Source -notmatch "\\WindowsApps\\") {
  try {
    $actual = & $py.Source -3 -c "import sys; print(sys.executable)" 2>$null
    if ($LASTEXITCODE -eq 0 -and $actual) {
      $candidate = ($actual | Select-Object -First 1).Trim()
      $found = Test-PythonExecutable $candidate
      if ($found) {
        Write-Output $found
        exit 0
      }
    }
  } catch {}
}

# 4. Registro do Windows.
$registryRoots = @(
  "HKCU:\Software\Python\PythonCore",
  "HKLM:\Software\Python\PythonCore",
  "HKLM:\Software\WOW6432Node\Python\PythonCore"
)

foreach ($root in $registryRoots) {
  if (-not (Test-Path $root)) { continue }

  foreach ($versionKey in Get-ChildItem $root -ErrorAction SilentlyContinue) {
    $installPath = Join-Path $versionKey.PSPath "InstallPath"

    $exePath = (Get-ItemProperty -Path $installPath -Name ExecutablePath -ErrorAction SilentlyContinue).ExecutablePath
    $found = Test-PythonExecutable $exePath
    if ($found) {
      Write-Output $found
      exit 0
    }

    $base = (Get-ItemProperty -Path $installPath -ErrorAction SilentlyContinue)."(default)"
    if ($base) {
      $found = Test-PythonExecutable (Join-Path $base "python.exe")
      if ($found) {
        Write-Output $found
        exit 0
      }
    }
  }
}

# 5. Pastas comuns.
$patterns = @(
  (Join-Path $env:LOCALAPPDATA "Programs\Python\Python*\python.exe"),
  "C:\Python*\python.exe",
  "C:\Program Files\Python*\python.exe",
  "C:\Program Files (x86)\Python*\python.exe"
)

foreach ($pattern in $patterns) {
  foreach ($candidate in Get-ChildItem -Path $pattern -File -ErrorAction SilentlyContinue) {
    $found = Test-PythonExecutable $candidate.FullName
    if ($found) {
      Write-Output $found
      exit 0
    }
  }
}

if (-not $Quiet) {
  Write-Error "Python real nao encontrado. O atalho da Microsoft Store nao e aceito. Configure PYTHON_EXE no .env com o caminho completo do python.exe."
}
exit 1
