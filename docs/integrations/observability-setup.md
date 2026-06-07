# Observability — подключение провайдеров (ЭТАП 24)

Логика провайдеро-независима в `@avastudio/shared/observability` (error reporter, log-context,
analytics с consent, SLO burn-rate) и `@avastudio/shared/logger` (Pino+redact). Ниже — wiring
конкретных вендоров (ставится при деплое; ключи — в Doppler).

## 24.1 Sentry (web + worker)
1. `pnpm add @sentry/nextjs` (web), `@sentry/node` (worker).
2. web: `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` с
   `dsn: env.SENTRY_DSN`. В `beforeSend` прогонять данные через `redact` (ЭТАП 2.4).
3. Контекст: `Sentry.setUser({ id: userId })`, теги `org_id`, `trace_id` (из OTEL, ЭТАП 8).
   В приложении использовать `reportError(reporter, err, ctx)` — он уже scrub'ит секреты.
4. Source maps: `withSentryConfig` + `SENTRY_AUTH_TOKEN` в CI.
5. Алерты: Sentry → Slack/Telegram на новые ошибки и spike.
Ключи: `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`.

## 24.2 Pino → Axiom
1. `pnpm add @axiomhq/pino`.
2. `createLogger` в проде получает транспорт из `axiomTransportFromEnv({ AXIOM_DATASET, AXIOM_TOKEN })`.
3. Биндить контекст: `bindLogContext(logger, { traceId, requestId, userId, orgId })` —
   поиск «логи юзера X за час» и связка с трейсами по `trace_id`.
4. Redaction уже встроен в logger (ЭТАП 2.4) — секреты `[REDACTED]`.
Ключи: `AXIOM_DATASET`, `AXIOM_TOKEN`.

## 24.4 PostHog (analytics + flags + replay)
1. `pnpm add posthog-js` (web).
2. Провайдер инициализируется ТОЛЬКО после cookie-consent. Обернуть в `Analytics`
   (`@avastudio/shared/observability`): `new Analytics({ consent, sink: posthogSink })`.
   Без согласия `track/identify` — no-op (гарантировано тестами).
3. `identify(userId)` после логина. События: signup, onboarding_complete, account_added,
   media_uploaded, render_started/completed, post_scheduled/published, subscription_started.
4. Feature flags ↔ Vercel Edge Config (ЭТАП 17.3) — синхронизация для канареечных релизов.
5. Session replay — только opt-in.
Ключи: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`.

## 24.5 Дашборд + SLO
- Цели и политика — `docs/architecture/slo.md`. Burn-rate — `burnRate()` (тесты в shared).
- Дашборд — Grafana Cloud / Axiom; burn-rate алерты по порогу ≥2×.
