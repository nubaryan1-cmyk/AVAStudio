@echo off
chcp 65001 >nul
title AVAStudio - запуск сайта
cd /d "%~dp0"

echo ============================================
echo   AVAStudio - локальный запуск
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ОШИБКА] Node.js не найден. Установи Node 20 с https://nodejs.org
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node -v') do set NODEVER=%%v
echo Node.js: %NODEVER%
echo.

if not exist "node_modules" (
  echo Первый запуск: устанавливаю зависимости. Это займёт несколько минут...
  echo.
  call npx --yes pnpm@9.15.9 install
  if errorlevel 1 (
    echo.
    echo [ОШИБКА] Установка зависимостей не удалась. Скрин ошибки пришли в чат.
    pause
    exit /b 1
  )
  echo.
  echo Зависимости установлены.
  echo.
)

echo Запускаю сайт... Браузер откроется автоматически через несколько секунд.
echo Чтобы остановить сайт - закрой это окно или нажми Ctrl+C.
echo.

start "" /min cmd /c "timeout /t 8 >nul & start http://localhost:3000"

call npx --yes pnpm@9.15.9 --filter @avastudio/web dev

echo.
echo Сервер остановлен.
pause
