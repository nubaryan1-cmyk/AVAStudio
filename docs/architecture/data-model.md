# Модель данных AVAStudio (v1)

Источник истины — Drizzle-схема `packages/db/src/schema/index.ts`. Здесь — обзор.
RLS-политики добавляются в TASK 3.4, миграции — в TASK 3.3.

## Сущности (19 таблиц)

### Пользователи и организации

- **users** — пользователи (email уникален).
- **organizations** — рабочие пространства (slug уникален, created_by → users).
- **org_members** — членство (composite PK org+user, роль: owner/admin/editor/viewer).
- **organization_data_keys** — обёрнутые DEK для envelope-шифрования (ADR-009): wrapped_dek (jsonb EncryptedBlob), key_version.

### Биллинг (провайдеро-независимо)

- **subscriptions** — подписки (provider, external_id, plan_id, tier b2c/b2b, status).
- **usage_events** — события использования (metric, amount) для лимитов.
- **payment_events** — нормализованные платёжные события, уникальность (provider, external_event_id) для идемпотентности.

### Соцаккаунты и инфраструктура

- **social_accounts** — аккаунты (platform, username, status, **credentials_encrypted jsonb EncryptedBlob**, health_score, warmup_stage).
- **proxies** — прокси (provider, host/port, credentials_encrypted, sticky_session, success/fail счётчики).
- **phones** — облачные телефоны (provider, device_id; уникальность provider+device).
- **account_phone_bindings** — привязка аккаунт↔телефон.

### Медиа

- **media_assets** — исходники (type, storage_path, probe_data jsonb, tags[]).
- **content_jobs** — задачи обработки (source_asset, preset jsonb, status).
- **media_variants** — результаты рендера под платформы.
- **render_metrics** — метрики рендера (длительности, encoder, exit_code).

### Постинг

- **posting_schedules** — расписания (rules jsonb).
- **posting_jobs** — задачи публикации (account, asset, scheduled_at, status).
- **post_results** — результаты (platform_post_id, success, error).

### Аудит

- **audit_log** — журнал действий (org, user, action, entity, metadata, ip).

## Конвенции

- Все id — `uuid` с `defaultRandom()` (gen_random_uuid).
- Временные метки — `timestamptz` с `defaultNow()` (created_at/updated_at).
- Внешние ключи: дочерние записи org — `onDelete: cascade`; мягкие связи — `set null`.
- Чувствительные данные — только `*_encrypted jsonb` (тип `EncryptedBlob` из @avastudio/shared, ADR-009). Шифрование — TASK 3.5.

## Индексы (основные)

- `org_id` на всех мультитенантных таблицах.
- Составные: usage(org, created_at/metric), posting_jobs(account, scheduled_at), audit(org, created_at).
- Статусы: content_jobs.status, posting_jobs.status, posting_jobs.scheduled_at.
- Уникальные: users.email, organizations.slug, social_accounts(org, platform, username), phones(provider, device_id), payment_events(provider, external_event_id), subscriptions.external_id.
