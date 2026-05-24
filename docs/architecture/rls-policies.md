# RLS-политики AVAStudio

Реализация — миграция `packages/db/migrations/0001_rls.sql`. Тесты — `packages/db/src/rls.test.ts`.

## Модель

- Идентичность пользователя в SQL: `app_current_user_id()` = `current_setting('app.current_user_id')`.
  В Фазе 2 (Supabase) заменяется на `auth.uid()`.
- Роли: `avastudio_authenticated` (RLS применяется) и `avastudio_service` (`BYPASSRLS` — воркеры).
- Приложение для пользовательских запросов работает под `authenticated` + выставляет `app.current_user_id`.
  Воркеры/сервис — под service-role (обходят RLS).

## Helper-функции (SECURITY DEFINER, без рекурсии RLS)

- `app_is_org_member(org)` — пользователь состоит в организации.
- `app_can_access_account(account_id)` / `app_can_access_posting_job(job_id)` — доступ по join к org.

## Покрытие (RLS включён на 100% — 19 таблиц)

| Таблица                                                                                                                                                                                    | Политика для authenticated                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| users                                                                                                                                                                                      | `id = app_current_user_id()`                                                   |
| organizations                                                                                                                                                                              | `app_is_org_member(id)`                                                        |
| org_members, organization_data_keys, subscriptions, usage_events, social_accounts, proxies, phones, media_assets, content_jobs, media_variants, posting_schedules, posting_jobs, audit_log | `app_is_org_member(org_id)`                                                    |
| account_phone_bindings                                                                                                                                                                     | `app_can_access_account(account_id)`                                           |
| post_results                                                                                                                                                                               | `app_can_access_posting_job(posting_job_id)`                                   |
| render_metrics, payment_events                                                                                                                                                             | RLS включён, политик нет → **только service-role** (0 строк для authenticated) |

## Гарантии (проверено тестами)

- RLS включён на 100% таблиц public.
- Анонимный доступ (`app.current_user_id` пуст) → 0 строк.
- Пользователь видит только данные своих организаций.
- service-role видит всё.
