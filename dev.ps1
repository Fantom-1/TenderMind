# TenderMind AI — one-shot dev runner.
# Opens 3 windows: uvicorn, celery worker, next dev.

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$EnvPath = "$Root\envs\tendermind-be"
$Python = "$EnvPath\python.exe"

if (-not (Test-Path $Python)) {
    Write-Host "Backend env not found. Run .\setup.ps1 first." -ForegroundColor Red
    exit 1
}

# Quick service checks; warn but proceed.
$svc = @(
    @{p=5432;  n="Postgres"},
    @{p=27017; n="MongoDB"},
    @{p=6379;  n="Redis"},
    @{p=11434; n="Ollama"}
)
foreach ($s in $svc) {
    $up = Test-NetConnection localhost -Port $s.p -InformationLevel Quiet -WarningAction SilentlyContinue
    if (-not $up) {
        Write-Host "WARN: $($s.n) on :$($s.p) is not reachable. Start it before using the app." -ForegroundColor Yellow
    }
}

Write-Host "Starting backend, worker, and frontend..." -ForegroundColor Cyan

# uvicorn
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "cd '$Root\backend'; & '$Python' -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
)

# celery worker
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "cd '$Root\backend'; & '$Python' -m celery -A app.tasks.celery_app worker --loglevel=info --pool=solo"
)

# next dev
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "cd '$Root\frontend'; npm run dev"
)

Write-Host "`nBackend:  http://localhost:8000"
Write-Host "Frontend: http://localhost:3000"
Write-Host "`nLogin: uploader@tendermind.local / uploader-pass`n"
