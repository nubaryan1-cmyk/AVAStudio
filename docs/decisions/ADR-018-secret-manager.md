# ADR-018 — Облачный менеджер секретов (Doppler)

**Статус:** принято · **Дата:** 2026-06 · **Этап:** 15.1 (Фаза 2)
**Связано:** ADR-009 (архитектура секретов), ЭТАП 2.2 (env-loader), ЭТАП 2.4 (ротация).

> Примечание по нумерации: в карте задача ссылалась на «ADR-017», но ADR-017
> уже занят (proxy-manager). Данный ADR получает следующий свободный номер — 018.

## Контекст
Фаза 1 хранила секреты в локальном `.env` + типизированный env-loader
(`@avastudio/shared/env`, прямой `process.env` запрещён ESLint). Для деплоя
(Vercel/Fly/Workers) нужен облачный источник истины с разделением окружений
и без секретов в репозитории.

## Решение
Используем **Doppler** как менеджер секретов. Три окружения проекта `avastudio`:
`dev`, `staging`, `prod`. Doppler инжектит значения в `process.env` через
`doppler run`, поэтому **код env-loader не меняется** — он уже читает `process.env`.

## Рассмотренные альтернативы
- **Doppler (выбрано).** Зрелые интеграции с Vercel/Fly/GitHub Actions, branch-конфиги,
  аудит-лог, простой CLI `doppler run`. Минус — внешний платный сервис (есть free tier).
- **Infisical.** Open-source, можно self-host. Минус — менее зрелые интеграции,
  больше операционной нагрузки на нас.
- **Vendor-native (Vercel/Fly secrets).** Просто, но привязка к платформе и нет
  единого источника на все среды (worker + web + CI) — против принципа «без lock-in».

## Изоляция окружений
- `dev` — значения из локального `.env` (кроме ключей шифрования — см. ниже).
- `staging` / `prod` — **новые** ключи, сгенерированные отдельно. Особенно
  `CREDENTIALS_ENCRYPTION_KEY`: prod-ключ НИКОГДА не совпадает с dev (ЭТАП 15.2).
- Доступ к `prod` — минимальный круг лиц; service-token только для CI/деплоя.

## Структура секретов (совпадает с `serverEnvSchema`, ЭТАП 2.2)
Обязательные (ядро): `NODE_ENV`, `DATABASE_URL`, `REDIS_URL`,
`CREDENTIALS_ENCRYPTION_KEY`, `AUTH_JWT_SECRET`.
Ротация: `CREDENTIALS_ENCRYPTION_KEY_PREV` (только во время ротации, ЭТАП 2.4).
Опциональные интеграции (Фаза 2): `PAYMENT_PROVIDER`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `CRYPTO_PROVIDER_API_KEY`, `CRYPTO_WEBHOOK_SECRET`,
`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `REPLICATE_API_TOKEN`, `DUOPLUS_API_KEY`,
`PROXY_PROVIDER_API_KEY`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_TRACES_ENABLED`,
`FFMPEG_PATH`, `FFPROBE_PATH`, `WORKER_CONCURRENCY`.
Клиентские: `NEXT_PUBLIC_APP_URL` (только `NEXT_PUBLIC_*` уходят на фронт).

## Последствия
- Локальный запуск: `doppler run -- pnpm dev` (или офлайн через `.env`).
- CI/деплой используют Doppler service-token (read-only на нужное окружение).
- `.env` остаётся только для офлайн-разработки и НЕ коммитится.
- env-loader продолжает валидировать любой источник — Doppler-инжект проверяется
  той же zod-схемой при старте.
