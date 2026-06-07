# Runbook — Vercel деплой (ЭТАП 17)

Фронт (`apps/web`, Next.js 14) деплоится на Vercel из монорепо Turborepo.

## 1. Проект (TASK 17.1)
- Vercel Pro → New Project → импорт репозитория.
- **Root Directory:** `apps/web`.
- Build/Install — берутся из `apps/web/vercel.json`:
  - build: `cd ../.. && pnpm turbo build --filter=@avastudio/web`
  - install: `cd ../.. && pnpm install --frozen-lockfile`
- Регион: `fra1` (ближе к Supabase/worker — согласовать с ЭТАП 18).
- Включить Speed Insights + Web Analytics.

## 2. Turbo Remote Cache
- Vercel → Settings → подключить Turborepo Remote Cache (автоматически для Vercel-проектов),
  либо `TURBO_TOKEN` + `TURBO_TEAM` в env (из Doppler).
- Проверка: повторный билд без изменений берётся из кэша (FULL TURBO).

## 3. Деплой-флоу
- push в `main` → **production** deploy.
- любой PR → **preview** deploy с уникальным URL.
- `github.silent` в vercel.json убирает шумные комментарии бота в PR.

## Env / секреты
Не задавать переменные вручную в UI — они приходят из Doppler-интеграции (TASK 17.3).
