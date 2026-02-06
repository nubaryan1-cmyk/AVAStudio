$ErrorActionPreference = "Continue"
$root = os.path.dirname(os.path.abspath(__file__))
$gatewayDir = "$root\AvaStudio\AvaStudio.Gateway"
$workerDir = "$root\runpod_probe_worker"
$loadTestDir = "$root\_LOAD_TEST"

# Длительность в часах
$HOURS = 6

Write-Host ">>> ЗАПУСК 6-ЧАСОВОГО СТРЕСС-ТЕСТА (SOAK TEST)..." -ForegroundColor Magenta
Write-Host "ВНИМАНИЕ: Это создаст огромную нагрузку. Нажмите Ctrl+C для отмены." -ForegroundColor Yellow

# 0. Cleanup
Get-Process -Name "dotnet", "node", "python" -ErrorAction SilentlyContinue | Stop-Process -Force

# 1. Start Gateway (Backend)
Write-Host "[1/3] Starting Gateway..." -ForegroundColor Cyan
$env:GATEWAY_SECRET = $env:GATEWAY_SECRET
$gatewayArg = "run --project `"$gatewayDir\AvaStudio.Gateway.csproj`" --urls http://localhost:5005"
$gatewayProc = Start-Process "dotnet" -ArgumentList $gatewayArg -PassThru -NoNewWindow

# 2. Start Worker (Consumer)
Write-Host "[2/3] Starting Worker (Mock Mode)..." -ForegroundColor Cyan
$env:AVA_ENV = "STAGING"
$env:AVA_MOCK_MODE = "1" # Важно! Чтобы не платить за реальные GPU
$env:GPU_CONCURRENCY_MODE = "QUEUE"
$workerProc = Start-Process "python" -ArgumentList "$workerDir\dist_worker.py" -PassThru -NoNewWindow

Start-Sleep -Seconds 10

# 3. Start Load Generator (Producer)
Write-Host "[3/3] Starting Load Generator..." -ForegroundColor Cyan
# Передаем длительность в скрипт (в данном случае она захардкожена в py, но можно менять файл)
# Запускаем в текущем окне, чтобы видеть прогресс
python "$loadTestDir\stress_generator.py"

# --- CLEANUP AFTER FINISH ---
Write-Host "`n[FINISH] Stopping services..." -ForegroundColor Yellow
Stop-Process -Id $gatewayProc.Id -Force -ErrorAction SilentlyContinue
Stop-Process -Id $workerProc.Id -Force -ErrorAction SilentlyContinue

Write-Host "Отчет сохранен в: $loadTestDir" -ForegroundColor Green

