# AUTOMATED VERCEL DEPLOY SCRIPT
Write-Host ">>> STARTING VERCEL DEPLOY..." -ForegroundColor Cyan

# 1. Check if Vercel CLI is installed
try {
    $v = npx vercel --version
    Write-Host "   [OK] Vercel CLI detected: $v" -ForegroundColor Gray
} catch {
    Write-Error "CRITICAL: Vercel CLI not found. Run 'npm i -g vercel' first."
    exit 1
}

# 2. Deploy to Preview
Write-Host "`n>>> DEPLOYING TO PREVIEW..." -ForegroundColor Yellow
# --yes пропускает подтверждения, --prod деплоит в продакшн
# Вы можете убрать --prod, чтобы сначала проверить превью
cmd /c "npx vercel --yes"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[SUCCESS] DEPLOY COMPLETE!" -ForegroundColor Green
    Write-Host "Check your Vercel Dashboard for the URL." -ForegroundColor Cyan
} else {
    Write-Host "`n[FAIL] Deploy failed. You may need to run 'npx vercel login'." -ForegroundColor Red
}