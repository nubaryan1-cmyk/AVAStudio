# Runbook — Оптимизация БД + read replicas (ЭТАП 25.3)

## Индексы (миграция 0003_perf_indexes)
Покрывают топ-паттерны: листинги по org+время, статусы джобов, аудит по юзеру/действию,
usage-агрегаты, медиа по типу, post_results по джобу. 11 индексов, применены forward-only.

## EXPLAIN ANALYZE (prod)
1. Включить `pg_stat_statements`, собрать топ-20 по total_time.
2. Для каждого — `EXPLAIN (ANALYZE, BUFFERS)`; искать Seq Scan на больших таблицах → индекс.
3. Замер до/после — приложить к закрытию.

## CONCURRENTLY на проде
На больших таблицах создавать индексы `CREATE INDEX CONCURRENTLY` ОТДЕЛЬНО (вне транзакции
миграции), чтобы не лочить таблицу. Миграция 0003 — для свежих/staging; для prod — runbook-скрипт.

## N+1
Репозитории используют join/IN-выборки (не цикл запросов). Для дашбордов — батч-загрузка.

## Партиционирование (большие таблицы)
`posting_jobs`, `audit_log`, `usage_events` — кандидаты на партиционирование по времени
(RANGE по created_at, помесячно) при росте. Старые партиции — отцепление/архив.

## Read replicas
- `DATABASE_REPLICA_URL` в Doppler (Supabase read replica).
- Роутинг — `pickDbRole()` (@avastudio/db): запись/read-after-write → primary,
  аналитика/дашборды → replica. Без реплики — всё на primary.
