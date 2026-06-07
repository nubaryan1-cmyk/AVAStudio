@echo off
chcp 65001 >nul
title AVAStudio - публичный туннель (Cloudflare)
cd /d "%~dp0"

echo ============================================
echo   AVAStudio - доступ из интернета (туннель)
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ОШИБКА] Node.js не найден. Установи Node 20 с https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Первый запуск: устанавливаю зависимости...
  call npx --yes pnpm@9.15.9 install
  if errorlevel 1 (
    echo [ОШИБКА] Установка зависимостей не удалась.
    pause
    exit /b 1
  )
)

REM ---- Проверяем/скачиваем cloudflared ----
set "CF=cloudflared.exe"
if not exist "%CF%" (
  where cloudflared >nul 2>nul
  if not errorlevel 1 (
    set "CF=cloudflared"
  ) else (
    echo cloudflared не найден. Скачиваю...
    powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe' -UseBasicParsing } catch { Write-Host $_; exit 1 }"
    if errorlevel 1 (
      echo.
      echo [ОШИБКА] Не удалось скачать cloudflared.
      echo Попробуй вручную: winget install --id Cloudflare.cloudflared
      pause
      exit /b 1
    )
    echo cloudflared скачан.
  )
)

REM ---- Запускаем Next.js в отдельном окне ----
echo Запускаю сайт на http://localhost:3000 (отдельное окно)...
start "AVAStudio web" cmd /c "npx --yes pnpm@9.15.9 --filter @avastudio/web dev -- -p 3000"

echo Жду запуск сайта (20 сек)...
timeout /t 20 >nul

echo.
echo ============================================
echo   ПУБЛИЧНЫЙ АДРЕС появится ниже в строке
echo   вида:  https://XXXX-XXXX.trycloudflare.com
echo   Открой её на телефоне (мобильный интернет - ок).
echo ============================================
echo.

"%CF%" tunnel --url http://localhost:3000

echo.
echo Туннель остановлен. Закрой также окно "AVAStudio web".
pause
