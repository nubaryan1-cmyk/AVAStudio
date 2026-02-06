Write-Host "=== AVA QA SUITE (STAGE 12: ISOLATED) ===" -ForegroundColor Magenta

$env:AVA_ENV = "STAGING"
$env:AVA_MOCK_MODE = "1"
$dbFile = "ava_production.db"

# Helper to wipe DB
function Wipe-DB {
    if (Test-Path $dbFile) { 
        Remove-Item $dbFile -Force 
        Write-Host "   [CLEANUP] DB Wiped." -ForegroundColor Gray
    }
}

# 1. STRESS
Wipe-DB
Write-Host "`n>>> RUNNING STRESS TEST..." -ForegroundColor Cyan
python _QA/qa_stress.py
if ($LASTEXITCODE -ne 0) { Write-Error "STRESS FAILED"; exit 1 }

# 2. PULL THE PLUG (Fresh DB ensures FIFO works for our job)
Wipe-DB
Write-Host "`n>>> RUNNING PULL-PLUG TEST..." -ForegroundColor Cyan
python _QA/qa_pull_the_plug.py
if ($LASTEXITCODE -ne 0) { Write-Error "PULL PLUG FAILED"; exit 1 }

# 3. SECURITY
Wipe-DB
Write-Host "`n>>> RUNNING SECURITY TEST..." -ForegroundColor Cyan
python _QA/qa_security.py
if ($LASTEXITCODE -ne 0) { Write-Error "SECURITY FAILED"; exit 1 }

Write-Host "`n[SUCCESS] ЭТАП 12 ПРИНЯТ: Система надежна и соответствует Канону." -ForegroundColor Green
