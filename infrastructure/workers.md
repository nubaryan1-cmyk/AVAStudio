# Инфраструктура worker'ов (ЭТАП 18)

## Состав
- Образ: `apps/worker/Dockerfile` (Node 20 + FFmpeg + Chromium/Playwright).
- Хостинг: Fly.io (ADR-019). Раздельные приложения по пулам.
- Очереди: BullMQ поверх Redis (Upstash prod, TASK 18.4).
- Health/metrics: Hono-сервер воркера на порту **4001** (`/health`, `/metrics`).

## Пулы и маппинг на очереди
| Пул          | Очереди (BullMQ)                  | Профиль ресурсов        |
|--------------|-----------------------------------|-------------------------|
| cpu-pool     | render-video, unique-media, ai-*  | CPU-bound, conc≈vCPU    |
| browser-pool | post-platform, warmup-account     | RAM-bound (Chromium)    |
| gpu-pool     | render-video (NVENC) — позже      | GPU                     |

## Масштабирование
Скейлер читает глубину очереди (`/metrics` Prometheus или BullMQ getJobCounts) и
регулирует число машин: backlog растёт → scale up; пусто → auto_stop (сон).
См. `infrastructure/scale-workers.mjs` (TASK 18.3).

## Переменные окружения (из Doppler)
`REDIS_URL`, `DATABASE_URL`, `CREDENTIALS_ENCRYPTION_KEY`, `WORKER_CONCURRENCY`,
интеграционные ключи (AI/PHONE/PROXY) — подключаются на соответствующих этапах.
