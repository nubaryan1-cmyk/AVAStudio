# DEPLOY CHECKLIST — что делаешь ТЫ (аккаунты, дашборды, оплаты)

Здесь только **ручные шаги** (то, что нельзя сделать кодом): регистрации сервисов,
ключи, домены, оплаты, включение настроек в дашбордах, бизнес-решения.
Код, миграции, драйверы, конфиги и runbooks уже готовы в репозитории — они ждут эти данные.

Идти можно сверху вниз в самом конце. Порядок этапов сохранён.

---

## ФАЗА 1 (локально, ЭТАП 1–14) — почти всё уже сделано кодом
Ручное, что осталось/может понадобиться:

- [ ] Установить локально: Node 20, pnpm (corepack), Docker Desktop (для Postgres/Redis), ffmpeg.
- [ ] (Опционально, заранее) Купить домен `avastudio.com` — пригодится в ЭТАП 17.
- [ ] Запустить локально и посмотреть сайт (`ЗАПУСТИТЬ САЙТ.bat`).

---

## ЭТАП 15 — Секреты (Doppler)
- [ ] Зарегистрироваться на **doppler.com**, установить Doppler CLI, `doppler login`.
- [ ] Создать проект `avastudio` + окружения `dev` / `staging` / `prod`.
- [ ] Залить секреты в `dev` (из локального `.env`).
- [ ] Сгенерировать **отдельные** prod-ключи: `CREDENTIALS_ENCRYPTION_KEY`, `AUTH_JWT_SECRET` (≠ dev).
- [ ] Создать read-only service-token для CI → положить как `DOPPLER_TOKEN` в GitHub.
- [ ] В GitHub-репо включить **Secret scanning** + **Push protection**.

## ЭТАП 16 — Supabase (БД, Auth, Storage)
- [ ] Создать 3 проекта Supabase: `avastudio-dev/staging/prod` (prod — **Pro tier + PITR**).
- [ ] Включить расширения `pgcrypto`, `uuid-ossp` в каждом.
- [ ] Connection strings (pooled `DATABASE_URL` + direct `DATABASE_URL_DIRECT`) → в Doppler.
- [ ] Прогнать миграции (через workflow `migrate.yml`): dev → staging → prod.
- [ ] Authentication → включить Email (с подтверждением), **Google**, **Apple**; прописать Redirect URLs.
- [ ] Создать Storage-бакеты: `user-uploads`, `generated-media` (private), `public-assets` (public) + применить RLS-политики из `docs/integrations/supabase-storage-buckets.md`.
- [ ] Ключи `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` → в Doppler.
- [ ] Завести R2/S3-бакет для бэкапов + lifecycle (daily 30 дней, weekly 1 год).

## ЭТАП 17 — Vercel + домены + Cloudflare
- [ ] **Vercel Pro**, импортировать репо, Root = `apps/web` (build берётся из `vercel.json`).
- [ ] Включить Turbo Remote Cache, Speed Insights, Analytics.
- [ ] Настроить **Doppler↔Vercel** интеграцию (preview→dev, prod→prod). Не вводить env вручную.
- [ ] Создать **Edge Config** store, ключ соединения → `EDGE_CONFIG` в Doppler; завести флаги `maintenanceMode`, `signupEnabled`.
- [ ] Купить/подключить домены в **Cloudflare**, DNS CNAME на Vercel (proxied), SSL = Full (strict).
- [ ] Cloudflare **WAF** (managed rules), rate-limit `/api/*`, Bot Fight Mode, cache-rules для статики.

## ЭТАП 18 — Workers + Redis prod
- [ ] Выбрать хостинг воркеров (Fly.io / Railway / Render — то, где идут FFmpeg+Playwright).
- [ ] Завести аккаунт хостинга, привязать оплату, задеплоить worker-образ.
- [ ] Включить autoscaling по глубине очереди.
- [ ] **Upstash Redis** (prod, с HA) → `REDIS_URL` в Doppler.

