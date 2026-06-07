# Runbook — Cloudflare WAF + Bot Management (ЭТАП 17.4)

Защита периметра перед Vercel. Тонкая настройка app-level rate-limit — в ЭТАП 23.

## 1. WAF (Pro)
- Security → WAF → включить **Cloudflare Managed Ruleset** (OWASP core).
- Режим: сначала **Log** (наблюдение 1–2 дня), затем **Block** для критичных правил —
  чтобы не порезать легитимный трафик.

## 2. Rate limiting
- Правило: `http.request.uri.path contains "/api/"` → **100 req/min на IP**, action: Block/Challenge.
- Отдельное мягкое правило на `/api/auth/*` (логин/регистрация) — ниже порог (защита от брутфорса).
- Точные лимиты на бизнес-эндпоинты — в ЭТАП 23.2 (app-level).

## 3. Bot Management
- Security → Bots → **Bot Fight Mode** (или Super Bot Fight Mode на Pro+).
- Challenge (Managed Challenge) для подозрительных ASN/зон и known bad bots.
- Allowlist для легитимных ботов (Vercel, мониторинг, поисковики при необходимости).

## 4. Кэш статики
- Rules → Cache Rules: кэшировать `/_next/static/*`, `/_next/image*`, шрифты/изображения
  (Edge TTL высокий, Browser TTL умеренный).
- НЕ кэшировать `/api/*` и страницы с авторизацией.

## 5. Проверка
- Прогнать легитимные сценарии (логин, загрузка медиа, постинг) — не должно быть Challenge/Block.
- Проверить заголовки кэша на статике (`cf-cache-status: HIT`).
- Метрики WAF (Security → Events) — нет ложных срабатываний на реальных юзерах.

## Важно
- SSL/TLS mode = **Full (strict)** (см. dns.md) — иначе WAF + proxied ломает HTTPS.
- WAF работает только при **proxied** DNS-записях (оранжевое облако).
