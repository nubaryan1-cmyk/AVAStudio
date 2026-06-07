-- Индексы под топ-запросы (TASK 25.3). Forward-only. Покрывают самые частые паттерны:
-- листинги по org + сортировка по времени, статусы джобов, аудит по юзеру/действию,
-- usage-агрегаты. CONCURRENTLY НЕ используем (выполняется в одной миграционной транзакции;
-- на больших prod-таблицах применять отдельно concurrently — см. runbook).

-- posting_jobs: лента по org + по расписанию + по статусу (scheduler/дашборд).
CREATE INDEX IF NOT EXISTS idx_posting_jobs_org_scheduled ON posting_jobs (org_id, scheduled_at DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_posting_jobs_org_status ON posting_jobs (org_id, status);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_posting_jobs_account ON posting_jobs (account_id);--> statement-breakpoint

-- audit_log: фильтры UI по org+времени, по юзеру, по действию (TASK 23.4).
CREATE INDEX IF NOT EXISTS idx_audit_org_created ON audit_log (org_id, created_at DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_audit_org_user ON audit_log (org_id, user_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_audit_org_action ON audit_log (org_id, action);--> statement-breakpoint

-- usage_events: агрегаты по org+метрике+времени (биллинг/лимиты/unit-economics).
CREATE INDEX IF NOT EXISTS idx_usage_org_metric_created ON usage_events (org_id, metric, created_at DESC);--> statement-breakpoint

-- social_accounts: листинг по org+платформе+статусу (аккаунты/anti-ban).
CREATE INDEX IF NOT EXISTS idx_social_org_platform ON social_accounts (org_id, platform);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_social_org_status ON social_accounts (org_id, status);--> statement-breakpoint

-- media_assets: медиатека по org+типу+времени.
CREATE INDEX IF NOT EXISTS idx_media_org_type ON media_assets (org_id, type);--> statement-breakpoint

-- post_results: выборка по posting_job (детали постинга).
CREATE INDEX IF NOT EXISTS idx_post_results_job ON post_results (posting_job_id);
