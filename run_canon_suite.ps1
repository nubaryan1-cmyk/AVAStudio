import os
﻿Write-Host "[CI] Starting Canon Suite..." -ForegroundColor Cyan

# 1. Compile
Write-Host "1. Running Compiler..." -ForegroundColor Gray
python os.getcwd()
if ($LASTEXITCODE -ne 0) { Write-Error "Compiler Failed"; exit 1 }

# 2. Verify Python
Write-Host "2. Verifying Python..." -ForegroundColor Gray
python os.getcwd()
if ($LASTEXITCODE -ne 0) { Write-Error "Python Verification Failed"; exit 1 }

# 3. Verify .NET
Write-Host "3. Verifying .NET..." -ForegroundColor Gray
Set-Location os.getcwd()
# Передаем путь аргументом
dotnet run -- os.getcwd()
if ($LASTEXITCODE -ne 0) { Write-Error ".NET Verification Failed"; exit 1 }

Write-Host "
[SUCCESS] ЭТАП 0 ПРИНЯТ: Источник истины (TXT) синхронизирован с кодом (.NET + Python)." -ForegroundColor Green
exit 0
