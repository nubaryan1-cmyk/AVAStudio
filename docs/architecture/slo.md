# SLO / SLI + error budget (ЭТАП 24.5)

Формальные цели надёжности. Burn-rate считается `@avastudio/shared/observability` (`burnRate`),
алерты — на основе порога.

## Цели
| SLO                | Цель      | Окно   | Error budget |
|--------------------|-----------|--------|--------------|
| API uptime         | 99.95%    | 30 дн  | 0.05%        |
| API latency p95    | < 500 ms  | 30 дн  | 1%           |
| Render p95         | < 60 s    | 30 дн  | 5%           |
| Posting success    | > 95%     | 30 дн  | 5%           |

## SLI (источники)
- Uptime/latency — BetterStack + воркер `/metrics` (ЭТАП 8.4).
- Render duration / posting success — метрики очередей (BullMQ) → Axiom/Grafana.
- error rate — Sentry + логи Axiom (по trace_id).

## Error budget policy
- Burn-rate < 1 — в норме.
- Burn-rate ≥ 2 (быстрое выгорание) → **burn-rate алерт** on-call.
- Бюджет выгорел (errorFraction ≥ budget) → **заморозка фич**: только надёжность/багфиксы,
  пока бюджет не восстановится в следующем окне.

## Дашборд здоровья (Grafana Cloud / Axiom)
API latency p50/p95/p99, error rate, queue depth, render duration, posting success rate,
MRR, signup rate. Burn-rate панели на каждый SLO.
