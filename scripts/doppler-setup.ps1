# ============================================================================
# Doppler setup для AVAStudio (TASK 15.1 / 15.2)
# Создаёт проект avastudio + окружения dev/stg/prd, заливает dev-секреты из .env,
# генерирует ОТДЕЛЬНЫЕ ключи шифрования для stg/prd.
#
# ПЕРЕД ЗАПУСКОМ нужно один раз: doppler login   (откроет браузер — это делаешь ты)
# Запуск:  powershell -ExecutionPolicy Bypass -File scripts\doppler-setup.ps1
# ============================================================================
$ErrorActionPreference = "Stop"
$Project = "avastudio"
$Root = Split-Path -Parent $PSScriptRoot   # корень репо (scripts/..)

function Have-Doppler { return [bool](Get-Command doppler -ErrorAction SilentlyContinue) }
function New-Key32 {
  $b = New-Object 'System.Byte[]' 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  return [Convert]::ToBase64String($b)   # 44 символа base64 = 32 байта
}

if (-not (Have-Doppler)) {
  Write-Host "Doppler CLI не найден. Установка: winget install Doppler.doppler  (или scoop install doppler)" -ForegroundColor Yellow
  Write-Host "После установки выполни:  doppler login   затем перезапусти этот скрипт." -ForegroundColor Yellow
  exit 1
}

# Проверка авторизации
doppler me 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Не залогинен в Doppler. Выполни:  doppler login   и перезапусти скрипт." -ForegroundColor Yellow
  exit 1
}

Write-Host "== 1. Проект $Project (dev/stg/prd создаются автоматически) =="
doppler projects create $Project 2>$null
# линкуем папку репо к проекту (создаёт doppler.yaml в корне)
Push-Location $Root
doppler setup --project $Project --config dev --no-interactive 2>$null
Pop-Location

$envPath = Join-Path $Root ".env"
if (Test-Path $envPath) {
  Write-Host "== 2. Заливаю dev-секреты из .env =="
  doppler secrets upload $envPath --project $Project --config dev
} else {
  Write-Host ".env не найден в $Root — пропускаю заливку dev." -ForegroundColor Yellow
}

Write-Host "== 3. Отдельные ключи шифрования для stg/prd (prod != dev) =="
foreach ($cfg in @("stg","prd")) {
  $key = New-Key32
  doppler secrets set "CREDENTIALS_ENCRYPTION_KEY=$key" --project $Project --config $cfg --silent | Out-Null
  $node = if ($cfg -eq "prd") { "production" } else { "staging" }
  doppler secrets set "NODE_ENV=$node" --project $Project --config $cfg --silent | Out-Null
  Write-Host "  [$cfg] CREDENTIALS_ENCRYPTION_KEY сгенерирован, NODE_ENV=$node"
}

Write-Host ""
Write-Host "Готово. Локальный запуск с секретами из Doppler:" -ForegroundColor Green
Write-Host "  doppler run --project $Project --config dev -- pnpm dev" -ForegroundColor Green
Write-Host "Реальные ключи провайдеров (Stripe/AI/прокси и т.д.) дозаполни в дашборде Doppler по окружениям." -ForegroundColor Green
