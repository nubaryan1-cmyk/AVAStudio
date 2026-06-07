# Runbook — восстановление БД из бэкапа (TASK 16.4)

Два уровня защиты: **PITR** (Supabase Pro, основной) и **логические дампы** pg_dump
в R2/S3 (процессор `db-backup`, дополнительный). Retention: daily → 30 дней, weekly → 1 год.

## Когда что использовать
- Случайное удаление/порча данных, нужно «отмотать» на момент времени → **PITR**.
- Потеря проекта/региона, нужен перенос → **логический дамп**.

## A. Восстановление через PITR (Supabase)
1. Supabase Dashboard → Database → Backups → Point in Time Recovery.
2. Выбрать таймстамп ДО инцидента.
3. Запустить restore (Supabase создаёт восстановленную БД). Проверить данные.
4. Переключить `DATABASE_URL`/`DATABASE_URL_DIRECT` в Doppler на восстановленный инстанс.

## B. Восстановление из логического дампа (pg_dump → R2/S3)
1. Найти нужный объект: `backups/daily/<YYYY-MM-DD>.sql.gz` (или `weekly/`).
2. Скачать и распаковать:
   ```
   aws s3 cp s3://<bucket>/backups/daily/2026-06-02.sql.gz . # или rclone для R2
   gunzip 2026-06-02.sql.gz
   ```
3. Восстановить в ЧИСТУЮ БД по **direct** строке (не pooled):
   ```
   psql "$DATABASE_URL_DIRECT" < 2026-06-02.sql
   ```
4. Применить недостающие миграции (если дамп старее схемы):
   `doppler run -- sh -c 'DATABASE_URL="$DATABASE_URL_DIRECT" pnpm db:migrate'`
5. Проверить RLS (`SELECT app_current_user_id();` и выборка анонимом → 0 строк).

## Обязательный тест восстановления (квартально)
- Прогонять restore-drill на **staging** из свежего дампа.
- Замерять RTO (время до рабочей БД) и проверять целостность ключевых таблиц.
- Фиксировать дату/результат в журнале операций.

## Connection pooling (PgBouncer/Supavisor)
- Приложение и worker — на **pooled** `DATABASE_URL` (transaction mode, порт 6543).
- Миграции и restore — на **direct** `DATABASE_URL_DIRECT` (порт 5432).
- drizzle.config и migrate.yml уже используют direct.
