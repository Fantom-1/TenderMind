# TenderMind AI — one-shot setup
# Run from D:\AI4Bharat\ in PowerShell.

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$EnvPath = "$Root\envs\tendermind-be"
$Python = "$EnvPath\python.exe"

function Check-Cmd($name, $hint) {
    $found = Get-Command $name -ErrorAction SilentlyContinue
    if (-not $found) {
        Write-Host "[MISSING] $name  ->  $hint" -ForegroundColor Red
        return $false
    }
    Write-Host "[ok]      $name" -ForegroundColor Green
    return $true
}

function Check-Port($host_, $port, $label, $hint) {
    $tcp = Test-NetConnection -ComputerName $host_ -Port $port -WarningAction SilentlyContinue -InformationLevel Quiet
    if ($tcp) { Write-Host "[ok]      $label on ${host_}:${port}" -ForegroundColor Green; return $true }
    Write-Host "[MISSING] $label on ${host_}:${port}  ->  $hint" -ForegroundColor Red
    return $false
}

Write-Host "`n=== TenderMind AI setup ===`n" -ForegroundColor Cyan
Write-Host "Step 1/6  Verifying prerequisites...`n"

$ok = $true
$ok = (Check-Cmd "conda" "install Miniconda from https://docs.conda.io/en/latest/miniconda.html") -and $ok
$ok = (Check-Cmd "node"  "install Node.js 18+ from https://nodejs.org") -and $ok
$ok = (Check-Cmd "npm"   "install Node.js 18+ from https://nodejs.org") -and $ok
$ok = (Check-Port "localhost" 5432  "Postgres" "install PostgreSQL 18 and start the service") -and $ok
$ok = (Check-Port "localhost" 27017 "MongoDB"  "install MongoDB Community and start the service") -and $ok
$ok = (Check-Port "localhost" 6379  "Redis"    "install Memurai (https://www.memurai.com) or run Redis on WSL") -and $ok
$ok = (Check-Port "localhost" 11434 "Ollama"   "install from https://ollama.com and run 'ollama serve'") -and $ok

$tess = "C:\Program Files\Tesseract-OCR\tesseract.exe"
if (Test-Path $tess) {
    Write-Host "[ok]      Tesseract at $tess" -ForegroundColor Green
} else {
    Write-Host "[MISSING] Tesseract  ->  install from https://github.com/UB-Mannheim/tesseract/wiki" -ForegroundColor Red
    $ok = $false
}

if (-not $ok) {
    Write-Host "`nFix the [MISSING] items above, then re-run .\setup.ps1`n" -ForegroundColor Yellow
    exit 1
}

Write-Host "`nStep 2/6  Creating conda env at $EnvPath...`n"
if (Test-Path $Python) {
    Write-Host "  env already exists, skipping creation"
} else {
    conda create --prefix $EnvPath python=3.11 -y
    if ($LASTEXITCODE -ne 0) { throw "conda create failed" }
}

Write-Host "`nStep 3/6  Installing Python dependencies...`n"
& $Python -m pip install --upgrade pip
& $Python -m pip install -r "$Root\backend\requirements.txt"
if ($LASTEXITCODE -ne 0) { throw "pip install failed" }

Write-Host "`nStep 4/6  Running Alembic migrations...`n"
Push-Location "$Root\backend"
try {
    & $Python -m alembic upgrade head
    if ($LASTEXITCODE -ne 0) { throw "alembic upgrade failed" }
} finally { Pop-Location }

Write-Host "`nStep 5/6  Seeding demo users...`n"
Push-Location "$Root\backend"
try {
    & $Python -m scripts.seed_users
    if ($LASTEXITCODE -ne 0) { throw "user seed failed" }
} finally { Pop-Location }

Write-Host "`nStep 6/6  Installing frontend dependencies...`n"
Push-Location "$Root\frontend"
try {
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
} finally { Pop-Location }

Write-Host "`nChecking Ollama model...`n"
$models = & ollama list 2>$null
if ($models -notmatch "gemma3:4b") {
    Write-Host "  pulling gemma3:4b (this can take several minutes)..."
    & ollama pull gemma3:4b
}

Write-Host "`n=== Setup complete ===" -ForegroundColor Green
Write-Host "Next: run  .\dev.ps1`n"
