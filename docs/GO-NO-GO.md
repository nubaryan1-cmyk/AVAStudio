# GO / NO-GO — публичный запуск (TASK 26.2)

Финальные ворота. Запуск (26.3) — только при GO.

## Нагрузочный тест prod/staging
- Сценарий: `load-tests/prod/api-load.js` (k6, ramping-arrival-rate до ~1000 RPS, 10 мин).
- Пороги (thresholds): http_req_failed <1%, p95 <500ms, p99 <1s.
- Сравнение с локальным baseline (ЭТАП 14.2: 60k юзеров, 0 ошибок, 41k ops/sec).

## Чек-лист готовности (каждый пункт — GO/NO-GO)
| Слой                  | Критерий | Статус |
|-----------------------|----------|--------|
| API ~1k RPS           | без падений, пороги держатся | ☐ |
| Autoscaling воркеров  | очередь разгребается, машины масштабируются | ☐ |
| DB pool (PgBouncer)   | без исчерпания коннектов | ☐ |
| Read replica          | тяжёлые чтения уходят на реплику | ☐ |
| CDN (R2/Images)       | медиа отдаётся, latency низкая | ☐ |
| Кэш (Redis/Edge)      | hit-rate высокий, нет устаревших данных | ☐ |
| Redis HA              | переживает сбой, задачи не теряются | ☐ |
| Платежи               | реальная оплата карта+крипто, webhooks идемпотентны | ☐ |
| Безопасность          | A+ headers, rate-limit, Turnstile, pentest High/Critical закрыты | ☐ |
| Observability         | Sentry/Axiom/BetterStack/PostHog ловят, алерты работают | ☐ |
| SLO                   | uptime/latency в пределах, error budget не выгорел | ☐ |
| Backups               | PITR + dump, restore проверен на staging | ☐ |

## Решение
- Все пункты GO → **GO**, переходим к 26.3.
- Любой NO-GO → устранить, перепрогнать тест.
- Подпись/дата ответственного: __________
