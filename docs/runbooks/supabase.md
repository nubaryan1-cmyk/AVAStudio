# Runbook — Supabase cloud (ЭТАП 16)

Облачная БД (миграция с локального Postgres из ЭТАП 3). Секреты — в Doppler (ЭТАП 15).

## 1. Проекты (TASK 16.1)
Создать три проекта на https://supabase.com:
- `avastudio-dev`, `avastudio-staging`, `avastudio-prod` (prod — **Pro tier с PITR**).
- Регион — ближе к worker'ам (согласовать с ЭТАП 18).

Расширения (Database → Extensions): включить `pgcrypto`, `uuid-ossp` (как локально).

Connection strings (Settings → Database) → в Doppler соответствующего окружения:
- `DATABASE_URL` — **pooled** (Supavisor, transaction mode, порт 6543) — для приложения.
- `DATABASE_URL_DIRECT` — **direct** (порт 5432) — только для миграций/drizzle.

## 2. Миграции (TASK 16.2)
Применять `drizzle-kit migrate` по **direct** строке (миграции требуют прямого соединения):
```
DATABASE_URL="$DATABASE_URL_DIRECT" doppler run --config dev -- pnpm db:migrate
```
Порядок: dev → проверить → staging → prod. Миграция `0002_rls_supabase` переключает
RLS-хелпер `app_current_user_id()` на `auth.uid()` (с фолбэком на локальную эмуляцию).
Seed применять **только к dev** (`pnpm db:seed`), НИКОГДА к prod.

## 3. Auth + Storage (TASK 16.3)
- Authentication → Providers: включить Email (с подтверждением), Google, Apple. Прописать
  Redirect URLs (для каждого окружения свой домен).
- Storage → создать бакеты: `user-uploads` (private), `generated-media` (private),
  `public-assets` (public). Политики — см. конфиг бакетов.
- Ключи в Doppler: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## 4. Backup + pooling (TASK 16.4)
- PITR включён на prod (Pro). Дополнительно — ежедневный `pg_dump` в R2/S3 (worker-процессор).
- Приложение — на pooled connection; миграции — на direct.
- Тест восстановления — на staging (см. restore-from-backup.md).

## Безопасность
- `SERVICE_ROLE_KEY` — только сервер/worker, НИКОГДА не на фронт.
- Доступ к prod-проекту — минимальный круг.