## ЭТАП 19 — Платежи (реальные)
- [ ] **Stripe** аккаунт (бизнес-верификация), Live-ключи → Doppler; настроить webhook endpoint + `STRIPE_WEBHOOK_SECRET`.
- [ ] Крипто-провайдер (например NOWPayments/Coinbase Commerce): аккаунт, API-ключ, IPN-секрет → Doppler.
- [ ] Завести тарифы/цены (product/price) в Stripe согласно плану биллинга.
- [ ] Настроить Customer Portal (самообслуживание подписки).
- [ ] Email-провайдер для биллинговых писем (Resend/Postmark): аккаунт + домен отправки (SPF/DKIM).
- [ ] **Бизнес-решение:** окончательные цены тарифов и маржа (в т.ч. реселл телефонов).

## ЭТАП 20 — Google Cloud + OAuth
- [ ] Создать **GCP-проект**, привязать billing, выставить budget-alerts (лимиты трат).
- [ ] Настроить OAuth 2.0 Consent Screen + Credentials (для подключения YouTube-каналов юзеров).
- [ ] (Опц.) Включить Vertex AI / Gemini, если будешь использовать.
- [ ] Ключи/Client ID+Secret → Doppler.

## ЭТАП 21 — AI-провайдеры (реальные)
- [ ] Завести аккаунты и оплату у **2+ провайдеров на каждый тип**:
  - Изображения (напр. OpenAI + Replicate),
  - Видео (напр. Runway + Luma),
  - Аудио/TTS + музыка (напр. ElevenLabs/Cartesia + Suno).
- [ ] API-ключи → Doppler. Выставить лимиты/квоты и биллинг-алерты у провайдеров.

## ЭТАП 22 — Телефоны + прокси (реальные)
- [ ] **DuoPlus**: аккаунт, пополнить баланс, получить `DUOPLUS_API_KEY` (Automation → API) → Doppler.
- [ ] Второй провайдер телефонов (GeeLark/MoreLogin/…): аккаунт + ключ → Doppler.
- [ ] **2 провайдера residential-прокси** (Bright Data + IPRoyal/Smartproxy): аккаунты + ключи → Doppler.
- [ ] Прогнать vendor exit-drill на staging (переключение провайдеров).
- [ ] **Бизнес-решение:** модель аренды телефонов (реселл, маржа, лимиты — см. диалог по DuoPlus).

## ЭТАП 23 — Безопасность
- [ ] **Cloudflare Turnstile** (CAPTCHA): site key + secret → Doppler (для регистрации).
- [ ] Проверить A+ на securityheaders.com после деплоя.
- [ ] Заказать/провести **penetration test** (внешний подрядчик или сервис).

## ЭТАП 24 — Observability
- [ ] **Sentry** (web + worker): проект, DSN → Doppler.
- [ ] **Axiom** (логи): аккаунт, токен → Doppler.
- [ ] **BetterStack** Uptime + публичная status-page.
- [ ] **PostHog** (аналитика + feature flags + session replay): ключ → Doppler; связать с Edge Config.

## ЭТАП 25 — Cost & Performance
- [ ] **Cloudflare R2 + Images** для CDN медиа (бакет + домен).
- [ ] (Опц.) **ClickHouse Cloud** для аналитики: аккаунт + строка подключения → Doppler.
- [ ] Read-replica в Supabase (если потребуется по нагрузке) — тариф.

## ЭТАП 26 — Запуск
- [ ] Собрать waitlist + 50–100 бета-пользователей (closed beta).
- [ ] Прогнать прод-нагрузочный тест (k6) → **go/no-go** решение.
- [ ] Public launch: Product Hunt, Reddit, X (подготовить материалы).
- [ ] Маркетинг-инфраструктура: affiliate/referral, email-секвенции (провайдер email-маркетинга).
- [ ] Финансовый дашборд (MRR/ARR/churn/LTV/CAC) + план найма.

---

### Как это работает
Для каждого пункта код/конфиг уже в репозитории. Ты создаёшь сервис → кладёшь ключ в Doppler
(или включаешь настройку в дашборде) → перезапускаешь деплой. Менять код при этом не нужно —
всё на абстракциях с подменой драйверов.
