# Runbook — Uptime мониторинг (ЭТАП 24.3, BetterStack)

## Мониторы (каждую минуту, из 3 регионов)
| Монитор            | URL/проверка                              |
|--------------------|-------------------------------------------|
| Лендинг            | https://avastudio.com                     |
| App                | https://app.avastudio.com                 |
| API health         | https://app.avastudio.com/api/health      |
| Worker health      | внутренний /health:4001 (через приватный probe) |
| Supabase REST      | https://<project>.supabase.co/rest/v1/    |
| Redis (Upstash)    | health-чек по REST-пингу                  |

## Алерты
- Канал: SMS + Telegram (on-call), эскалация при отсутствии ответа.
- Срабатывание: <1 минута простоя → алерт.
- Связка с Sentry (24.1): всплеск ошибок тоже шлёт алерт.

## Status page
- Публичная: `status.avastudio.com` (BetterStack Status). DNS CNAME в Cloudflare.
- Показывает аптайм ключевых сервисов, инциденты, плановые работы.

## Проверка (drill)
- Остановить сервис на staging → убедиться, что алерт пришёл <1 мин и статус обновился.
