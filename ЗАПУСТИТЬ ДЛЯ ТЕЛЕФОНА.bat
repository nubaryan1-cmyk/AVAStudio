@echo off
chcp 65001 >nul
title AVAStudio - запуск для телефона
cd /d "%~dp0"

echo ============================================
echo   AVAStudio - доступ с телефона (LAN)
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

echo.
echo Твой локальный IP-адрес (открой на телефоне):
echo.
setlocal enabledelayedexpansion
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  set ip=%%a
  set ip=!ip: =!
  echo     http://!ip!:3000
)
endlocal
echo.
echo На телефоне должен быть тот же Wi-Fi. Если Windows
echo спросит про брандмауэр - разреши доступ (Private networks).
echo Чтобы остановить - закрой это окно или нажми Ctrl+C.
echo.

call npx --yes pnpm@9.15.9 --filter @avastudio/web dev -- -H 0.0.0.0 -p 3000

echo.
echo Сервер остановлен.
pause
