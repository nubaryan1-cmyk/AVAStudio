# Runbook — Секреты в Doppler (ЭТАП 15)

Источник истины для секретов — Doppler (ADR-018). Локальный `.env` — только офлайн.

## 0. Предусловия (делает человек, разово)
1. Зарегистрироваться на https://doppler.com, установить CLI:
   - macOS: `brew install dopplerhq/cli/doppler`
   - Windows: `scoop install doppler` (или установщик с сайта)
   - Linux: см. https://docs.doppler.com/docs/install-cli
2. `doppler login` — авторизоваться в браузере.

## 1. Создать проект и окружения
```
doppler projects create avastudio
# В UI или CLI завести конфиги (окружения): dev, staging, prod
```
Структура секретов — строго по `serverEnvSchema` (packages/shared/src/env).
Обязательные: NODE_ENV, DATABASE_URL, REDIS_URL, CREDENTIALS_ENCRYPTION_KEY, AUTH_JWT_SECRET.

## 2. Привязать репозиторий к dev
```
cd <repo>
doppler setup            # выбрать project=avastudio, config=dev
```

## 3. Заполнить секреты
- `dev`: можно перенести значения из локального `.env` (см. ниже).
- `staging`/`prod`: генерировать НОВЫЕ ключи.
  - `openssl rand -base64 32`  → CREDENTIALS_ENCRYPTION_KEY (для prod — отдельный!)
  - `openssl rand -base64 48`  → AUTH_JWT_SECRET
Загрузка из файла (только для dev):
```
doppler secrets upload .env --config dev
```

## 4. Запуск с Doppler
```
doppler run --config dev -- pnpm dev          # web+worker через turbo
doppler run --config dev -- pnpm --filter @avastudio/worker dev
```
Doppler инжектит значения в process.env → env-loader валидирует их zod-схемой.

## 5. CI / деплой
Создать read-only service-token на нужное окружение:
```
doppler configs tokens create ci --config staging --plain
```
Положить токен в секреты GitHub/Vercel/Fly как DOPPLER_TOKEN.
В пайплайне: `doppler run -- <команда>` (токен из env DOPPLER_TOKEN).

## Безопасность
- НИКОГДА не коммитить реальный `.env` (он в .gitignore).
- prod-ключи отличаются от dev/staging.
- Доступ к prod-конфигу — минимальный круг; ротация — см. rotate-encryption-key.md.

## Doppler (Фаза 2 — облачные секреты)

Облачное хранилище секретов: проект `avastudio`, окружения `dev` / `stg` / `prd`.
Env-loader (`packages/shared/src/env`) читает `process.env` — Doppler инжектит туда, код не меняется.

### Первичная настройка
1. Установить CLI: `winget install Doppler.doppler` (или `scoop install doppler`).
2. Один раз авторизоваться: `doppler login` (откроется браузер).
3. Запустить: `powershell -ExecutionPolicy Bypass -File scripts\doppler-setup.ps1`
   — создаст проект и окружения, зальёт dev-секреты из `.env`, сгенерирует
   ОТДЕЛЬНЫЕ `CREDENTIALS_ENCRYPTION_KEY` для stg/prd.

### Запуск с секретами из Doppler
```
doppler run --project avastudio --config dev -- pnpm dev
```

### Правила
- prod-ключ `CREDENTIALS_ENCRYPTION_KEY` ВСЕГДА отдельный от dev (скрипт это делает).
- реальные ключи провайдеров (Stripe/Supabase/AI/прокси/телефоны) заполняются в дашборде
  Doppler по окружениям, в git их нет.
- `.env` остаётся только для оффлайн-разработки.
