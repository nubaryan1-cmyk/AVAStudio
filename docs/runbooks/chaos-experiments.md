# Runbook: Chaos-эксперименты (AVAStudio, ЭТАП 8 / TASK 8.4)

> Назначение: контролируемо проверить, что ядро (очереди + worker + FFmpeg + resilience)
> переживает сбои **без потери задач**. Только для **dev/test**. В production chaos
> запрещён (`ChaosController.assertDevOnly` бросает ошибку при `NODE_ENV=production`).

## Инструменты

- `apps/worker/src/chaos/chaos.ts` — `ChaosController`: инъекция сбоев (`failFirst`,
  `errorRate`, `slowMs`, `killOnce`). Активен только при `enabled: true`.
- `apps/worker/src/metrics.ts` — `MetricsRegistry` + `renderPrometheus` → эндпоинт
  `GET /metrics` воркера (порт 4001).
- DLQ из ЭТАПА 5 (`@avastudio/queue`): упавшие после ретраев job'ы не теряются.
- Circuit breakers и политики из TASK 8.1/8.3.

## Проверяемые инварианты

1. **Нет потери задач.** Любой упавший job либо ретраится BullMQ (`attempts: 3`,
   экспоненциальный backoff), либо после исчерпания попыток уходит в DLQ
   (`<queue>-dlq`) и может быть переигран (`replayJob` / `replayAll`).
2. **Идемпотентность.** Одинаковые данные → детерминированный `jobId`
   (`buildJobId`) → BullMQ дедуплицирует. На уровне обработки — `claimIdempotencyKey`
   (SET NX + TTL) не допускает двойной обработки при повторной доставке.
3. **Размыкание breaker.** Серия ошибок внешнего вызова размыкает circuit breaker
   → fail-fast, упавший сервис не нагружается, система не валится каскадно.

## Сценарии

### 1. Kill воркера во время задачи
- **Инъекция:** `new ChaosController({ enabled: true, killOnce: true })` вокруг шага
  обработки (или `kill -9` процесса воркера во время job'а).
- **Ожидание:** job не подтверждён → BullMQ возвращает его в очередь и ретраит;
  после `attempts` — в DLQ. `avastudio_dlq_size` растёт, задача восстановима.
- **Проверка:** `listDLQ("render-video")` содержит запись; `replayJob` возвращает её.

### 2. Обрыв Redis
- **Инъекция:** остановить контейнер `avastudio-redis` (`docker compose stop redis`),
  затем поднять (`docker compose start redis`).
- **Ожидание:** воркер переподключается (ioredis `maxRetriesPerRequest: null`),
  in-flight job'ы повторно доставляются, потери нет. `/health` → `down`/`degraded`
  на время обрыва, затем `ok`.

### 3. Замедление внешнего мока
- **Инъекция:** `new ChaosController({ enabled: true, slowMs: 30000 })`.
- **Ожидание:** срабатывает `timeoutMs` политики (TASK 8.3) → попытка прерывается,
  ретрай по backoff; breaker копит ошибки и при пороге размыкается.

### 4. Возврат ошибки внешним сервисом
- **Инъекция:** `new ChaosController({ enabled: true, errorRate: 1 })` под `withBreaker`.
- **Ожидание:** после `threshold` подряд ошибок breaker → `open`, далее fail-fast
  (`BrokenCircuitError`), реальный вызов не выполняется до `halfOpenAfter`.

### 5. Дубликаты доставки
- **Инъекция:** поставить один и тот же job дважды (одинаковые данные).
- **Ожидание:** одна обработка (dedup по `jobId` + `claimIdempotencyKey`).

## Наблюдаемость (`GET http://localhost:4001/metrics`, формат Prometheus)

| Метрика | Тип | Смысл |
|---|---|---|
| `avastudio_queue_depth{queue}` | gauge | глубина (waiting+delayed) |
| `avastudio_queue_active{queue}` | gauge | активные job'ы |
| `avastudio_jobs_completed_total{queue}` | counter | успешные |
| `avastudio_jobs_failed_total{queue}` | counter | упавшие (после ретраев) |
| `avastudio_jobs_fail_rate{queue}` | gauge | доля падений [0..1] |
| `avastudio_job_latency_ms_avg{queue}` | gauge | средняя latency обработки |
| `avastudio_dlq_size{queue}` | gauge | размер DLQ |

> Дашборды/алерты (Grafana) — вне рамок ЭТАПА 8, это ЭТАП 24.

## Автотесты

- `apps/worker/src/chaos/chaos.test.ts` — корректность инъекции сбоев.
- `apps/worker/src/chaos/invariants.test.ts` — инварианты 1–3 (нет потери, идемпотентность, breaker).
- `apps/worker/src/metrics.test.ts` — счётчики и рендер Prometheus.

Запуск: `pnpm --filter @avastudio/worker test`.
